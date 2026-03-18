/**
 * src/hooks/useWebSocket.js
 * WebSocket hook that connects to the EmotiTune WS session endpoint,
 * sends camera frames, and dispatches emotion + recommendation updates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useEmotionStore } from "../store";

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws/session`;
const FRAME_INTERVAL_MS = 1500; // send frame every 1.5 s

export function useWebSocket() {
  const wsRef = useRef(null);
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected | error
  const [sessionId, setSessionId] = useState(null);
  const [wsRecommendations, setWsRecommendations] = useState([]);
  const frameTimerRef = useRef(null);
  const { setEmotion } = useEmotionStore();

  const connect = useCallback((token) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      startHeartbeat(ws);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        switch (msg.type) {
          case "connected":
            setSessionId(msg.data.session_id);
            break;

          case "emotion":
            setEmotion(
              msg.data.emotion,
              msg.data.confidence,
              msg.data.scores,
              msg.data.face_detected
            );
            break;

          case "recommendation":
            setWsRecommendations(msg.data.songs ?? []);
            break;

          case "error":
            console.error("[WS] Error:", msg.data.message);
            break;

          default:
            break;
        }
      } catch (e) {
        console.error("[WS] parse error", e);
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      setStatus("disconnected");
      clearInterval(frameTimerRef.current);
    };
  }, [setEmotion]);

  const disconnect = useCallback(() => {
    clearInterval(frameTimerRef.current);
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "close", data: {} }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendFrame = useCallback((base64Image) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "frame", data: { image: base64Image } }));
    }
  }, []);

  const startStreaming = useCallback((getFrame) => {
    clearInterval(frameTimerRef.current);
    frameTimerRef.current = setInterval(async () => {
      const frame = await getFrame();
      if (frame) sendFrame(frame);
    }, FRAME_INTERVAL_MS);
  }, [sendFrame]);

  const stopStreaming = useCallback(() => {
    clearInterval(frameTimerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(frameTimerRef.current);
    wsRef.current?.close();
  }, []);

  return {
    status,
    sessionId,
    wsRecommendations,
    connect,
    disconnect,
    sendFrame,
    startStreaming,
    stopStreaming,
  };
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
function startHeartbeat(ws, interval = 25_000) {
  const id = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "heartbeat", data: {} }));
    } else {
      clearInterval(id);
    }
  }, interval);
}
