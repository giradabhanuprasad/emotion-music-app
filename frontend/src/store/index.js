/**
 * src/store/index.js
 * Zustand stores for authentication, emotion state, and music player.
 */

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import { authAPI, clearTokens, setTokens } from "../api/client";

// ── Auth Store ────────────────────────────────────────────────────────────────
export const useAuthStore = create(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,

        login: async (email, password) => {
          set({ isLoading: true });
          try {
            const { data } = await authAPI.login({ email, password });
            setTokens(data.access_token, data.refresh_token);
            const { data: user } = await authAPI.me();
            set({ user, isAuthenticated: true, isLoading: false });
            return { ok: true };
          } catch (err) {
            set({ isLoading: false });
            return { ok: false, error: err.response?.data?.detail ?? "Login failed" };
          }
        },

        register: async (payload) => {
          set({ isLoading: true });
          try {
            await authAPI.register(payload);
            set({ isLoading: false });
            return { ok: true };
          } catch (err) {
            set({ isLoading: false });
            return { ok: false, error: err.response?.data?.detail ?? "Registration failed" };
          }
        },

        logout: () => {
          clearTokens();
          set({ user: null, isAuthenticated: false });
        },

        fetchMe: async () => {
          try {
            const { data } = await authAPI.me();
            set({ user: data, isAuthenticated: true });
          } catch {
            clearTokens();
            set({ user: null, isAuthenticated: false });
          }
        },
      }),
      { name: "emotitune-auth", partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
    ),
    { name: "AuthStore" }
  )
);

// ── Emotion Store ─────────────────────────────────────────────────────────────
export const EMOTION_COLORS = {
  happy:    { bg: "rgba(163,230,53,0.15)",  text: "#a3e635", border: "#a3e635" },
  sad:      { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa", border: "#60a5fa" },
  angry:    { bg: "rgba(239,68,68,0.15)",   text: "#f87171", border: "#f87171" },
  fear:     { bg: "rgba(168,85,247,0.15)",  text: "#c084fc", border: "#c084fc" },
  surprise: { bg: "rgba(34,211,238,0.15)",  text: "#22d3ee", border: "#22d3ee" },
  disgust:  { bg: "rgba(234,179,8,0.15)",   text: "#facc15", border: "#facc15" },
  neutral:  { bg: "rgba(148,163,184,0.15)", text: "#94a3b8", border: "#94a3b8" },
};

export const EMOTION_EMOJI = {
  happy: "😊", sad: "😢", angry: "😠", fear: "😨",
  surprise: "😲", disgust: "🤢", neutral: "😐",
};

export const useEmotionStore = create(
  devtools(
    (set) => ({
      currentEmotion: null,
      confidence: 0,
      scores: {},
      faceDetected: false,
      history: [],          // last 20 detections
      isDetecting: false,

      setEmotion: (emotion, confidence, scores, faceDetected) => {
        // Skip if no valid emotion returned
        if (!emotion) {
          set({ faceDetected: false });
          return;
        }
        set((s) => ({
          currentEmotion: emotion,
          confidence,
          scores,
          faceDetected,
          history: [{ emotion, confidence, ts: Date.now() }, ...s.history].slice(0, 20),
        }));
      },

      setDetecting: (v) => set({ isDetecting: v }),
      reset: () => set({ currentEmotion: null, confidence: 0, scores: {}, faceDetected: false }),
    }),
    { name: "EmotionStore" }
  )
);

// ── Player Store ──────────────────────────────────────────────────────────────
export const usePlayerStore = create(
  devtools(
    (set, get) => ({
      queue: [],           // SongPublic[]
      currentIndex: 0,
      isPlaying: false,
      volume: 0.8,
      emotion: null,       // emotion that generated this queue
      recommendations: [], // full RecommendationPublic[]

      setQueue: (songs, emotion) =>
        set({ queue: songs, currentIndex: 0, isPlaying: false, emotion }),

      setRecommendations: (recs) =>
        set({ recommendations: recs, queue: recs.map((r) => r.song) }),

      next: () =>
        set((s) => ({
          currentIndex: Math.min(s.currentIndex + 1, s.queue.length - 1),
          isPlaying: true,
        })),

      prev: () =>
        set((s) => ({
          currentIndex: Math.max(s.currentIndex - 1, 0),
          isPlaying: true,
        })),

      play: (index) => set({ currentIndex: index, isPlaying: true }),
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
      setVolume: (v) => set({ volume: v }),

      currentSong: () => {
        const { queue, currentIndex } = get();
        return queue[currentIndex] ?? null;
      },
    }),
    { name: "PlayerStore" }
  )
);
