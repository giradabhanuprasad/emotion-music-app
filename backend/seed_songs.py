#!/usr/bin/env python3
"""
scripts/seed_songs.py
Populate the database with a sample song catalogue for development/demo.
Run: python scripts/seed_songs.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import AsyncSessionLocal, create_tables
from app.models import Song
from app.ml.music_recommender import embed_text

SAMPLE_SONGS = [
    # ── Happy ────────────────────────────────────────────────────────────────
    {"title": "Happy", "artist": "Pharrell Williams", "genre": "pop", "subgenres": ["pop", "dance"],
     "energy": 0.84, "valence": 0.96, "danceability": 0.83, "tempo_bpm": 160,
     "emotion_tags": ["happy"], "cover_url": "https://via.placeholder.com/300x300/a3e635/000?text=Happy"},
    {"title": "Can't Stop the Feeling!", "artist": "Justin Timberlake", "genre": "pop", "subgenres": ["pop", "dance"],
     "energy": 0.80, "valence": 0.94, "danceability": 0.79, "tempo_bpm": 113,
     "emotion_tags": ["happy"], "cover_url": "https://via.placeholder.com/300x300/a3e635/000?text=Feeling"},
    {"title": "Good as Hell", "artist": "Lizzo", "genre": "pop", "subgenres": ["indie", "pop"],
     "energy": 0.78, "valence": 0.90, "danceability": 0.75, "tempo_bpm": 96,
     "emotion_tags": ["happy", "neutral"]},
    {"title": "Shake It Off", "artist": "Taylor Swift", "genre": "pop", "subgenres": ["pop", "dance"],
     "energy": 0.80, "valence": 0.92, "danceability": 0.65, "tempo_bpm": 160,
     "emotion_tags": ["happy"]},

    # ── Sad ──────────────────────────────────────────────────────────────────
    {"title": "The Night We Met", "artist": "Lord Huron", "genre": "indie", "subgenres": ["acoustic", "indie"],
     "energy": 0.22, "valence": 0.18, "danceability": 0.33, "tempo_bpm": 75, "acousticness": 0.85,
     "emotion_tags": ["sad"], "cover_url": "https://via.placeholder.com/300x300/60a5fa/000?text=Night"},
    {"title": "Someone Like You", "artist": "Adele", "genre": "soul", "subgenres": ["blues", "soul"],
     "energy": 0.27, "valence": 0.17, "danceability": 0.44, "tempo_bpm": 68, "acousticness": 0.74,
     "emotion_tags": ["sad"]},
    {"title": "Skinny Love", "artist": "Bon Iver", "genre": "indie", "subgenres": ["acoustic", "folk"],
     "energy": 0.20, "valence": 0.14, "danceability": 0.31, "tempo_bpm": 96, "acousticness": 0.92,
     "emotion_tags": ["sad"]},

    # ── Angry ─────────────────────────────────────────────────────────────────
    {"title": "Break Stuff", "artist": "Limp Bizkit", "genre": "rock", "subgenres": ["metal", "punk"],
     "energy": 0.95, "valence": 0.10, "danceability": 0.50, "tempo_bpm": 108,
     "emotion_tags": ["angry"], "cover_url": "https://via.placeholder.com/300x300/f87171/000?text=Rock"},
    {"title": "Killing in the Name", "artist": "Rage Against the Machine", "genre": "metal", "subgenres": ["rock", "punk"],
     "energy": 0.97, "valence": 0.12, "danceability": 0.47, "tempo_bpm": 103,
     "emotion_tags": ["angry"]},
    {"title": "Bodies", "artist": "Drowning Pool", "genre": "metal", "subgenres": ["rock", "metal"],
     "energy": 0.96, "valence": 0.08, "danceability": 0.42, "tempo_bpm": 156,
     "emotion_tags": ["angry"]},

    # ── Fear / Calm ────────────────────────────────────────────────────────────
    {"title": "Weightless", "artist": "Marconi Union", "genre": "ambient", "subgenres": ["ambient", "classical"],
     "energy": 0.12, "valence": 0.30, "danceability": 0.22, "tempo_bpm": 60, "acousticness": 0.90,
     "emotion_tags": ["fear", "neutral"]},
    {"title": "Experience", "artist": "Ludovico Einaudi", "genre": "classical", "subgenres": ["classical", "ambient"],
     "energy": 0.15, "valence": 0.25, "danceability": 0.18, "tempo_bpm": 54, "acousticness": 0.98,
     "emotion_tags": ["fear", "neutral"]},

    # ── Surprise ───────────────────────────────────────────────────────────────
    {"title": "Harder, Better, Faster, Stronger", "artist": "Daft Punk", "genre": "electronic",
     "subgenres": ["electronic", "dance"],
     "energy": 0.88, "valence": 0.70, "danceability": 0.83, "tempo_bpm": 123,
     "emotion_tags": ["surprise", "happy"]},
    {"title": "Take Five", "artist": "Dave Brubeck Quartet", "genre": "jazz", "subgenres": ["jazz", "experimental"],
     "energy": 0.45, "valence": 0.55, "danceability": 0.52, "tempo_bpm": 170,
     "emotion_tags": ["surprise", "neutral"]},

    # ── Neutral ────────────────────────────────────────────────────────────────
    {"title": "Clair de Lune", "artist": "Claude Debussy", "genre": "classical", "subgenres": ["classical"],
     "energy": 0.08, "valence": 0.45, "danceability": 0.14, "tempo_bpm": 58, "acousticness": 0.99,
     "emotion_tags": ["neutral"]},
    {"title": "Autumn Leaves", "artist": "Miles Davis", "genre": "jazz", "subgenres": ["jazz", "chillout"],
     "energy": 0.28, "valence": 0.42, "danceability": 0.35, "tempo_bpm": 88,
     "emotion_tags": ["neutral", "sad"]},
]


async def seed() -> None:
    await create_tables()
    async with AsyncSessionLocal() as db:
        for data in SAMPLE_SONGS:
            # Skip if exists
            from sqlalchemy import select
            stmt = select(Song).where(Song.title == data["title"], Song.artist == data["artist"])
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                print(f"  skip: {data['title']}")
                continue

            # Embed a short description if no lyrics
            desc = f"{data.get('genre', '')} {' '.join(data.get('emotion_tags', []))} {data['title']}"
            try:
                emb = embed_text(desc)
            except Exception:
                emb = None

            song = Song(**{k: v for k, v in data.items() if hasattr(Song, k)},
                        lyrics_embedding=emb)
            db.add(song)
            print(f"  added: {data['title']} by {data['artist']}")

        await db.commit()
    print(f"\nSeeded {len(SAMPLE_SONGS)} songs.")


if __name__ == "__main__":
    asyncio.run(seed())
