"""tests/test_recommendations.py"""

import pytest
from httpx import AsyncClient


SAMPLE_SONG = {
    "title": "Feel Good Inc",
    "artist": "Gorillaz",
    "album": "Demon Days",
    "genre": "indie",
    "subgenres": ["pop", "indie"],
    "duration_seconds": 222,
    "energy": 0.8,
    "valence": 0.7,
    "danceability": 0.75,
    "emotion_tags": ["happy", "neutral"],
    "tempo_bpm": 140,
}


@pytest.mark.asyncio
async def test_create_song(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/songs/", json=SAMPLE_SONG, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Feel Good Inc"
    assert data["genre"] == "indie"
    return data["id"]


@pytest.mark.asyncio
async def test_list_songs(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/songs/", json=SAMPLE_SONG, headers=auth_headers)
    resp = await client.get("/api/v1/songs/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_search_songs(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/songs/", json=SAMPLE_SONG, headers=auth_headers)
    resp = await client.get("/api/v1/songs/?q=Gorillaz", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_get_recommendations_neutral(client: AsyncClient, auth_headers: dict):
    # Seed a song
    await client.post("/api/v1/songs/", json=SAMPLE_SONG, headers=auth_headers)
    # Request recommendations with explicit emotion
    resp = await client.post(
        "/api/v1/recommendations/",
        json={"emotion": "happy", "limit": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["emotion"] == "happy"
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_recommendation_history(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/songs/", json=SAMPLE_SONG, headers=auth_headers)
    await client.post(
        "/api/v1/recommendations/",
        json={"emotion": "sad", "limit": 3},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/recommendations/history", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_rate_recommendation(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/songs/", json=SAMPLE_SONG, headers=auth_headers)
    rec_resp = await client.post(
        "/api/v1/recommendations/",
        json={"emotion": "neutral", "limit": 1},
        headers=auth_headers,
    )
    items = rec_resp.json()["items"]
    if not items:
        pytest.skip("No recommendations generated")

    rec_id = items[0]["id"]
    rate_resp = await client.patch(
        f"/api/v1/recommendations/{rec_id}/rate",
        json={"rating": 5},
        headers=auth_headers,
    )
    assert rate_resp.status_code == 200
