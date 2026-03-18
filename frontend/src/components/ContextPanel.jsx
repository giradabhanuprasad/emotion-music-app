/**
 * ContextPanel.jsx
 * Shows voice emotion, location/weather context, time of day activity.
 * Compact panel that sits alongside the emotion camera.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, MapPin, Clock, Music2, Activity } from "lucide-react";

const EMOTION_COLORS = {
  happy:"#fbbf24", sad:"#60a5fa", angry:"#f87171", fear:"#c084fc",
  surprise:"#34d399", disgust:"#a3e635", neutral:"#94a3b8"
};

const BAR_COLORS = {
  angry:"#f87171", disgust:"#a3e635", fear:"#c084fc",
  happy:"#fbbf24", sad:"#60a5fa", surprise:"#34d399", neutral:"#94a3b8"
};

export default function ContextPanel({
  voiceEmotion, voiceScores, voiceEnergy, isListening, onToggleVoice,
  timeContext, weather, location, locationError, loadingWeather,
  onFetchLocation, blendedEmotion, activityHint
}) {

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>

      {/* ── Voice Emotion ─────────────────────────────────────── */}
      <div style={{ background:"#0f0f1a", border:"1px solid #1e1e38", borderRadius:"14px", padding:"14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <Mic size={13} color={isListening ? "#34d399" : "#475569"} />
            <span style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"600" }}>Voice Emotion</span>
            {isListening && (
              <span style={{ display:"flex", gap:"2px", alignItems:"flex-end", height:"12px" }}>
                {[1,2,3].map(i => (
                  <motion.span key={i} style={{ width:"2px", background:"#34d399", borderRadius:"2px", display:"block" }}
                    animate={{ height:["3px","10px","3px"] }}
                    transition={{ duration:0.6, repeat:Infinity, delay:i*0.15 }} />
                ))}
              </span>
            )}
          </div>
          <button onClick={onToggleVoice} style={{
            padding:"4px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"600", border:"none", cursor:"pointer",
            background: isListening ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
            color: isListening ? "#f87171" : "#34d399"
          }}>
            {isListening ? "Stop" : "Start"}
          </button>
        </div>

        {isListening ? (
          voiceEmotion ? (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
                <span style={{ fontSize:"18px" }}>🎤</span>
                <div>
                  <p style={{ color: EMOTION_COLORS[voiceEmotion] || "#fff", fontSize:"13px", fontWeight:"600", margin:0, textTransform:"capitalize" }}>{voiceEmotion}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:"4px", marginTop:"2px" }}>
                    <span style={{ color:"#475569", fontSize:"10px" }}>Energy</span>
                    <div style={{ width:"60px", height:"3px", background:"#1a1a2e", borderRadius:"2px", overflow:"hidden" }}>
                      <motion.div animate={{ width:`${voiceEnergy*100}%` }} style={{ height:"100%", background:"#34d399", borderRadius:"2px" }} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                {Object.entries(voiceScores).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([em, sc]) => (
                  <div key={em} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <span style={{ color:"#475569", fontSize:"10px", width:"48px", textTransform:"capitalize" }}>{em}</span>
                    <div style={{ flex:1, height:"3px", background:"#1a1a2e", borderRadius:"2px", overflow:"hidden" }}>
                      <motion.div animate={{ width:`${sc*100}%` }} style={{ height:"100%", background: BAR_COLORS[em] || "#6366f1", borderRadius:"2px" }} />
                    </div>
                    <span style={{ color:"#334155", fontSize:"10px", width:"24px" }}>{Math.round(sc*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color:"#334155", fontSize:"12px", margin:0 }}>Listening... speak naturally 🎤</p>
          )
        ) : (
          <p style={{ color:"#334155", fontSize:"12px", margin:0 }}>Start to analyze your voice emotion</p>
        )}
      </div>

      {/* ── Time & Activity ───────────────────────────────────── */}
      <div style={{ background:"#0f0f1a", border:"1px solid #1e1e38", borderRadius:"14px", padding:"14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
          <Clock size={13} color="#a78bfa" />
          <span style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"600" }}>Time Context</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"22px" }}>{timeContext.emoji}</span>
          <div>
            <p style={{ color:"#e2e8f0", fontSize:"13px", fontWeight:"600", margin:0 }}>{timeContext.label}</p>
            <p style={{ color:"#475569", fontSize:"11px", margin:0 }}>{activityHint?.desc}</p>
          </div>
        </div>
      </div>

      {/* ── Location & Weather ────────────────────────────────── */}
      <div style={{ background:"#0f0f1a", border:"1px solid #1e1e38", borderRadius:"14px", padding:"14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <MapPin size={13} color="#60a5fa" />
            <span style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"600" }}>Location & Weather</span>
          </div>
          {!location && (
            <button onClick={onFetchLocation} style={{
              padding:"3px 10px", borderRadius:"6px", fontSize:"11px", border:"none", cursor:"pointer",
              background:"rgba(96,165,250,0.15)", color:"#60a5fa", fontWeight:"600"
            }}>Enable</button>
          )}
        </div>

        {locationError && <p style={{ color:"#f87171", fontSize:"11px", margin:0 }}>{locationError}</p>}
        {loadingWeather && <p style={{ color:"#475569", fontSize:"11px", margin:0 }}>Fetching weather...</p>}

        {weather ? (
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"22px" }}>{weather.modifier?.label?.split(" ")[1] || "🌤️"}</span>
            <div>
              <p style={{ color:"#e2e8f0", fontSize:"13px", fontWeight:"600", margin:0 }}>{weather.modifier?.label?.split(" ")[0]}</p>
              <p style={{ color:"#475569", fontSize:"11px", margin:0 }}>{weather.temp}°C · Mood: <span style={{ color: EMOTION_COLORS[weather.modifier?.boost] || "#fff", textTransform:"capitalize" }}>{weather.modifier?.boost}</span></p>
            </div>
          </div>
        ) : !locationError ? (
          <p style={{ color:"#334155", fontSize:"11px", margin:0 }}>Enable location for weather-aware music</p>
        ) : null}
      </div>

      {/* ── Blended Emotion ───────────────────────────────────── */}
      {blendedEmotion && (
        <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
          style={{ background:`rgba(${blendedEmotion === "happy" ? "251,191,36" : blendedEmotion === "sad" ? "96,165,250" : "124,58,237"},0.08)`,
            border:"1px solid rgba(124,58,237,0.25)", borderRadius:"14px", padding:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <Activity size={13} color="#a78bfa" />
            <span style={{ color:"#94a3b8", fontSize:"12px", fontWeight:"600" }}>Blended Mood Signal</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"8px" }}>
            <span style={{ fontSize:"20px" }}>🧠</span>
            <div>
              <p style={{ color: EMOTION_COLORS[blendedEmotion] || "#a78bfa", fontSize:"14px", fontWeight:"700", margin:0, textTransform:"capitalize" }}>{blendedEmotion}</p>
              <p style={{ color:"#475569", fontSize:"10px", margin:0 }}>Camera + Voice + Weather + Time</p>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}
