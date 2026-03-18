# 🎵 EmotiTune — Emotion-Based Music Recommendation System

> A production-ready full-stack implementation of the paper:
> **"Emotion-Based Music Recommendation System Using Deep Learning"** (ICIDeA 2025)

---

## 📐 System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      Browser (React)                        │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────┐   │
│  │ EmotionCamera│  │  Recommendation│  │  MusicPlayer  │   │
│  │  (WebRTC)    │  │  Dashboard     │  │  (HTML5 Audio)│   │
│  └──────┬───────┘  └───────┬────────┘  └───────────────┘   │
│         │ WebSocket         │ REST API                      │
└─────────┼───────────────────┼────────────────────────────────┘
          │                   │
   ┌──────▼───────────────────▼──────────────────────┐
   │              Nginx Reverse Proxy                 │
   └──────┬────────────────────────────────┬──────────┘
          │ /ws/                           │ /api/v1/
   ┌──────▼──────────────────────────────────────────┐
   │              FastAPI Backend                    │
   │  ┌─────────────┐  ┌────────────────────────┐   │
   │  │  WebSocket  │  │  REST Endpoints         │   │
   │  │  Handler    │  │  auth / emotions        │   │
   │  │             │  │  songs / recommendations│   │
   │  └──────┬──────┘  └────────────┬───────────┘   │
   │         │                      │                │
   │  ┌──────▼──────────────────────▼───────────┐    │
   │  │             ML Pipeline                  │    │
   │  │  ┌─────────────────┐  ┌──────────────┐  │    │
   │  │  │ ResNet50V2      │  │ BERT Encoder │  │    │
   │  │  │ (Emotion Detect)│  │ (Song Embed) │  │    │
   │  │  └─────────────────┘  └──────────────┘  │    │
   │  └─────────────────────────────────────────┘    │
   └──────────────────┬──────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
   ┌────▼──────┐            ┌───────▼───┐
   │ PostgreSQL │            │   Redis   │
   │  (Primary) │            │  (Cache)  │
   └────────────┘            └───────────┘
```

---

## 🗂️ Folder Structure

```
emotion-music-app/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory + lifespan
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── models/
│   │   │   └── __init__.py      # User, Song, EmotionLog, Recommendation, ListeningSession
│   │   ├── schemas/
│   │   │   └── __init__.py      # Pydantic v2 request/response models
│   │   ├── core/
│   │   │   ├── config.py        # Settings via pydantic-settings
│   │   │   └── security.py      # JWT creation/verification, bcrypt hashing
│   │   ├── ml/
│   │   │   ├── emotion_detector.py   # ResNet50V2 inference pipeline
│   │   │   └── music_recommender.py  # BERT + audio feature ranking
│   │   └── api/
│   │       ├── deps.py          # JWT auth dependency, pagination
│   │       └── v1/
│   │           ├── auth.py          # Register, login, refresh, me
│   │           ├── emotions.py      # Frame-based + upload emotion detect
│   │           ├── songs.py         # Song CRUD + search
│   │           ├── recommendations.py # Emotion→music recommendations
│   │           └── websocket.py     # Real-time WS session handler
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # pytest test suite
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Router + auth guards
│   │   ├── main.jsx
│   │   ├── index.css            # Tailwind + custom CSS variables
│   │   ├── api/
│   │   │   └── client.js        # Axios instance + auto token refresh
│   │   ├── store/
│   │   │   └── index.js         # Zustand stores (auth, emotion, player)
│   │   ├── hooks/
│   │   │   └── useWebSocket.js  # WS connection + frame streaming
│   │   ├── components/
│   │   │   ├── EmotionCamera.jsx    # Webcam + live emotion UI
│   │   │   ├── MusicPlayer.jsx      # Bottom player bar
│   │   │   ├── RecommendationCard.jsx
│   │   │   └── Navbar.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       └── Dashboard.jsx        # Main app view
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── Dockerfile
├── nginx/nginx.conf             # Reverse proxy config
├── scripts/seed_songs.py        # DB seeder
├── docker-compose.yml           # Development
├── docker-compose.prod.yml      # Production
└── README.md
```

---

## 🗄️ Database Schema

```sql
users               → id, email, username, hashed_password, preferences, ...
songs               → id, title, artist, genre, subgenres[], emotion_tags[],
                      energy, valence, danceability, tempo_bpm, lyrics, lyrics_embedding[], ...
