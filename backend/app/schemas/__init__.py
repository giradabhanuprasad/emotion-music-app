"""
app/schemas/__init__.py
Pydantic v2 schemas for request / response validation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Shared ────────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserRegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=8, max_length=128)
    display_name: Optional[str] = Field(None, max_length=150)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── User ──────────────────────────────────────────────────────────────────────
class UserPublic(BaseModel):
    id: uuid.UUID
    email: EmailStr
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    preferences: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=150)
    avatar_url: Optional[str] = Field(None, max_length=500)
    preferences: Optional[Dict[str, Any]] = None


# ── Song ──────────────────────────────────────────────────────────────────────
class SongCreate(BaseModel):
    title: str = Field(..., max_length=300)
    artist: str = Field(..., max_length=200)
    album: Optional[str] = Field(None, max_length=300)
    genre: Optional[str] = Field(None, max_length=100)
    subgenres: List[str] = []
    duration_seconds: Optional[int] = None
    tempo_bpm: Optional[float] = None
    energy: Optional[float] = Field(None, ge=0.0, le=1.0)
    valence: Optional[float] = Field(None, ge=0.0, le=1.0)
    danceability: Optional[float] = Field(None, ge=0.0, le=1.0)
    lyrics: Optional[str] = None
    emotion_tags: List[str] = []
    preview_url: Optional[str] = None
    cover_url: Optional[str] = None
    external_id: Optional[str] = None


class SongPublic(SongCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class SongListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[SongPublic]


# ── Emotion ───────────────────────────────────────────────────────────────────
class EmotionDetectRequest(BaseModel):
    """Used when passing a base64 image from the frontend."""
    image_base64: str = Field(..., description="Base64-encoded JPEG/PNG frame")
    session_id: Optional[str] = None


class EmotionScores(BaseModel):
    angry: float = 0.0
    disgust: float = 0.0
    fear: float = 0.0
    happy: float = 0.0
    neutral: float = 0.0
    sad: float = 0.0
    surprise: float = 0.0


class EmotionDetectResponse(BaseModel):
    emotion: str
    confidence: float
    scores: EmotionScores
    face_detected: bool
    log_id: Optional[uuid.UUID] = None


class EmotionLogPublic(BaseModel):
    id: uuid.UUID
    emotion: str
    confidence: float
    emotion_scores: Dict[str, float]
    face_detected: bool
    detected_at: datetime

    model_config = {"from_attributes": True}


class EmotionHistoryResponse(BaseModel):
    total: int
    items: List[EmotionLogPublic]


# ── Recommendation ────────────────────────────────────────────────────────────
class RecommendationRequest(BaseModel):
    emotion: Optional[str] = None       # override detected emotion
    limit: int = Field(20, ge=1, le=500)
    exclude_ids: List[uuid.UUID] = []


class RecommendationPublic(BaseModel):
    id: uuid.UUID
    song: SongPublic
    emotion: str
    score: float
    reason: Optional[str]
    recommended_at: datetime

    model_config = {"from_attributes": True}


class RecommendationListResponse(BaseModel):
    emotion: str
    total: int
    items: List[RecommendationPublic]


class RatingRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)


# ── WebSocket Messages ────────────────────────────────────────────────────────
class WSMessage(BaseModel):
    type: str   # emotion_update | recommendation | error | heartbeat
    data: Dict[str, Any] = {}
    timestamp: Optional[datetime] = None


class WSEmotionPayload(BaseModel):
    emotion: str
    confidence: float
    scores: EmotionScores


class WSRecommendationPayload(BaseModel):
    songs: List[SongPublic]
    emotion: str
