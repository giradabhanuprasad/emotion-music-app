"""
scripts/seed_spotify.py - Seed database using iTunes API (free, no auth needed)
Run from backend folder: python seed_spotify.py
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models import Song
from sqlalchemy import delete
import httpx
import time

EMOTION_SEARCHES = {
    "happy":   ["happy pharrell williams", "uptown funk", "walking on sunshine", "good as hell lizzo"],
    "sad":     ["someone like you adele", "the night we met lord huron", "fix you coldplay", "let her go passenger"],
    "angry":   ["killing in the name rage against machine", "break stuff limp bizkit", "given up linkin park"],
    "fear":    ["weightless marconi union", "claire de lune debussy", "experience ludovico einaudi"],
    "surprise":["bohemian rhapsody queen", "take five dave brubeck", "thriller michael jackson"],
    "disgust": ["smells like teen spirit nirvana", "basket case green day", "chop suey system of a down"],
    "neutral": ["autumn leaves miles davis", "so what miles davis", "fly me to the moon frank sinatra", "hotel california eagles"],
}

EMOTION_FEATURES = {
    "happy":    {"energy": 0.8, "valence": 0.9, "tempo_bpm": 120, "danceability": 0.8, "acousticness": 0.2},
    "sad":      {"energy": 0.3, "valence": 0.2, "tempo_bpm": 70,  "danceability": 0.3, "acousticness": 0.7},
    "angry":    {"energy": 0.9, "valence": 0.2, "tempo_bpm": 140, "danceability": 0.5, "acousticness": 0.1},
    "fear":     {"energy": 0.2, "valence": 0.3, "tempo_bpm": 60,  "danceability": 0.2, "acousticness": 0.8},
    "surprise": {"energy": 0.7, "valence": 0.7, "tempo_bpm": 110, "danceability": 0.7, "acousticness": 0.3},
    "disgust":  {"energy": 0.8, "valence": 0.2, "tempo_bpm": 130, "danceability": 0.4, "acousticness": 0.1},
    "neutral":  {"energy": 0.5, "valence": 0.5, "tempo_bpm": 90,  "danceability": 0.5, "acousticness": 0.5},
}

EMOTION_GENRES = {
    "happy": "pop", "sad": "acoustic", "angry": "rock",
    "fear": "ambient", "surprise": "classic rock", "disgust": "punk", "neutral": "jazz",
}


async def search_itunes(query: str, limit: int = 3) -> list[dict]:
    url = "https://itunes.apple.com/search"
    params = {"term": query, "media": "music", "limit": limit, "entity": "song"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        results = resp.json().get("results", [])
    return [
        {
            "title": r.get("trackName", "Unknown"),
            "artist": r.get("artistName", "Unknown"),
            "album": r.get("collectionName", ""),
            "preview_url": r.get("previewUrl", ""),
            "cover_url": r.get("artworkUrl100", "").replace("100x100", "300x300"),
            "external_id": str(r.get("trackId", "")),
            "duration_seconds": r.get("trackTimeMillis", 180000) // 1000,
        }
        for r in results
    ]


async def seed():
    print("🎵 Seeding database with iTunes songs (with real audio previews)...\n")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(Song))
        await db.commit()
        print("✓ Cleared existing songs\n")

        total = 0
        seen_ids = set()

        for emotion, queries in EMOTION_SEARCHES.items():
            print(f"🔍 Fetching {emotion} songs from iTunes...")
            features = EMOTION_FEATURES[emotion]
            genre = EMOTION_GENRES[emotion]
            added = 0
            previews = 0

            for query in queries:
                try:
                    songs = await search_itunes(query, limit=3)
                    for s in songs:
                        if s["external_id"] in seen_ids:
                            continue
                        seen_ids.add(s["external_id"])

                        song = Song(
                            title=s["title"],
                            artist=s["artist"],
                            album=s["album"],
                            genre=genre,
                            subgenres=[emotion],
                            emotion_tags=[emotion],
                            preview_url=s["preview_url"],
                            cover_url=s["cover_url"],
                            external_id=s["external_id"],
                            duration_seconds=s["duration_seconds"],
                            energy=features["energy"],
                            valence=features["valence"],
                            tempo_bpm=features["tempo_bpm"],
                            danceability=features["danceability"],
                            acousticness=features["acousticness"],
                            extra_data={},
                        )
                        db.add(song)
                        added += 1
                        if s["preview_url"]:
                            previews += 1

                    await asyncio.sleep(0.3)  # be polite to iTunes API

                except Exception as e:
                    print(f"  ⚠ Error for '{query}': {e}")

            await db.commit()
            print(f"  ✓ Added {added} songs ({previews} with audio preview)\n")
            total += added

        print(f"✅ Done! Added {total} songs total with real 30-second previews.")
        print("🚀 Restart the backend and click Refresh in the app!")


if __name__ == "__main__":
    asyncio.run(seed())
