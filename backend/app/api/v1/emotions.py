"""
app/api/v1/emotions.py
Emotion detection endpoints.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PaginationParams, get_current_active_user
from app.database import get_db
from app.ml import emotion_detector
from app.models import EmotionLog, User
from app.schemas import (
    EmotionDetectRequest,
    EmotionDetectResponse,
    EmotionHistoryResponse,
    EmotionLogPublic,
    EmotionScores,
)

router = APIRouter(prefix="/emotions", tags=["Emotion Detection"])


async def _log_emotion(
    user: User,
    result: dict,
    session_id: str | None,
    db: AsyncSession,
) -> EmotionLog:
    log = EmotionLog(
        user_id=user.id,
        session_id=session_id,
        emotion=result["emotion"],
        confidence=result["confidence"],
        emotion_scores=result["scores"],
        face_detected=result["face_detected"],
    )
    db.add(log)
    await db.flush()
    return log


@router.post("/detect", response_model=EmotionDetectResponse)
async def detect_emotion_base64(
    payload: EmotionDetectRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EmotionDetectResponse:
    """
    Detect emotion from a base64-encoded image frame.
    Suitable for WebSocket clients sending periodic snapshots.
    """
    try:
        result = emotion_detector.predict_from_base64(payload.image_base64)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {exc}")

    log = await _log_emotion(current_user, result, payload.session_id, db)

    return EmotionDetectResponse(
        emotion=result["emotion"],
        confidence=result["confidence"],
        scores=EmotionScores(**result["scores"]),
        face_detected=result["face_detected"],
        log_id=log.id,
    )


@router.post("/detect/upload", response_model=EmotionDetectResponse)
async def detect_emotion_upload(
    file: UploadFile = File(..., description="JPEG or PNG image"),
    session_id: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EmotionDetectResponse:
    """
    Detect emotion from an uploaded image file.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=415, detail="Unsupported image format")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    try:
        result = emotion_detector.predict_from_bytes(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Image processing failed: {exc}")

    log = await _log_emotion(current_user, result, session_id, db)

    return EmotionDetectResponse(
        emotion=result["emotion"],
        confidence=result["confidence"],
        scores=EmotionScores(**result["scores"]),
        face_detected=result["face_detected"],
        log_id=log.id,
    )


@router.get("/history", response_model=EmotionHistoryResponse)
async def get_emotion_history(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EmotionHistoryResponse:
    """Return paginated emotion detection history for the authenticated user."""
    stmt = (
        select(EmotionLog)
        .where(EmotionLog.user_id == current_user.id)
        .order_by(EmotionLog.detected_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    count_stmt = select(EmotionLog).where(EmotionLog.user_id == current_user.id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())

    return EmotionHistoryResponse(
        total=total,
        items=[EmotionLogPublic.model_validate(log) for log in logs],
    )
