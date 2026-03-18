"""
app/api/v1/websocket.py

Real-time WebSocket endpoint.

Protocol
--------
Client → Server:
  { "type": "frame",      "data": { "image": "<base64>" } }
  { "type": "heartbeat",  "data": {} }
  { "type": "close",      "data": {} }

Server → Client:
  { "type": "emotion",        "data": EmotionPayload }
  { "type": "recommendation", "data": [SongPayload, ...] }
  { "type": "error",          "data": { "message": "..." } }
  { "type": "heartbeat",      "data": { "ts": "<iso>" } }
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_token
from app.database import AsyncSessionLocal
from app.ml import emotion_detector
from app.ml.music_recommender import embed_text, explain_recommendation, rank_songs
from app.models import EmotionLog, ListeningSession, Recommendation, Song, User
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])

# ── In-memory connection registry ─────────────────────────────────────────────
_active_connections: Dict[str, WebSocket] = {}


class ConnectionManager:
    def connect(self, session_id: str, ws: WebSocket) -> None:
        _active_connections[session_id] = ws

    def disconnect(self, session_id: str) -> None:
        _active_connections.pop(session_id, None)

    async def send(self, session_id: str, payload: dict) -> None:
        ws = _active_connections.get(session_id)
        if ws:
            await ws.send_text(json.dumps(payload, default=str))

    async def broadcast(self, payload: dict) -> None:
        for ws in list(_active_connections.values()):
            try:
                await ws.send_text(json.dumps(payload, default=str))
            except Exception:
                pass


manager = ConnectionManager()


async def _get_user_from_token(token: str) -> User | None:
    user_id = verify_token(token, expected_type="access")
    if not user_id:
        return None
    try:
        # Normalize UUID (with or without dashes)
        normalized_id = str(uuid.UUID(user_id)) if len(user_id.replace('-','')) == 32 else user_id
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == normalized_id))
            user = result.scalar_one_or_none()
            if user is None:
                result2 = await db.execute(select(User).where(User.id == user_id))
                user = result2.scalar_one_or_none()
            return user
    except Exception as e:
        print(f"WebSocket auth error: {e}")
        return None


async def _get_top_songs(emotion: str, db: AsyncSession, top_n: int = 5) -> list[dict]:
    songs = (await db.execute(select(Song))).scalars().all()
    if not songs:
        return []
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
        }
        for s in songs
    ]
    ranked = rank_songs(emotion, song_dicts, embed_text(emotion), top_n=top_n)
    return ranked


@router.websocket("/ws/session")
async def websocket_session(websocket: WebSocket, token: str):
    """
    Authenticated WebSocket session.
    Pass `?token=<access_token>` as a query parameter.
    """
    await websocket.accept()

    logger.info("WS: Verifying token...")
    user = await _get_user_from_token(token)
    if not user:
        logger.warning("WS: Token invalid or expired — closing connection")
        await websocket.send_text(json.dumps({"type": "error", "data": {"message": "Unauthorized"}}))
        await websocket.close(code=4001)
        return
    logger.info("WS: Token valid for user %s", user.username)

    session_id = str(uuid.uuid4())
    manager.connect(session_id, websocket)
    logger.info("WS session %s opened for user %s", session_id, user.username)

    # Persist session record
    try:
        async with AsyncSessionLocal() as db:
            session_rec = ListeningSession(user_id=user.id, session_token=session_id)
            db.add(session_rec)
            await db.commit()
    except Exception as e:
        logger.warning("Could not save session record: %s", e)

    # Send welcome
    await websocket.send_text(json.dumps({
        "type": "connected",
        "data": {"session_id": session_id, "user": user.username},
    }))

    last_emotion: str | None = None
    # Smoothing: keep last 3 predictions and pick the most common
    from collections import deque, Counter
    emotion_window: deque = deque(maxlen=3)
    heartbeat_task = asyncio.create_task(_heartbeat(session_id))

    logger.info("WS: Entering main loop for session %s", session_id)
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "frame":
                b64 = msg.get("data", {}).get("image", "")
                if not b64:
                    continue

                # Emotion inference
                try:
                    result = emotion_detector.predict_from_base64(b64)
                except Exception as exc:
                    await manager.send(session_id, {"type": "error", "data": {"message": str(exc)}})
                    continue

                raw_emotion = result["emotion"]

                # No face detected — notify client and skip
                if not raw_emotion or not result["face_detected"]:
                    await manager.send(session_id, {
                        "type": "emotion",
                        "data": {
                            "emotion": None,
                            "confidence": 0.0,
                            "scores": {},
                            "face_detected": False,
                        },
                    })
                    continue

                # Smooth: use majority vote of last 3 frames
                emotion_window.append(raw_emotion)
                emotion = Counter(emotion_window).most_common(1)[0][0]

                # Log to DB
                async with AsyncSessionLocal() as db:
                    log = EmotionLog(
                        user_id=user.id,
                        session_id=session_id,
                        emotion=emotion,
                        confidence=result["confidence"],
                        emotion_scores=result["scores"],
                        face_detected=result["face_detected"],
                    )
                    db.add(log)
                    await db.commit()

                # Send emotion result to client
                await manager.send(session_id, {
                    "type": "emotion",
                    "data": {
                        "emotion": emotion,
                        "confidence": result["confidence"],
                        "scores": result["scores"],
                        "face_detected": result["face_detected"],
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

                # Only refresh recommendations when emotion changes
                if emotion != last_emotion:
                    last_emotion = emotion
                    async with AsyncSessionLocal() as db:
                        songs = await _get_top_songs(emotion, db, top_n=5)

                    await manager.send(session_id, {
                        "type": "recommendation",
                        "data": {
                            "emotion": emotion,
                            "songs": [
                                {
                                    "title": s["title"],
                                    "artist": s["artist"],
                                    "genre": s.get("genre"),
                                    "cover_url": s.get("cover_url"),
                                    "preview_url": s.get("preview_url"),
                                    "score": s.get("_recommendation_score"),
                                    "reason": explain_recommendation(s, emotion),
                                }
                                for s in songs
                            ],
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

            elif msg_type == "heartbeat":
                await manager.send(session_id, {
                    "type": "heartbeat",
                    "data": {"ts": datetime.now(timezone.utc).isoformat()},
                })

            elif msg_type == "close":
                break

    except WebSocketDisconnect:
        logger.info("WS session %s disconnected", session_id)
    except Exception as exc:
        logger.exception("WS error in session %s: %s", session_id, exc)
    finally:
        heartbeat_task.cancel()
        manager.disconnect(session_id)

        # Mark session ended
        async with AsyncSessionLocal() as db:
            stmt = select(ListeningSession).where(
                ListeningSession.session_token == session_id
            )
            session_rec = (await db.execute(stmt)).scalar_one_or_none()
            if session_rec:
                session_rec.is_active = False
                session_rec.ended_at = datetime.now(timezone.utc)
                await db.commit()


async def _heartbeat(session_id: str, interval: float = 30.0) -> None:
    """Send periodic heartbeats to keep connection alive."""
    while True:
        await asyncio.sleep(interval)
        try:
            await manager.send(session_id, {
                "type": "heartbeat",
                "data": {"ts": datetime.now(timezone.utc).isoformat()},
            })
        except Exception:
            break
