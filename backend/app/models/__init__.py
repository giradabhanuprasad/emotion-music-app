"""
app/models/__init__.py
SQLAlchemy ORM models - SQLite compatible version.
"""

import json
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ── JSON type that works with both SQLite and PostgreSQL ──────────────────────
class JSONField(TypeDecorator):
    """Stores JSON as text in SQLite, uses native JSON in PostgreSQL."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            try:
                return json.loads(value)
            except Exception:
                return {}
        return {}


# ── Users ─────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(_uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(150), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    preferences = Column(JSONField, default=dict, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    emotion_logs = relationship("EmotionLog", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    listening_sessions = relationship("ListeningSession", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.username}>"


# ── Songs ─────────────────────────────────────────────────────────────────────
class Song(Base):
    __tablename__ = "songs"

    id = Column(String(36), primary_key=True, default=lambda: str(_uuid.uuid4()))
    title = Column(String(300), nullable=False, index=True)
    artist = Column(String(200), nullable=False, index=True)
    album = Column(String(300), nullable=True)
    genre = Column(String(100), nullable=True, index=True)
    subgenres = Column(JSONField, default=list, nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    tempo_bpm = Column(Float, nullable=True)
    energy = Column(Float, nullable=True)
    valence = Column(Float, nullable=True)
    danceability = Column(Float, nullable=True)
    acousticness = Column(Float, nullable=True)
    lyrics = Column(Text, nullable=True)
    lyrics_embedding = Column(JSONField, nullable=True)
    emotion_tags = Column(JSONField, default=list, nullable=False)
    preview_url = Column(String(500), nullable=True)
    cover_url = Column(String(500), nullable=True)
    external_id = Column(String(200), nullable=True)
    extra_data = Column(JSONField, default=dict, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    recommendations = relationship("Recommendation", back_populates="song")

    def __repr__(self):
        return f"<Song {self.title!r} by {self.artist}>"


# ── Emotion Logs ──────────────────────────────────────────────────────────────
class EmotionLog(Base):
    __tablename__ = "emotion_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(_uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    emotion = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    emotion_scores = Column(JSONField, nullable=False)
    face_detected = Column(Boolean, default=True, nullable=False)
    image_path = Column(String(500), nullable=True)
    detected_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="emotion_logs")

    def __repr__(self):
        return f"<EmotionLog {self.emotion} ({self.confidence:.2f})>"


# ── Recommendations ───────────────────────────────────────────────────────────
class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True, default=lambda: str(_uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    song_id = Column(String(36), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False)
    emotion_log_id = Column(String(36), ForeignKey("emotion_logs.id", ondelete="SET NULL"), nullable=True)
    emotion = Column(String(50), nullable=False)
    score = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    was_played = Column(Boolean, default=False, nullable=False)
    user_rating = Column(Integer, nullable=True)
    recommended_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", back_populates="recommendations")
    song = relationship("Song", back_populates="recommendations")

    def __repr__(self):
        return f"<Recommendation song={self.song_id} emotion={self.emotion}>"


# ── Listening Sessions ────────────────────────────────────────────────────────
class ListeningSession(Base):
    __tablename__ = "listening_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(_uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(200), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    current_emotion = Column(String(50), nullable=True)
    current_song_id = Column(String(36), ForeignKey("songs.id"), nullable=True)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    extra_data = Column(JSONField, default=dict, nullable=False)

    user = relationship("User", back_populates="listening_sessions")

    def __repr__(self):
        return f"<ListeningSession {self.session_token[:8]} active={self.is_active}>"