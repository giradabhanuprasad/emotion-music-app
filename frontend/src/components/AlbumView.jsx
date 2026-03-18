/**
 * AlbumView.jsx — Shows all emotion albums and their songs
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Music2, Trash2, Play, ChevronRight } from "lucide-react";
import { getAlbums, clearAlbum, removeFromAlbum, EMOTION_ALBUM_NAMES } from "../store/albumStore";
import { usePlayerStore } from "../store";

export default function AlbumView({ open, onClose }) {
  const [albums, setAlbums] = useState({});
  const [activeEmotion, setActiveEmotion] = useState(null);
  const { play, setQueue } = usePlayerStore();

  useEffect(() => {
    if (open) setAlbums(getAlbums());
  }, [open]);

  const refresh = () => setAlbums(getAlbums());

  const playAlbum = (emotion) => {
    const songs = albums[emotion] || [];
    if (!songs.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setQueue(shuffled, emotion);
    play(0);
    onClose();
  };

  const handleRemove = (emotion, songId) => {
    removeFromAlbum(emotion, songId);
    refresh();
  };

  const handleClear = (emotion) => {
    clearAlbum(emotion);
    refresh();
    if (activeEmotion === emotion) setActiveEmotion(null);
  };

  const emotions = Object.keys(EMOTION_ALBUM_NAMES);
  const activeSongs = activeEmotion ? (albums[activeEmotion] || []) : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:50, backdropFilter:"blur(4px)" }} />

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type:"spring", damping:25, stiffness:280 }}
            style={{ position:"fixed", top:0, right:0, height:"100vh", width:"100%", maxWidth:"480px",
              background:"#0a0a14", borderLeft:"1px solid #1e1e38", zIndex:51,
              display:"flex", flexDirection:"column", overflow:"hidden" }}
          >
            {/* Header */}
            <div style={{ padding:"24px", borderBottom:"1px solid #1a1a2e", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <h2 style={{ color:"#fff", fontSize:"18px", fontWeight:"700", margin:0 }}>🎵 Emotion Albums</h2>
                <p style={{ color:"#475569", fontSize:"12px", margin:"4px 0 0" }}>Songs collected from your listening sessions</p>
              </div>
              <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#475569", cursor:"pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
              {/* Album grid */}
              {!activeEmotion && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"8px" }}>
                  {emotions.map(em => {
                    const meta = EMOTION_ALBUM_NAMES[em];
                    const count = (albums[em] || []).length;
                    return (
                      <motion.div key={em} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => count > 0 && setActiveEmotion(em)}
                        style={{ background: count > 0 ? meta.bg : "rgba(255,255,255,0.02)",
                          border:`1px solid ${count > 0 ? meta.color + "30" : "#1a1a2e"}`,
                          borderRadius:"14px", padding:"16px", cursor: count > 0 ? "pointer" : "default",
                          opacity: count > 0 ? 1 : 0.4, position:"relative" }}>
                        <div style={{ fontSize:"28px", marginBottom:"8px" }}>{meta.emoji}</div>
                        <p style={{ color: count > 0 ? meta.color : "#475569", fontWeight:"600", fontSize:"14px", margin:"0 0 2px" }}>{meta.name}</p>
                        <p style={{ color:"#475569", fontSize:"12px", margin:0 }}>{count} song{count !== 1 ? "s" : ""}</p>
                        {count > 0 && (
                          <div style={{ position:"absolute", top:"12px", right:"12px" }}>
                            <button onClick={e => { e.stopPropagation(); playAlbum(em); }}
                              style={{ background: meta.color + "22", border:"none", borderRadius:"8px", padding:"6px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                              <Play size={12} color={meta.color} fill={meta.color} />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Song list for active album */}
              {activeEmotion && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
                    <button onClick={() => setActiveEmotion(null)}
                      style={{ background:"transparent", border:"1px solid #2a2a4a", borderRadius:"8px", color:"#94a3b8", padding:"6px 12px", cursor:"pointer", fontSize:"12px" }}>
                      ← Back
                    </button>
                    <div style={{ flex:1 }}>
                      <h3 style={{ color:"#fff", fontSize:"15px", fontWeight:"600", margin:0 }}>
                        {EMOTION_ALBUM_NAMES[activeEmotion].emoji} {EMOTION_ALBUM_NAMES[activeEmotion].name}
                      </h3>
                      <p style={{ color:"#475569", fontSize:"11px", margin:0 }}>{activeSongs.length} songs</p>
                    </div>
                    <div style={{ display:"flex", gap:"6px" }}>
                      <button onClick={() => playAlbum(activeEmotion)}
                        style={{ background:"rgba(124,58,237,0.2)", border:"1px solid #7c3aed40", borderRadius:"8px", color:"#a78bfa", padding:"6px 12px", cursor:"pointer", fontSize:"12px", display:"flex", alignItems:"center", gap:"4px" }}>
                        <Play size={11} fill="#a78bfa" /> Shuffle Play
                      </button>
                      <button onClick={() => handleClear(activeEmotion)}
                        style={{ background:"rgba(248,113,113,0.1)", border:"1px solid #f8717130", borderRadius:"8px", color:"#f87171", padding:"6px 10px", cursor:"pointer", fontSize:"12px" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {activeSongs.length === 0 ? (
                    <p style={{ color:"#475569", fontSize:"13px", textAlign:"center", padding:"32px 0" }}>No songs yet</p>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {activeSongs.map((song, i) => (
                        <motion.div key={song.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.03 }}
                          style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 12px",
                            background:"rgba(255,255,255,0.03)", borderRadius:"10px", border:"1px solid #1a1a2e" }}>
                          <div style={{ width:"36px", height:"36px", borderRadius:"8px", overflow:"hidden", background:"#1a1a2e", flexShrink:0 }}>
                            {song.cover_url
                              ? <img src={song.cover_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                              : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><Music2 size={14} color="#334155" /></div>
                            }
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ color:"#e2e8f0", fontSize:"13px", fontWeight:"500", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{song.title}</p>
                            <p style={{ color:"#475569", fontSize:"11px", margin:0 }}>{song.artist}</p>
                          </div>
                          <button onClick={() => handleRemove(activeEmotion, song.id)}
                            style={{ background:"transparent", border:"none", color:"#334155", cursor:"pointer", padding:"4px" }}>
                            <X size={14} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
