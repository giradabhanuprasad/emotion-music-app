/**
 * src/components/MusicPlayer.jsx
 * Bottom music player bar with playback controls and song info.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music2,
} from "lucide-react";
import { usePlayerStore, EMOTION_COLORS, EMOTION_EMOJI } from "../store";
import { clsx } from "clsx";

export default function MusicPlayer({ onSongEnd }) {
  const audioRef = useRef(null);
  const {
    queue, currentIndex, isPlaying, volume, emotion,
    next, prev, togglePlay, setVolume, currentSong,
  } = usePlayerStore();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const song = currentSong();

  // Sync audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !song?.preview_url) return;
    audio.src = song.preview_url;
    if (isPlaying) audio.play().catch(() => {});
  }, [currentIndex, song]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    isPlaying ? audio.play().catch(() => {}) : audio.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) setProgress(audio.currentTime / (audio.duration || 1));
  };
  const handleLoadedMetadata = () => {
    setDuration(audioRef.current?.duration ?? 0);
  };
  const handleEnded = () => { if (onSongEnd) onSongEnd(); else next(); };

  const seekTo = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = ratio * audio.duration;
      setProgress(ratio);
    }
  };

  if (!song) return null;

  const emotionColor = emotion ? EMOTION_COLORS[emotion] : null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Progress bar */}
      <div
        className="h-0.5 w-full cursor-pointer bg-border"
        onClick={seekTo}
      >
        <motion.div
          className="h-full bg-accent"
          style={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <div
        className="flex items-center gap-4 px-6 py-4 border-t border-border"
        style={{ background: "rgba(8, 8, 16, 0.95)", backdropFilter: "blur(24px)" }}
      >
        {/* Song info */}
        <div className="flex items-center gap-3 w-56 shrink-0">
          {song.cover_url ? (
            <img src={song.cover_url} alt={song.title} className="w-11 h-11 rounded-lg object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-panel border border-border flex items-center justify-center">
              <Music2 size={18} className="text-text-ghost" />
            </div>
          )}
          <div className="truncate">
            <p className="text-sm font-display font-semibold text-text-primary truncate">{song.title}</p>
            <p className="text-xs text-text-secondary truncate">{song.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 flex items-center justify-center gap-5">
          <button onClick={prev} className="text-text-secondary hover:text-text-primary transition-colors">
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-all shadow-glow-violet"
          >
            {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
          </button>

          <button onClick={next} className="text-text-secondary hover:text-text-primary transition-colors">
            <SkipForward size={18} fill="currentColor" />
          </button>
        </div>

        {/* Volume + Emotion indicator */}
        <div className="flex items-center gap-4 w-56 shrink-0 justify-end">
          {emotion && (
            <span className="text-sm hidden md:block" title={`Current mood: ${emotion}`}>
              {EMOTION_EMOJI[emotion]}
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMuted(!muted)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              className="w-20 accent-violet-500 h-1 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
    </motion.div>
  );
}
