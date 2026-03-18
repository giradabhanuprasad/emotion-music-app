"""
app/api/v1/voice_emotion.py

Voice Emotion Analysis endpoint.
Receives a base64-encoded WebM/WAV audio clip from the browser,
extracts 40+ professional audio features using librosa, and
returns emotion probability scores.

Features extracted:
  - 13 MFCCs + their deltas + delta-deltas  (39 features)
  - Spectral centroid (brightness)
  - Spectral rolloff  (energy distribution)
  - Spectral bandwidth
  - Spectral flatness (tone vs noise)
  - Zero-crossing rate
  - RMS energy
  - Fundamental frequency (F0) via pyin
  - Pitch variation (jitter — emotional arousal indicator)
  - Harmonics-to-noise ratio (voice quality)

Emotion mapping is based on:
  - Angry   : high energy, high F0, high ZCR, low HNR (harsh)
  - Happy   : high energy, high-mid F0, high spectral centroid (bright)
  - Sad     : low energy, low F0, low ZCR, low spectral centroid
  - Fear    : high ZCR, high pitch variation, mid-high F0
  - Disgust : low-mid F0, low spectral centroid, flat intonation
  - Surprise: sudden high F0 spike, high spectral centroid, high energy
  - Neutral : mid energy, mid F0, low variation
"""

import base64
import io
import logging
import tempfile
import os
from typing import Dict

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_active_user
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Voice Emotion"])


class VoiceEmotionRequest(BaseModel):
    audio_base64: str   # base64-encoded WebM or WAV audio blob
    sample_rate: int = 44100


class VoiceEmotionResponse(BaseModel):
    emotion: str
    scores: Dict[str, float]
    pitch_hz: float
    energy: float
    zcr: float
    confidence: float


# ── Feature Extraction ────────────────────────────────────────────────────────

def extract_features(y: np.ndarray, sr: int) -> Dict[str, float]:
    """
    Extract 40+ audio features from a waveform using librosa.
    Returns a flat dict of named features.
    """
    features = {}

    # ── 1. RMS Energy ─────────────────────────────────────────────────────────
    rms = float(np.sqrt(np.mean(y ** 2)))
    features["rms"] = rms

    # ── 2. Zero-Crossing Rate ─────────────────────────────────────────────────
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
    features["zcr"] = zcr

    # ── 3. MFCCs (13 coefficients + deltas) ───────────────────────────────────
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_delta  = librosa.feature.delta(mfcc)
    mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
    for i in range(13):
        features[f"mfcc_{i}"]        = float(np.mean(mfcc[i]))
        features[f"mfcc_delta_{i}"]  = float(np.mean(mfcc_delta[i]))
        features[f"mfcc_delta2_{i}"] = float(np.mean(mfcc_delta2[i]))

    # ── 4. Spectral Features ──────────────────────────────────────────────────
    spec_centroid  = librosa.feature.spectral_centroid(y=y, sr=sr)
    spec_rolloff   = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
    spec_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    spec_flatness  = librosa.feature.spectral_flatness(y=y)

    features["spectral_centroid"]  = float(np.mean(spec_centroid))
    features["spectral_rolloff"]   = float(np.mean(spec_rolloff))
    features["spectral_bandwidth"] = float(np.mean(spec_bandwidth))
    features["spectral_flatness"]  = float(np.mean(spec_flatness))

    # ── 5. Chroma Features (pitch class energy) ───────────────────────────────
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features["chroma_mean"] = float(np.mean(chroma))
    features["chroma_std"]  = float(np.std(chroma))

    # ── 6. Fundamental Frequency (F0) via pyin ────────────────────────────────
    try:
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"),   # ~65 Hz — low male voice
            fmax=librosa.note_to_hz("C6"),       # ~1047 Hz — high female voice
            sr=sr
        )
        voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]
        if len(voiced_f0) > 2:
            features["f0_mean"]    = float(np.mean(voiced_f0))
            features["f0_std"]     = float(np.std(voiced_f0))    # pitch jitter
            features["f0_range"]   = float(np.ptp(voiced_f0))    # pitch range
            features["voiced_ratio"] = float(np.sum(voiced_flag) / len(voiced_flag))
        else:
            features["f0_mean"]    = 0.0
            features["f0_std"]     = 0.0
            features["f0_range"]   = 0.0
            features["voiced_ratio"] = 0.0
    except Exception:
        features["f0_mean"]    = 0.0
        features["f0_std"]     = 0.0
        features["f0_range"]   = 0.0
        features["voiced_ratio"] = 0.0

    # ── 7. Tempo / Rhythm ─────────────────────────────────────────────────────
    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        features["tempo"] = float(tempo)
    except Exception:
        features["tempo"] = 0.0

    return features


