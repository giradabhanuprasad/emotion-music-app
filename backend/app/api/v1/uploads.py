"""
app/api/v1/uploads.py
Upload local MP3/audio files and add them to the song catalogue.
"""

import os
import uuid
import shutil
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models import Song, User
from app.schemas import SongPublic

router = APIRouter(prefix="/uploads", tags=["Uploads"])

UPLOADS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "uploads", "songs")
)
ALLOWED_TYPES = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/flac", "audio/x-m4a"}
MAX_SIZE_MB = 50


@router.post("/song", response_model=SongPublic)
async def upload_song(
    file: UploadFile = File(...),
    title: str = Form(...),
    artist: str = Form(...),
    album: str = Form(""),
    genre: str = Form(""),
    emotion_tags: str = Form(""),   # comma-separated e.g. "happy,energetic"
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a local audio file and register it as a song."""

    # Validate file type
    content_type = file.content_type or ""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    allowed_exts = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}

    if content_type not in ALLOWED_TYPES and ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Only audio files are allowed (mp3, wav, ogg, flac, m4a)")

    # Read and check size
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File too large. Max size is {MAX_SIZE_MB}MB")

    # Save to uploads folder
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOADS_DIR, safe_name)
    with open(dest, "wb") as f:
        f.write(data)

    # Build URL accessible from browser
    preview_url = f"/uploads/songs/{safe_name}"

    # Parse emotion tags
    tags = [t.strip().lower() for t in emotion_tags.split(",") if t.strip()] if emotion_tags else []

    # Save to DB
    song = Song(
        title=title,
        artist=artist,
        album=album or None,
        genre=genre or None,
        emotion_tags=tags,
        preview_url=preview_url,
        extra_data={"uploaded_by": str(current_user.id), "local_file": safe_name},
    )
    db.add(song)
    await db.commit()
    await db.refresh(song)
    return SongPublic.model_validate(song)


@router.delete("/song/{song_id}")
async def delete_uploaded_song(
    song_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an uploaded song and its file."""
    song = await db.get(Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Only delete if uploaded by this user
    local_file = (song.extra_data or {}).get("local_file")
    if local_file:
        path = os.path.join(UPLOADS_DIR, local_file)
        if os.path.exists(path):
            os.remove(path)

    await db.delete(song)
    await db.commit()
    return {"deleted": song_id}
