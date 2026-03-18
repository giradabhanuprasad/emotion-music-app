"""
app/services/spotify.py
Spotify API integration for fetching real songs with previews.
"""

import base64
import httpx
import asyncio
from typing import Optional

SPOTIFY_CLIENT_ID = "2e4a69656c9a4330a98812701250e866"
SPOTIFY_CLIENT_SECRET = "27d999b32888458c948a0c917888008a"

_token: Optional[str] = None
_token_lock = asyncio.Lock()


async def get_access_token() -> str:
    global _token
    async with _token_lock:
        credentials = base64.b64encode(
            f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://accounts.spotify.com/api/token",
                headers={"Authorization": f"Basic {credentials}"},
                data={"grant_type": "client_credentials"},
            )
            resp.raise_for_status()
            _token = resp.json()["access_token"]
        return _token


async def search_tracks(query: str, limit: int = 5) -> list[dict]:
    token = await get_access_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params={"q": query, "type": "track", "limit": limit, "market": "IN"},
        )
        resp.raise_for_status()
        items = resp.json().get("tracks", {}).get("items", [])
    return [
        {
            "title": t["name"],
            "artist": t["artists"][0]["name"],
            "album": t["album"]["name"],
            "preview_url": t.get("preview_url") or "",
            "cover_url": (t["album"]["images"][0]["url"] if t["album"]["images"] else ""),
            "external_id": t["id"],
            "duration_seconds": t["duration_ms"] // 1000,
        }
        for t in items
        if t  # filter nulls
    ]


# Emotion → search queries
EMOTION_QUERIES = {
    "happy":    ["happy upbeat pop hits", "feel good dance songs", "happy indie pop"],
    "sad":      ["sad emotional songs", "heartbreak ballads", "sad acoustic"],
    "angry":    ["rock rage metal", "angry rock songs", "intense workout music"],
    "fear":     ["calm ambient relaxing", "peaceful meditation music", "soothing instrumental"],
    "surprise": ["unexpected eclectic mix", "jazz fusion experimental", "electronic surprise"],
    "disgust":  ["punk rock raw", "grunge alternative", "intense dark music"],
    "neutral":  ["chill lo-fi beats", "jazz classics", "soft instrumental focus"],
}


async def get_songs_for_emotion(emotion: str, total: int = 15) -> list[dict]:
    queries = EMOTION_QUERIES.get(emotion, EMOTION_QUERIES["neutral"])
    all_songs = []
    per_query = max(5, total // len(queries))
    for query in queries:
        try:
            songs = await search_tracks(query, limit=per_query)
            all_songs.extend(songs)
        except Exception as e:
            print(f"Spotify search error for '{query}': {e}")
    # Deduplicate by external_id
    seen = set()
    unique = []
    for s in all_songs:
        if s["external_id"] not in seen:
            seen.add(s["external_id"])
            unique.append(s)
    return unique[:total]
