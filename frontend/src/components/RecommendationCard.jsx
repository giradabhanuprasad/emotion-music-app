/**
 * src/components/RecommendationCard.jsx
 */

import { motion } from "framer-motion";
import { Play, Star, Music2 } from "lucide-react";
import { usePlayerStore } from "../store";
import { recommendationAPI } from "../api/client";
import toast from "react-hot-toast";

export default function RecommendationCard({ rec, index, emotion }) {
  const { play, setRecommendations, queue } = usePlayerStore();

  const handlePlay = () => {
    play(queue.findIndex((s) => s.id === rec.song.id));
  };

  const handleRate = async (rating) => {
    try {
      await recommendationAPI.rate(rec.id, rating);
      toast.success(`Rated ${rating}★`);
    } catch {
      toast.error("Could not save rating");
    }
  };

  const { song } = rec;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="glass-hover rounded-xl p-3 flex items-center gap-3 group cursor-pointer"
      onClick={handlePlay}
    >
      {/* Cover */}
      <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-panel border border-border">
        {song.cover_url ? (
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 size={16} className="text-text-ghost" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play size={16} fill="white" className="text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-semibold text-text-primary truncate leading-tight">
          {song.title}
        </p>
        <p className="text-xs text-text-secondary truncate mt-0.5">{song.artist}</p>
        {rec.reason && (
          <p className="text-xs text-text-ghost truncate mt-0.5 italic">{rec.reason}</p>
        )}
      </div>

      {/* Score + rating */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-xs font-mono text-accent-light">
          {(rec.score * 100).toFixed(0)}%
        </span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={(e) => { e.stopPropagation(); handleRate(star); }}
              className="text-text-ghost hover:text-yellow-400 transition-colors"
            >
              <Star size={10} fill="none" />
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function RecommendationSkeleton() {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3 animate-pulse">
      <div className="w-12 h-12 rounded-lg bg-panel shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-panel rounded w-3/4" />
        <div className="h-2.5 bg-panel rounded w-1/2" />
      </div>
    </div>
  );
}
