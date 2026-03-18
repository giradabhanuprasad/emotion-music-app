"""
app/api/v1/songs.py
Song catalogue CRUD + search endpoints.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_active_user
from app.database import get_db
from app.ml.music_recommender import embed_text
from app.models import Song, User
from app.schemas import SongCreate, SongListResponse, SongPublic

router = APIRouter(prefix="/songs", tags=["Songs"])


@router.get("/", response_model=SongListResponse)
async def list_songs(
    q: str | None = Query(None, description="Search by title or artist"),
    genre: str | None = Query(None),
    emotion: str | None = Query(None, description="Filter by emotion tag"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> SongListResponse:
    """List songs with optional full-text search, genre, and emotion filters."""
    stmt = select(Song)

    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(Song.title.ilike(pattern), Song.artist.ilike(pattern))
        )
    if genre:
        stmt = stmt.where(Song.genre.ilike(f"%{genre}%"))
    if emotion:
        stmt = stmt.where(Song.emotion_tags.contains([emotion]))

    # total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Song.title).offset(pagination.offset).limit(pagination.page_size)
    songs = (await db.execute(stmt)).scalars().all()

    return SongListResponse(
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        items=[SongPublic.model_validate(s) for s in songs],
    )


@router.get("/{song_id}", response_model=SongPublic)
async def get_song(
    song_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SongPublic:
    """Retrieve a single song by ID."""
    song = await db.get(Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return SongPublic.model_validate(song)


@router.post("/", response_model=SongPublic, status_code=status.HTTP_201_CREATED)
async def create_song(
    payload: SongCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SongPublic:
    """
    Add a song to the catalogue.
    BERT embedding is generated automatically if lyrics are provided.
    """
    # Compute BERT embedding if lyrics are available
    embedding = None
    if payload.lyrics:
        try:
            embedding = embed_text(payload.lyrics[:2000])  # truncate for speed
        except Exception:
            pass  # non-fatal

    song = Song(
        **payload.model_dump(exclude_none=True),
        lyrics_embedding=embedding,
    )
    db.add(song)
    await db.flush()
    return SongPublic.model_validate(song)


@router.delete("/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_song(
    song_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a song from the catalogue."""
    song = await db.get(Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    await db.delete(song)