emotion_logs        → id, user_id→users, session_id, emotion, confidence, emotion_scores{}, ...
recommendations     → id, user_id→users, song_id→songs, emotion_log_id, emotion, score, reason, ...
listening_sessions  → id, user_id→users, session_token, is_active, current_emotion, ...
```

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | — | Create user |
| POST | `/api/v1/auth/login` | — | Get JWT tokens |
| POST | `/api/v1/auth/refresh` | — | Refresh tokens |
| GET | `/api/v1/auth/me` | ✓ | Get current user |
| POST | `/api/v1/emotions/detect` | ✓ | Detect from base64 |
| POST | `/api/v1/emotions/detect/upload` | ✓ | Detect from file upload |
| GET | `/api/v1/emotions/history` | ✓ | Emotion history |
| GET | `/api/v1/songs/` | ✓ | List / search songs |
| POST | `/api/v1/songs/` | ✓ | Add song |
| POST | `/api/v1/recommendations/` | ✓ | Get recommendations |
| PATCH | `/api/v1/recommendations/{id}/rate` | ✓ | Rate recommendation |
| WS | `/ws/session?token=<jwt>` | ✓ | Real-time session |

---

## 🚀 Quick Start

### Development (Docker Compose)

```bash
# 1. Clone + enter directory
git clone <repo> && cd emotion-music-app

# 2. Copy environment file
cp backend/.env.example backend/.env
# Edit SECRET_KEY and other values

# 3. Start all services
docker compose up --build

# 4. Seed sample songs (new terminal)
docker compose exec backend python scripts/seed_songs.py

# 5. Open browser
open http://localhost:80
```

### Local Development (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit DATABASE_URL to point at local postgres
uvicorn app.main:app --reload --port 8000

# Database migrations
alembic upgrade head

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app --cov-report=html

# Frontend tests  
cd frontend
npm run test
```

---

## 🤖 ML Pipeline

### Emotion Detection (ResNet50V2)
1. Webcam frame captured every **1.5 seconds**
2. OpenCV Haar Cascade detects and crops face
3. ResNet50V2 (fine-tuned on FER-2013) classifies into **7 emotions**
4. Emotion + confidence scores returned instantly

### Music Recommendation (BERT + Audio Features)
1. Detected emotion triggers the recommendation pipeline
2. BERT encodes emotion label → 768-d semantic vector
3. Candidate songs ranked by **composite score**:
   - `35%` genre/emotion tag match (Table I from paper)
   - `35%` BERT semantic similarity (song lyric embedding vs emotion)
   - `30%` audio feature alignment (energy, valence, tempo, danceability)
4. Top-N songs returned with human-readable reasons

### Emotion → Genre Mapping (from Paper Table I)

| Emotion | Recommended Genres |
|---------|-------------------|
| Angry | Rock, Metal, Punk |
| Disgust | Grunge, Hardcore, Industrial |
| Fear | Ambient, Experimental, Classical |
| Happy | Pop, Dance, Reggae, Indie |
| Sad | Blues, Acoustic, Soul |
| Surprise | Electronic, Experimental, Jazz |
| Neutral | Classical, Jazz, Chillout |

---

## 🔮 Future Improvements
- Multi-modal emotion detection (voice + physiological signals)
- Location/activity context (gym → high-energy, home → relaxing)
- Collaborative filtering layer on top of emotion-aware ranking
- Spotify API integration for real song streaming
- Fine-tune ResNet50V2 / BERT on domain-specific datasets
