/**
 * src/components/EmotionCamera.jsx
 * Webcam-based emotion detection panel.
 * Captures frames → sends to backend via WS → shows detected emotion live.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Webcam from "react-webcam";
import { Camera, CameraOff, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useEmotionStore, EMOTION_COLORS, EMOTION_EMOJI } from "../store";
import { useWebSocket } from "../hooks/useWebSocket";
import { clsx } from "clsx";

const EMOTION_LABELS = {
  happy: "Happy", sad: "Sad", angry: "Angry",
  fear: "Fearful", surprise: "Surprised", disgust: "Disgusted", neutral: "Neutral",
};

export default function EmotionCamera({ onRecommendations }) {
  const webcamRef = useRef(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);

  const { currentEmotion, confidence, scores, faceDetected, isDetecting, setDetecting } =
    useEmotionStore();

  const { status, connect, disconnect, startStreaming, stopStreaming, wsRecommendations } =
    useWebSocket();


  // When emotion changes, trigger parent to fetch recommendations
  const lastEmotionRef = useRef(null);
  useEffect(() => {
    if (!currentEmotion) return;
    if (currentEmotion === lastEmotionRef.current) return;
    lastEmotionRef.current = currentEmotion;
    onRecommendations?.(currentEmotion, true);
  }, [currentEmotion]);

  const captureFrame = useCallback(() => {
    return webcamRef.current?.getScreenshot?.() ?? null;
  }, []);

  const handleToggleCamera = async () => {
    if (!cameraEnabled) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setHasPermission(true);
        setCameraEnabled(true);

        const token = localStorage.getItem("access_token");
        connect(token);

        setTimeout(() => {
          startStreaming(captureFrame);
          setDetecting(true);
        }, 500);
      } catch {
        setHasPermission(false);
      }
    } else {
      stopStreaming();
      disconnect();
      setCameraEnabled(false);
      setDetecting(false);
    }
  };

  const emotionColor = currentEmotion ? EMOTION_COLORS[currentEmotion] : null;

  return (
    <div className="card flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg text-text-primary">
            Emotion Sensor
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time facial expression analysis
          </p>
        </div>
        <WSStatusBadge status={status} />
      </div>

      {/* Camera Feed */}
      <div
        className="relative rounded-xl overflow-hidden bg-panel aspect-video flex items-center justify-center"
        style={{
          border: emotionColor
            ? `1px solid ${emotionColor.border}40`
            : "1px solid var(--border)",
          boxShadow: emotionColor
            ? `0 0 30px ${emotionColor.border}20`
            : "none",
          transition: "border-color 0.5s, box-shadow 0.5s",
        }}
      >
        <AnimatePresence>
          {cameraEnabled ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.6}
                videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Scanning overlay */}
              {isDetecting && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neon-lime animate-pulse" />
                    <span className="text-xs font-mono text-neon-lime">LIVE</span>
                  </div>
                  {!faceDetected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-xs text-text-secondary bg-surface/70 px-3 py-1.5 rounded-full backdrop-blur-sm">
                        No face detected
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-text-ghost"
            >
              <Camera size={40} strokeWidth={1} />
              <p className="text-sm">Camera is off</p>
              {hasPermission === false && (
                <p className="text-xs text-red-400">Camera permission denied</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggleCamera}
        className={clsx(
          "flex items-center justify-center gap-2 w-full py-3 rounded-xl font-display font-semibold text-sm transition-all duration-200",
          cameraEnabled
            ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
            : "btn-primary"
        )}
      >
        {cameraEnabled ? (
          <><CameraOff size={16} /> Stop Sensor</>
        ) : (
          <><Camera size={16} /> Start Sensor</>
        )}
      </button>

      {/* Emotion Display */}
      <AnimatePresence mode="wait">
        {currentEmotion && (
          <motion.div
            key={currentEmotion}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl p-4 border transition-all duration-500"
            style={{
              backgroundColor: emotionColor.bg,
              borderColor: `${emotionColor.border}40`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{EMOTION_EMOJI[currentEmotion]}</span>
                <div>
                  <p className="font-display font-semibold text-base" style={{ color: emotionColor.text }}>
                    {EMOTION_LABELS[currentEmotion]}
                  </p>
                  <p className="text-xs text-text-secondary font-mono">
                    {(confidence * 100).toFixed(1)}% confidence
                  </p>
                </div>
              </div>
              <AudioWave color={emotionColor.border} />
            </div>

            {/* Score bars */}
            <div className="space-y-1.5">
              {Object.entries(scores)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([em, score]) => (
                  <ScoreBar
                    key={em}
                    label={EMOTION_LABELS[em] || em}
                    score={score}
                    active={em === currentEmotion}
                    color={EMOTION_COLORS[em]?.border ?? "#6366f1"}
                  />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WSStatusBadge({ status }) {
  const map = {
    connected:    { icon: Wifi,    label: "Live",         cls: "text-neon-lime" },
    connecting:   { icon: Loader2, label: "Connecting…",  cls: "text-yellow-400 animate-spin" },
    disconnected: { icon: WifiOff, label: "Offline",      cls: "text-text-ghost" },
    error:        { icon: WifiOff, label: "Error",        cls: "text-red-400" },
  };
  const { icon: Icon, label, cls } = map[status] ?? map.disconnected;
  return (
    <span className={clsx("flex items-center gap-1.5 text-xs font-mono", cls)}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ScoreBar({ label, score, active, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs text-text-secondary truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: active ? color : "#2a2a4a" }}
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-xs font-mono text-text-secondary text-right">
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function AudioWave({ color }) {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {[0, 80, 160, 240, 320].map((delay) => (
        <div
          key={delay}
          className="wave-bar h-full"
          style={{
            "--delay": `${delay}ms`,
            backgroundColor: color,
            width: "3px",
          }}
        />
      ))}
    </div>
  );
}
