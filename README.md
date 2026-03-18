# 🎵 EmotiTune — Emotion-Aware Music Recommendation System

> Real-time multimodal emotion detection that plays music matching how you **actually feel right now**

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![React](https://img.shields.io/badge/React-18-61DAFB)
![EfficientNet](https://img.shields.io/badge/EfficientNet--B3-74.3%25-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📌 About

EmotiTune is a full-stack real-time music recommendation platform that detects your emotional state through four channels — **facial expression**, **voice tone**, **weather**, and **time of day** — and recommends songs that match your current mood, not just your listening history.

---

## ✨ Features

- 🎭 **Facial Emotion Recognition** — EfficientNet-B3 trained on FER-2013 (74.3% accuracy)
- 🎙️ **Voice Emotion Analysis** — librosa pipeline with 40+ features and pyin F0 pitch detection
- 🌦️ **Weather Context** — Open-Meteo API maps weather conditions to mood
- 🕐 **Time of Day** — Activity-based emotional priors
- 🔀 **Weighted Fusion** — Face 50% + Voice 30% + Weather 10% + Time 10%
- 🤖 **DistilBERT Recommendations** — Semantic song ranking across genre, energy, and rhythm
- ⚡ **Under 2 seconds** — Full end-to-end on CPU, no GPU needed
- 🔴 **Live Streaming** — WebSocket-based real-time updates

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Zustand, WebSocket |
| Backend | FastAPI, Python 3.11, PostgreSQL |
| Face Model | EfficientNet-B3, FER-2013, PyTorch |
| Voice Model | librosa, pyin, MFCC |
| Recommendation | DistilBERT, iTunes Search API |
| Deployment | Docker, Nginx |

---

## 📁 Project Structure

```
emotion-music-app/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── voice_emotion.py
│   │   │   ├── recommendations.py
│   │   │   └── websocket.py
│   │   └── ml/
│   │       ├── emotion_detector.py
│   │       └── music_recommender.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/Dashboard.jsx
│       ├── hooks/useWebSocket.js
│       └── hooks/useVoiceEmotion.js
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11
- Node.js 18+
- PostgreSQL

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Using Docker
```bash
docker-compose up --build
```

---

## 🧠 Model Performance

| Model | Accuracy | Val Loss | Parameters |
|-------|----------|----------|------------|
| ResNet-50 (Baseline) | 60.7% | 1.105 | 25.6 M |
| EfficientNet-B3 V2 | 69.8% | 0.921 | 12.2 M |
| EfficientNet-B3 V3 (Ours) | **74.3%** | **0.784** | **12.2 M** |

### Multimodal Fusion Ablation

| Configuration | Accuracy |
|---------------|----------|
| Camera only | 59.8% |
| Camera + Voice | 68.4% |
| Full 4-channel | **74.3%** |

---

## ⚡ System Latency (CPU, no GPU)

| Operation | Mean | P95 |
|-----------|------|-----|
| EfficientNet-B3 inference | 150–350 ms | < 500 ms |
| Voice librosa pipeline | 400–700 ms | < 950 ms |
| DistilBERT recommendation | 200–400 ms | < 600 ms |
| **End-to-end total** | **< 2,000 ms** | **< 2,500 ms** |

---

## 🎭 Emotion to Music Mapping

| Emotion | Genres |
|---------|--------|
| Happy | Pop, Dance, Reggae |
| Sad | Blues, Acoustic, Soul |
| Angry | Rock, Metal, Punk |
| Neutral | Classical, Jazz, Chillout |
| Fear | Ambient, Classical |
| Surprise | Electronic, Jazz |
| Disgust | Grunge, Hardcore |

---

## 📄 Research Paper

This project is documented as an IEEE conference paper:

**"EmotiTune: Real-Time Multimodal Emotion-Aware Music Recommendation System Using EfficientNet-B3, Librosa Pitch Analysis, and DistilBERT Fusion"**

---

## 👨‍💻 Author

**Girada Bhanu Prasad **  
Department of Artificial Intelligence and Machine Learning  
Dhanalakshmi Srinivasan University — Batch 2023–2027

---

## 📝 License

This project is licensed under the MIT License.
