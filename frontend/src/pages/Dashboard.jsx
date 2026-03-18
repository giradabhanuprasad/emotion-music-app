import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Music2, Star, Zap, Radio } from "lucide-react";
import { useEmotionStore, usePlayerStore, EMOTION_EMOJI } from "../store";
import { recommendationAPI } from "../api/client";
import EmotionCamera from "../components/EmotionCamera";
import Navbar from "../components/Navbar";
import MusicPlayer from "../components/MusicPlayer";
import UploadModal from "../components/UploadModal";
import AlbumView from "../components/AlbumView";
import ContextPanel from "../components/ContextPanel";
import { addSongToAlbum } from "../store/albumStore";
import { useVoiceEmotion } from "../hooks/useVoiceEmotion";
import { useUserContext } from "../hooks/useContext";
import toast from "react-hot-toast";

const EMOTION_COLORS = {
  happy:   { accent:"#f59e0b", glow:"rgba(245,158,11,0.15)",  text:"#fbbf24" },
  sad:     { accent:"#3b82f6", glow:"rgba(59,130,246,0.15)",  text:"#60a5fa" },
  angry:   { accent:"#ef4444", glow:"rgba(239,68,68,0.15)",   text:"#f87171" },
  fear:    { accent:"#8b5cf6", glow:"rgba(139,92,246,0.15)",  text:"#a78bfa" },
  surprise:{ accent:"#ec4899", glow:"rgba(236,72,153,0.15)",  text:"#f472b6" },
  disgust: { accent:"#10b981", glow:"rgba(16,185,129,0.15)",  text:"#34d399" },
  neutral: { accent:"#64748b", glow:"rgba(100,116,139,0.15)", text:"#94a3b8" },
};

const EMOTION_LABELS = {
  happy:"Happy 😊", sad:"Sad 😢", angry:"Angry 😠",
  fear:"Fearful 😨", surprise:"Surprised 😲", disgust:"Disgusted 🤢", neutral:"Neutral 😐"
};

