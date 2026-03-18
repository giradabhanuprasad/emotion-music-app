"""
app/api/v1/recommendations.py
Emotion-aware music recommendation endpoints.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.ml.music_recommender import embed_text, explain_recommendation, rank_songs
from app.models import EmotionLog, Recommendation, Song, User
from app.schemas import (
    RatingRequest,
    RecommendationListResponse,
    RecommendationPublic,
    RecommendationRequest,
    SongPublic,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.post("/", response_model=RecommendationListResponse)
async def get_recommendations(
    payload: RecommendationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationListResponse:
    """
    Generate emotion-aware music recommendations.

    If `emotion` is not supplied, the most recent detected emotion for the
    user is used.
    """
    # ── Resolve emotion ───────────────────────────────────────────────────────
    emotion = payload.emotion
    emotion_log_id = None

    if not emotion:
        stmt = (
            select(EmotionLog)
            .where(EmotionLog.user_id == current_user.id)
            .order_by(EmotionLog.detected_at.desc())
            .limit(1)
        )
        log = (await db.execute(stmt)).scalar_one_or_none()
        if not log:
            emotion = "neutral"
        else:
            emotion = log.emotion
            emotion_log_id = log.id

    # ── Fetch candidate songs ─────────────────────────────────────────────────
    stmt = select(Song)
    if payload.exclude_ids:
        stmt = stmt.where(Song.id.notin_(payload.exclude_ids))
    songs = (await db.execute(stmt)).scalars().all()

    if not songs:
        return RecommendationListResponse(emotion=emotion, total=0, items=[])

    # ── Rank via ML pipeline ──────────────────────────────────────────────────
    song_dicts = [
        {
            "id": str(s.id),
            "title": s.title,
            "artist": s.artist,
            "album": s.album,
            "genre": s.genre,
            "subgenres": s.subgenres or [],
            "energy": s.energy,
            "valence": s.valence,
            "danceability": s.danceability,
            "acousticness": s.acousticness,
            "tempo_bpm": s.tempo_bpm,
            "lyrics_embedding": s.lyrics_embedding or [],
            "emotion_tags": s.emotion_tags or [],
            "preview_url": s.preview_url,
            "cover_url": s.cover_url,
            "duration_seconds": s.duration_seconds,
            "external_id": s.external_id,
        }
        for s in songs
    ]

    emotion_emb = embed_text(emotion)
    ranked = rank_songs(emotion, song_dicts, emotion_emb, top_n=payload.limit)

    # ── Persist recommendations ───────────────────────────────────────────────
    song_map = {str(s.id): s for s in songs}
    result_items: list[RecommendationPublic] = []

    for ranked_song in ranked:
        song_obj = song_map.get(ranked_song["id"])
        if not song_obj:
            continue

        rec = Recommendation(
            user_id=current_user.id,
            song_id=song_obj.id,
            emotion_log_id=emotion_log_id,
            emotion=emotion,
            score=ranked_song["_recommendation_score"],
            reason=explain_recommendation(ranked_song, emotion),
        )
        db.add(rec)
        await db.flush()

        result_items.append(
            RecommendationPublic(
                id=rec.id,
                song=SongPublic.model_validate(song_obj),
                emotion=emotion,
                score=rec.score,
                reason=rec.reason,
                recommended_at=rec.recommended_at,
            )
        )

    await db.commit()

    return RecommendationListResponse(
        emotion=emotion,
        total=len(result_items),
        items=result_items,
    )


@router.patch("/{recommendation_id}/rate", response_model=RecommendationPublic)
async def rate_recommendation(
    recommendation_id: UUID,
    payload: RatingRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationPublic:
    """Submit explicit feedback (1–5 stars) for a recommendation."""
    rec = await db.get(Recommendation, recommendation_id)
    if not rec or rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.user_rating = payload.rating
    await db.flush()

    song = await db.get(Song, rec.song_id)
    return RecommendationPublic(
        id=rec.id,
        song=SongPublic.model_validate(song),
        emotion=rec.emotion,
        score=rec.score,
        reason=rec.reason,
        recommended_at=rec.recommended_at,
    )


@router.get("/history", response_model=RecommendationListResponse)
async def recommendation_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationListResponse:
    """Return the user's past recommendations (most recent first)."""
    stmt = (
        select(Recommendation)
        .where(Recommendation.user_id == current_user.id)
        .order_by(Recommendation.recommended_at.desc())
        .limit(limit)
    )
    recs = (await db.execute(stmt)).scalars().all()

    items = []
    for rec in recs:
        song = await db.get(Song, rec.song_id)
        if song:
            items.append(
                RecommendationPublic(
                    id=rec.id,
                    song=SongPublic.model_validate(song),
                    emotion=rec.emotion,
                    score=rec.score,
                    reason=rec.reason,
                    recommended_at=rec.recommended_at,
                )
            )

    return RecommendationListResponse(
        emotion="mixed",
        total=len(items),
        items=items,
    )
