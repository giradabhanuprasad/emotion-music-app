"""
app/api/deps.py
FastAPI dependency functions shared across route modules.
"""

import uuid as _uuid
from typing import Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_token
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def _normalize_uuid(user_id: str) -> str:
    """Ensure UUID has dashes regardless of how it was stored."""
    try:
        return str(_uuid.UUID(user_id))
    except ValueError:
        return user_id


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = verify_token(credentials.credentials, expected_type="access")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Normalize UUID format (with or without dashes)
    normalized_id = _normalize_uuid(user_id)

    # Try with dashes first, then without
    result = await db.execute(select(User).where(User.id == normalized_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Try without dashes as fallback
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Alias used by routes that need a verified active user."""
    return current_user


# ── Pagination ────────────────────────────────────────────────────────────────
class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size

