"""tests/test_auth.py"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "new@example.com",
        "username": "newuser",
        "password": "NewPass1",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@example.com"
    assert data["username"] == "newuser"
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {"email": "dup@example.com", "username": "user1", "password": "TestPass1"}
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json={**payload, "username": "user2"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "username": "loginuser",
        "password": "LoginPass1",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "LoginPass1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "wp@example.com",
        "username": "wpuser",
        "password": "WpPass1",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "wp@example.com",
        "password": "WrongPass1",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "refresh@example.com",
        "username": "refreshuser",
        "password": "RefreshPass1",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "refresh@example.com",
        "password": "RefreshPass1",
    })
    refresh_token = login_resp.json()["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_weak_password_rejected(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "weak@example.com",
        "username": "weakuser",
        "password": "weakpass",  # no uppercase, no digit
    })
    assert resp.status_code == 422
