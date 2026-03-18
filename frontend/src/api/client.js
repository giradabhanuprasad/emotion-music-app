/**
 * src/api/client.js
 * Axios instance configured with JWT injection and automatic token refresh.
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach access token ──────────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setTokens(data.access_token, data.refresh_token);
        refreshQueue.forEach((p) => p.resolve(data.access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return client(original);
      } catch (refreshError) {
        refreshQueue.forEach((p) => p.reject(refreshError));
        refreshQueue = [];
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Token helpers ─────────────────────────────────────────────────────────────
export function setTokens(access, refresh) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// ── API methods ───────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => client.post("/auth/register", data),
  login: (data) => client.post("/auth/login", data),
  refresh: (data) => client.post("/auth/refresh", data),
  me: () => client.get("/auth/me"),
};

export const emotionAPI = {
  detectBase64: (data) => client.post("/emotions/detect", data),
  detectUpload: (file, sessionId) => {
    const form = new FormData();
    form.append("file", file);
    if (sessionId) form.append("session_id", sessionId);
    return client.post("/emotions/detect/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  history: (params) => client.get("/emotions/history", { params }),
};

export const songAPI = {
  list: (params) => client.get("/songs/", { params }),
  get: (id) => client.get(`/songs/${id}`),
  create: (data) => client.post("/songs/", data),
  delete: (id) => client.delete(`/songs/${id}`),
};

export const recommendationAPI = {
  get: (data) => client.post("/recommendations/", data),
  rate: (id, rating) => client.patch(`/recommendations/${id}/rate`, { rating }),
  history: (params) => client.get("/recommendations/history", { params }),
};

export default client;