function SongCard({ rec, index, onPlay, isCurrentlyPlaying }) {
  const [rated, setRated] = useState(rec.user_rating || 0);
  const [hover, setHover] = useState(0);
  const handleRate = async (r) => { setRated(r); try { await recommendationAPI.rate(rec.id, r); } catch {} };

  return (
    <motion.div
      initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay: index * 0.03 }}
      onClick={() => onPlay(rec)}
      style={{
        display:"flex", alignItems:"center", gap:"12px",
        padding:"10px 12px", borderRadius:"12px", cursor:"pointer",
        background: isCurrentlyPlaying ? "rgba(255,255,255,0.08)" : "transparent",
        border: isCurrentlyPlaying ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
        transition:"all 0.2s",
      }}
      whileHover={{ background:"rgba(255,255,255,0.05)" }}
    >
      <span style={{ width:"20px", textAlign:"center", fontSize:"12px", color:"#444", flexShrink:0 }}>
        {isCurrentlyPlaying ? (
          <span style={{ display:"flex", gap:"2px", alignItems:"flex-end", height:"16px", justifyContent:"center" }}>
            {[1,2,3].map(i => (
              <motion.span key={i} style={{ width:"3px", background:"#34d399", borderRadius:"2px", display:"block" }}
                animate={{ height:["4px","14px","6px","12px","4px"] }}
                transition={{ duration:0.8, repeat:Infinity, delay:i*0.15 }} />
            ))}
          </span>
        ) : index + 1}
      </span>
      <div style={{ width:"44px", height:"44px", borderRadius:"8px", overflow:"hidden", background:"#1a1a2e", flexShrink:0 }}>
        {rec.song?.cover_url
          ? <img src={rec.song.cover_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><Music2 size={16} color="#333" /></div>
        }
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ margin:0, fontSize:"13px", fontWeight:600, color: isCurrentlyPlaying ? "#34d399" : "#e2e2f0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {rec.song?.title || "Unknown"}
        </p>
        <p style={{ margin:0, fontSize:"11px", color:"#555", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {rec.song?.artist || "Unknown Artist"}
        </p>
      </div>
      <span style={{ fontSize:"12px", fontWeight:700, color:"#34d399", width:"36px", textAlign:"right", flexShrink:0 }}>
        {Math.round((rec.score || 0) * 100)}%
      </span>
      <div style={{ display:"flex", gap:"2px", flexShrink:0 }} onClick={e => e.stopPropagation()}>
        {[1,2,3,4,5].map(s => (
          <button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => handleRate(s)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"2px" }}>
            <Star size={10} style={{ fill:(hover||rated)>=s?"#f59e0b":"transparent", color:(hover||rated)>=s?"#f59e0b":"#333" }} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { currentEmotion, scores } = useEmotionStore();
  const { setRecommendations, play, currentIndex, isPlaying } = usePlayerStore();
  const [recommendations, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("foryou");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);

  // ── Voice emotion ────────────────────────────────────────────────
  const { voiceEmotion, voiceScores, voiceEnergy, isListening, startListening, stopListening } = useVoiceEmotion();

  // ── Location / weather / time context ───────────────────────────
  const { location, weather, timeContext, locationError, loadingWeather, fetchLocation, getContextualEmotionWeights, activityHint } = useUserContext();

  // ── Blended emotion (camera 50% + voice 30% + weather+time 20%) ─
  const blendedEmotion = currentEmotion
    ? getContextualEmotionWeights(currentEmotion, voiceEmotion).dominant
    : voiceEmotion || null;

  const lastEmotionRef     = useRef(null);
  const lastVoiceRef       = useRef(null);
  const playedSongsRef     = useRef({});   // { emotion: Set<songId> }
  const songWasPlayingRef  = useRef(false);

  const ec = EMOTION_COLORS[currentEmotion] || EMOTION_COLORS.neutral;
  const emotionBars = Object.entries(scores || {}).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // ── Core fetch + shuffle + no-repeat ────────────────────────────
  const fetchRecommendations = useCallback(async (emotion, autoPlay = false) => {
    const em = emotion || currentEmotion || "neutral";
    setLoading(true);
    try {
      const { data } = await recommendationAPI.get({ emotion: em, limit: 500 });
      const allItems = data.items || [];

      if (!playedSongsRef.current[em]) playedSongsRef.current[em] = new Set();
      const played = playedSongsRef.current[em];

      let unplayed = allItems.filter(r => !played.has(r.song?.id));
      if (unplayed.length === 0) {
        playedSongsRef.current[em] = new Set();
        unplayed = allItems;
        toast("All songs played! Shuffling again 🔀", { duration: 2500 });
      }

      // Shuffle unplayed, push already-played to bottom
      const shuffled = [...unplayed].sort(() => Math.random() - 0.5);
      const pool = [...shuffled, ...allItems.filter(r => played.has(r.song?.id))];

      setRecs(pool);
      setRecommendations(pool);

      if (autoPlay && pool.length > 0) {
        const idx = shuffled.findIndex(r => r.song?.preview_url);
        const pickedIdx = idx >= 0 ? idx : 0;
        const picked = pool[pickedIdx];
        setTimeout(() => {
          play(pickedIdx);
          if (picked?.song?.id)  played.add(picked.song.id);
          if (picked?.song)      addSongToAlbum(em, picked.song);
          toast.success(`Playing for your ${em} mood 🎵`);
        }, 400);
      }
    } catch {
      toast.error("Could not fetch recommendations");
    } finally {
      setLoading(false);
    }
  }, [currentEmotion, setRecommendations, play]);

  // ── Camera emotion → fetch ───────────────────────────────────────
  useEffect(() => {
    if (!currentEmotion) return;
    if (currentEmotion === lastEmotionRef.current) return;
    lastEmotionRef.current = currentEmotion;
    // Small delay to let blended emotion compute
    setTimeout(() => {
      fetchRecommendations(currentEmotion, true);
    }, 200);
  }, [currentEmotion, fetchRecommendations]);

  // ── Voice emotion → fetch (only when camera is OFF) ─────────────
  useEffect(() => {
    if (!voiceEmotion) return;
    if (currentEmotion) return;           // camera has priority
    if (voiceEmotion === lastVoiceRef.current) return;
    lastVoiceRef.current = voiceEmotion;
    fetchRecommendations(voiceEmotion, true);
  }, [voiceEmotion, currentEmotion, fetchRecommendations]);

  // ── Called by MusicPlayer when a song finishes naturally ──────────
  const handleSongEnd = useCallback(() => {
    lastEmotionRef.current = null; // allow emotion re-detect
    const em = currentEmotion || blendedEmotion || "neutral";
    if (!playedSongsRef.current[em]) playedSongsRef.current[em] = new Set();
    const played = playedSongsRef.current[em];

    // Find next unplayed song after current index
    const nextIdx = recommendations.findIndex((r, i) =>
      i > currentIndex && r.song?.preview_url && !played.has(r.song?.id)
    );
    if (nextIdx >= 0) {
      setTimeout(() => {
        play(nextIdx);
        const s = recommendations[nextIdx];
        if (s?.song?.id) played.add(s.song.id);
        if (s?.song)     addSongToAlbum(em, s.song);
      }, 600);
    }
  }, [recommendations, currentIndex, currentEmotion, blendedEmotion, play]);

  // ── Manual song click ────────────────────────────────────────────
  const handlePlay = useCallback((rec) => {
    const idx = recommendations.findIndex(r => r.id === rec.id);
    if (idx < 0) return;
    play(idx);
    const em = currentEmotion || "neutral";
    if (!playedSongsRef.current[em]) playedSongsRef.current[em] = new Set();
    if (rec.song?.id) playedSongsRef.current[em].add(rec.song.id);
    if (rec.song)     addSongToAlbum(em, rec.song);
  }, [recommendations, play, currentEmotion]);

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#e2e2f0", display:"flex", flexDirection:"column" }}>
      <Navbar />

      <main style={{ flex:1, maxWidth:"1280px", margin:"0 auto", width:"100%", padding:"32px 24px 120px" }}>

        <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:"32px" }}>
          <h1 style={{ margin:"0 0 4px", fontSize:"22px", fontWeight:700, color:"#fff" }}>Your Music Dashboard</h1>
          <p style={{ margin:0, fontSize:"13px", color:"#444" }}>Music plays automatically when your emotion is detected</p>
        </motion.div>

        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"24px" }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

            {/* Camera */}
            <div style={{ background:"#0e0e1a", border:"1px solid #1e1e30", borderRadius:"16px", padding:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
                <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#34d399", display:"inline-block", boxShadow:"0 0 8px #34d399" }} />
                <span style={{ fontSize:"13px", color:"#888", fontWeight:500 }}>Emotion Sensor</span>
                {currentEmotion && <span style={{ marginLeft:"auto", fontSize:"11px", color:"#34d399" }}>Auto-play ON</span>}
              </div>
              <EmotionCamera onRecommendations={(em, autoPlay) => fetchRecommendations(em, autoPlay ?? true)} />
            </div>

            {/* Context Panel — Voice + Weather + Time */}
            <ContextPanel
              voiceEmotion={voiceEmotion}
              voiceScores={voiceScores}
              voiceEnergy={voiceEnergy}
              isListening={isListening}
              onToggleVoice={isListening ? stopListening : startListening}
              timeContext={timeContext}
              weather={weather}
              location={location}
              locationError={locationError}
              loadingWeather={loadingWeather}
              onFetchLocation={fetchLocation}
              blendedEmotion={blendedEmotion}
              activityHint={activityHint}
            />

            {/* Emotion bars */}
            <AnimatePresence mode="wait">
              {currentEmotion ? (
                <motion.div key={currentEmotion}
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  style={{ background:"#0e0e1a", border:`1px solid ${ec.accent}40`, borderRadius:"16px", padding:"16px", boxShadow:`0 0 24px ${ec.glow}` }}
                >
                  <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:"20px", fontSize:"12px", fontWeight:600, background:`${ec.accent}20`, color:ec.text, border:`1px solid ${ec.accent}40`, marginBottom:"14px" }}>
                    {EMOTION_LABELS[currentEmotion]}
                  </span>
                  {emotionBars.map(([em, val]) => (
                    <div key={em} style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
                      <span style={{ fontSize:"11px", color:"#555", width:"56px", textTransform:"capitalize" }}>{em}</span>
                      <div style={{ flex:1, height:"4px", background:"#1a1a2e", borderRadius:"4px", overflow:"hidden" }}>
                        <motion.div initial={{ width:0 }} animate={{ width:`${Math.round(val*100)}%` }} transition={{ duration:0.6 }}
                          style={{ height:"100%", borderRadius:"4px", background: em===currentEmotion ? (EMOTION_COLORS[em]?.accent||"#64748b") : "#2a2a3e" }} />
                      </div>
                      <span style={{ fontSize:"11px", color:"#444", width:"28px", textAlign:"right" }}>{Math.round(val*100)}%</span>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                  style={{ background:"#0e0e1a", border:"1px solid #1e1e30", borderRadius:"16px", padding:"20px", textAlign:"center" }}>
                  <p style={{ color:"#333", fontSize:"13px", margin:0 }}>Start the sensor — music plays automatically!</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

            {/* Toolbar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", gap:"4px", background:"#0e0e1a", border:"1px solid #1e1e30", borderRadius:"12px", padding:"4px" }}>
                {[{id:"foryou",icon:Zap,label:"For You"},{id:"live",icon:Radio,label:"Live Picks"}].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 16px", borderRadius:"8px", border:"none", fontSize:"13px", fontWeight:500, cursor:"pointer", transition:"all 0.2s",
                      background: activeTab===tab.id ? "#fff" : "transparent",
                      color: activeTab===tab.id ? "#080810" : "#555" }}>
                    <tab.icon size={13}/>{tab.label}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={() => setAlbumOpen(true)}
                  style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"10px", border:"1px solid #1a2a1a", background:"rgba(52,211,153,0.1)", color:"#34d399", fontSize:"13px", cursor:"pointer", fontWeight:500 }}>
                  🎵 My Albums
                </button>
                <button onClick={() => setUploadOpen(true)}
                  style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"10px", border:"1px solid #2a1a4a", background:"rgba(124,58,237,0.12)", color:"#a78bfa", fontSize:"13px", cursor:"pointer", fontWeight:500 }}>
                  ⬆ Add Songs
                </button>
                <button onClick={() => fetchRecommendations(blendedEmotion || currentEmotion, true)} disabled={loading}
                  style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"10px", border:"1px solid #1e1e30", background:"#0e0e1a", color:"#888", fontSize:"13px", cursor:"pointer" }}>
                  {loading ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> : <RefreshCw size={13} />}
                  Refresh
                </button>
              </div>
            </div>

            {/* Song list */}
            <div style={{ background:"#0e0e1a", border:"1px solid #1e1e30", borderRadius:"16px", padding:"16px", flex:1, minHeight:"400px" }}>
              {recommendations.length > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"0 12px", marginBottom:"8px" }}>
                  <span style={{ width:"20px", fontSize:"10px", color:"#333", textTransform:"uppercase" }}>#</span>
                  <span style={{ width:"44px" }} />
                  <span style={{ flex:1, fontSize:"10px", color:"#333", textTransform:"uppercase", letterSpacing:"0.08em" }}>Title</span>
                  <span style={{ width:"36px", fontSize:"10px", color:"#333", textTransform:"uppercase", textAlign:"right" }}>Match</span>
                  <span style={{ width:"62px", fontSize:"10px", color:"#333", textTransform:"uppercase" }}>Rating</span>
                </div>
              )}

              {loading && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"240px", gap:"12px" }}>
                  <Loader2 size={22} color="#333" style={{ animation:"spin 1s linear infinite" }} />
                  <p style={{ color:"#333", fontSize:"13px", margin:0 }}>Curating your playlist...</p>
                </div>
              )}

              {!loading && recommendations.length === 0 && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"240px", gap:"16px" }}>
                  <Music2 size={32} color="#222" />
                  <p style={{ color:"#444", fontSize:"14px", fontWeight:500, margin:0 }}>Start the camera sensor</p>
                  <button onClick={() => fetchRecommendations("neutral", true)}
                    style={{ padding:"10px 24px", background:"#fff", color:"#080810", border:"none", borderRadius:"10px", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
                    Get Recommendations
                  </button>
                </div>
              )}

              {!loading && recommendations.length > 0 && recommendations.map((rec, i) => (
                <SongCard key={rec.id} rec={rec} index={i} onPlay={handlePlay}
                  isCurrentlyPlaying={isPlaying && currentIndex === i} />
              ))}
            </div>
          </div>
        </div>
      </main>

      <AlbumView open={albumOpen} onClose={() => setAlbumOpen(false)} />
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); fetchRecommendations(currentEmotion || "neutral", false); }} />
      <MusicPlayer onSongEnd={handleSongEnd} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
