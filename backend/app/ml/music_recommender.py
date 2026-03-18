"""
app/ml/music_recommender.py

Emotion → Music recommendation pipeline.

Strategy (as per the paper):
1.  BERT encodes song lyrics → 768-d semantic embedding stored in DB.
2.  At inference, we retrieve the top-N songs whose emotion_tags match
    the detected emotion, then re-rank by cosine similarity between
    the BERT embedding of the emotion label and each song's stored embedding.
3.  Additional heuristic filters (tempo, valence) refine the ranking
    for perceptual alignment.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.spatial.distance import cosine

logger = logging.getLogger(__name__)

# ── Emotion → Musical Attribute Mapping (from Table I in the paper) ───────────
EMOTION_GENRE_MAP: Dict[str, List[str]] = {
    "angry":   ["rock", "metal", "punk"],
    "disgust": ["grunge", "hardcore", "industrial"],
    "fear":    ["ambient", "experimental", "classical"],
    "happy":   ["pop", "dance", "reggae", "indie"],
    "sad":     ["blues", "acoustic", "soul"],
    "surprise":["electronic", "experimental", "jazz"],
    "neutral": ["classical", "jazz", "chillout"],
}

# Target audio features per emotion
EMOTION_FEATURE_TARGETS: Dict[str, Dict[str, Tuple[float, float]]] = {
    # emotion: {feature: (target_value, weight)}
    "angry":   {"energy": (0.85, 1.0), "valence": (0.25, 0.6), "tempo_bpm": (140, 0.4)},
    "disgust": {"energy": (0.75, 0.8), "valence": (0.20, 0.7)},
    "fear":    {"energy": (0.30, 0.9), "valence": (0.20, 0.8), "tempo_bpm": (70, 0.3)},
    "happy":   {"energy": (0.80, 0.8), "valence": (0.85, 1.0), "danceability": (0.75, 0.6)},
    "sad":     {"energy": (0.25, 0.8), "valence": (0.20, 1.0), "acousticness": (0.70, 0.5)},
    "surprise":{"energy": (0.70, 0.7), "valence": (0.60, 0.6)},
    "neutral": {"energy": (0.45, 0.5), "valence": (0.50, 0.5)},
}

# Singleton BERT model
_bert_tokenizer = None
_bert_model = None
_bert_device = None


def _load_bert(model_name: str = "bert-base-uncased") -> None:
    """Lazy-load BERT tokenizer + model (CPU-only for inference)."""
    global _bert_tokenizer, _bert_model, _bert_device

    if _bert_tokenizer is not None:
        return

    try:
        import torch
        from transformers import BertModel, BertTokenizer

        _bert_device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Loading BERT model: %s on %s", model_name, _bert_device)
        _bert_tokenizer = BertTokenizer.from_pretrained(model_name)
        _bert_model = BertModel.from_pretrained(model_name)
        _bert_model.eval()
        _bert_model.to(_bert_device)
        logger.info("BERT loaded successfully.")
    except Exception as exc:
        logger.warning("BERT load failed (%s) — using random embeddings.", exc)


def embed_text(text: str) -> List[float]:
    """
    Return a 768-d BERT [CLS] embedding for `text`.
    Falls back to a zero vector if BERT is unavailable.
    """
    _load_bert()
    if _bert_tokenizer is None:
        return [0.0] * 768

    import torch

    tokens = _bert_tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    ).to(_bert_device)

    with torch.no_grad():
        output = _bert_model(**tokens)

    cls_vec = output.last_hidden_state[:, 0, :].squeeze().cpu()
    return cls_vec.tolist()


# ── Scoring Functions ─────────────────────────────────────────────────────────

def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """1 - cosine distance, clamped to [0,1]."""
    try:
        arr_a, arr_b = np.array(a), np.array(b)
        if arr_a.sum() == 0 or arr_b.sum() == 0:
            return 0.0
        return float(1.0 - cosine(arr_a, arr_b))
    except Exception:
        return 0.0


def _audio_feature_score(song: Dict[str, Any], emotion: str) -> float:
    """Weighted score based on how closely song audio features match emotion targets."""
    targets = EMOTION_FEATURE_TARGETS.get(emotion, {})
    if not targets:
        return 0.5

    score, total_weight = 0.0, 0.0
    for feature, (target, weight) in targets.items():
        value = song.get(feature)
        if value is None:
            continue
        if feature == "tempo_bpm":
            # normalise: penalise if >40 BPM off target
            diff = abs(value - target) / 200.0
        else:
            diff = abs(value - target)
        score += weight * max(0.0, 1.0 - diff)
        total_weight += weight

    return score / total_weight if total_weight > 0 else 0.5


def rank_songs(
    emotion: str,
    song_records: List[Dict[str, Any]],
    emotion_embedding: Optional[List[float]] = None,
    top_n: int = 500,
) -> List[Dict[str, Any]]:
    """
    Rank `song_records` for `emotion`.

    Each record is expected to be a dict (or ORM model serialised to dict) with:
        id, title, artist, emotion_tags, lyrics_embedding,
        energy, valence, danceability, acousticness, tempo_bpm, ...

    Returns the top-N records sorted by composite score (descending),
    with an added `_recommendation_score` field.
    """
    if emotion_embedding is None:
        emotion_embedding = embed_text(emotion)

    target_genres = set(EMOTION_GENRE_MAP.get(emotion, []))
    scored = []

    for song in song_records:
        # ── 1. Genre / emotion tag match (0 or 1) ────────────────────────────
        song_genres = {g.lower() for g in (song.get("subgenres") or [])}
        song_genre  = (song.get("genre") or "").lower()
        song_genres.add(song_genre)
        genre_match = float(bool(target_genres & song_genres))

        # ── 2. BERT semantic similarity ───────────────────────────────────────
        lyric_emb = song.get("lyrics_embedding") or []
        semantic_score = _cosine_similarity(emotion_embedding, lyric_emb) if lyric_emb else 0.0

        # ── 3. Audio feature score ─────────────────────────────────────────────
        audio_score = _audio_feature_score(song, emotion)

        # ── 4. Emotion tag direct match boost ────────────────────────────────
        song_emotion_tags = [t.lower() for t in (song.get("emotion_tags") or [])]
        emotion_tag_match = 1.0 if emotion.lower() in song_emotion_tags else 0.0

        # ── 5. Composite (weights tuned empirically) ──────────────────────────
        # emotion_tag_match gets a strong boost so uploaded songs always appear
        composite = (
            0.40 * emotion_tag_match
            + 0.25 * genre_match
            + 0.20 * semantic_score
            + 0.15 * audio_score
        )

        scored.append({**song, "_recommendation_score": round(composite, 4)})

    scored.sort(key=lambda s: s["_recommendation_score"], reverse=True)
    return scored[:top_n]


def explain_recommendation(song: Dict[str, Any], emotion: str) -> str:
    """Generate a short human-readable reason for the recommendation."""
    genre = song.get("genre") or "this track"
    titles = {
        "happy":   f"This uplifting {genre} track matches your happy mood 🎉",
        "sad":     f"A soulful {genre} piece to accompany your reflective moment 🎵",
        "angry":   f"Channel that energy with this high-octane {genre} track 🔥",
        "fear":    f"This atmospheric {genre} track creates a calming ambience 🌙",
        "surprise":f"Something unexpected — a {genre} gem to match your surprised state ✨",
        "disgust": f"An intense {genre} track to express what words can't 🎸",
        "neutral": f"A balanced {genre} selection for your current mood 🎧",
    }
    return titles.get(emotion, f"A curated {genre} track for you.")