def classify_emotion(feat: Dict[str, float]) -> Dict[str, float]:
    """
    Rule-based emotion classifier using extracted librosa features.
    Based on established speech emotion recognition literature.

    Returns normalized probability scores for 7 emotions.
    """
    rms      = feat.get("rms", 0)
    zcr      = feat.get("zcr", 0)
    f0       = feat.get("f0_mean", 0)
    f0_std   = feat.get("f0_std", 0)       # pitch jitter = emotional arousal
    f0_range = feat.get("f0_range", 0)     # pitch range = expressiveness
    sc       = feat.get("spectral_centroid", 0)
    sf       = feat.get("spectral_flatness", 0)
    voiced   = feat.get("voiced_ratio", 0)
    mfcc1    = feat.get("mfcc_1", 0)       # overall timbral energy
    mfcc2    = feat.get("mfcc_2", 0)       # spectral shape

    # ── Normalize features to 0-1 using empirical voice ranges ───────────────
    e  = min(rms / 0.25, 1.0)                        # energy
    z  = min(zcr / 0.20, 1.0)                        # ZCR
    v  = min(voiced, 1.0)                            # voiced ratio
    sc_n = min(sc / 3000.0, 1.0)                     # spectral centroid (Hz)
    sf_n = min(sf / 0.5, 1.0)                        # spectral flatness

    # Pitch zones — normalized 0–1 within each emotion's expected F0 range
    def pitch_zone(f0, lo, hi):
        """Bell curve score for pitch in zone [lo, hi] Hz"""
        if f0 <= 0: return 0.0
        center = (lo + hi) / 2.0
        half   = (hi - lo) / 2.0
        return max(0.0, 1.0 - abs(f0 - center) / half)

    p_low     = pitch_zone(f0,  80,  160)   # sad, calm
    p_lowmid  = pitch_zone(f0, 120,  200)   # neutral, disgust
    p_mid     = pitch_zone(f0, 160,  260)   # angry
    p_highmid = pitch_zone(f0, 200,  320)   # happy
    p_high    = pitch_zone(f0, 270,  420)   # fear, surprise

    # Pitch variation (jitter): high = emotional / expressive
    jitter = min(f0_std / 50.0, 1.0)
    p_range_n = min(f0_range / 200.0, 1.0)

    # ── Emotion scoring ───────────────────────────────────────────────────────
    raw = {
        # ANGRY: high energy + mid pitch + high ZCR + tense (low flatness)
        "angry":    p_mid     * 0.30 + e * 0.40 + z * 0.20 + (1 - sf_n) * 0.10,

        # HAPPY: high-mid pitch + bright (high SC) + moderate energy + variable pitch
        "happy":    p_highmid * 0.35 + sc_n * 0.25 + e * 0.25 + jitter * 0.15,

        # SAD: low pitch + low energy + low ZCR + monotone (low jitter)
        "sad":      p_low     * 0.35 + (1 - e) * 0.30 + (1 - z) * 0.20 + (1 - jitter) * 0.15,

        # FEAR: high pitch + HIGH jitter (trembling) + high ZCR + breathy
        "fear":     p_high    * 0.30 + jitter * 0.35 + z * 0.25 + sf_n * 0.10,

        # DISGUST: low-mid pitch + moderate energy + flat intonation + low SC
        "disgust":  p_lowmid  * 0.35 + (1 - sc_n) * 0.25 + (1 - jitter) * 0.25 + (1 - z) * 0.15,

        # SURPRISE: high pitch RANGE + sudden high SC + high energy + high jitter
        "surprise": p_high    * 0.30 + p_range_n * 0.30 + sc_n * 0.25 + e * 0.15,

        # NEUTRAL: mid features, low variation, steady voiced speech
        "neutral":  p_lowmid  * 0.25 + v * 0.25 + (1 - jitter) * 0.25 + (1 - sf_n) * 0.25,
    }

    # Normalize to sum = 1
    total = sum(raw.values()) or 1.0
    return {k: round(v / total, 4) for k, v in raw.items()}


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/voice-emotion", response_model=VoiceEmotionResponse)
async def analyze_voice_emotion(
    request: VoiceEmotionRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Analyze voice emotion from a base64-encoded audio clip.
    Uses librosa to extract professional audio features.
    """
    try:
        import librosa
        import soundfile as sf
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="librosa not installed. Run: pip install librosa soundfile"
        )

    # ── Decode base64 audio ───────────────────────────────────────────────────
    try:
        audio_bytes = base64.b64decode(request.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")

    # ── Save to temp file and load with librosa ───────────────────────────────
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # librosa handles WebM/WAV/OGG via soundfile + ffmpeg fallback
        y, sr = librosa.load(tmp_path, sr=22050, mono=True, duration=5.0)

        if len(y) < sr * 0.5:  # less than 0.5 seconds — too short
            raise HTTPException(status_code=400, detail="Audio clip too short (need ≥ 0.5s)")

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(f"Audio load error: {ex}")
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {str(ex)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    # ── Extract features ──────────────────────────────────────────────────────
    try:
        features = extract_features(y, sr)
    except Exception as ex:
        logger.error(f"Feature extraction error: {ex}")
        raise HTTPException(status_code=500, detail="Feature extraction failed")

    # ── Classify emotion ──────────────────────────────────────────────────────
    scores   = classify_emotion(features)
    dominant = max(scores, key=scores.get)

    # Confidence = score of dominant emotion (higher = more certain)
    confidence = round(scores[dominant], 4)

    return VoiceEmotionResponse(
        emotion=dominant,
        scores=scores,
        pitch_hz=round(features.get("f0_mean", 0), 1),
        energy=round(features.get("rms", 0), 4),
        zcr=round(features.get("zcr", 0), 4),
        confidence=confidence,
    )
