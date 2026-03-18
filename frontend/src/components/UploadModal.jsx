/**
 * UploadModal.jsx — Upload local songs without leaving the dashboard
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Music2, CheckCircle } from "lucide-react";
import client from "../api/client";
import toast from "react-hot-toast";

const EMOTIONS = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"];
const EMOTION_COLORS = {
  happy: "#fbbf24", sad: "#60a5fa", angry: "#f87171",
  fear: "#c084fc", surprise: "#34d399", disgust: "#a3e635", neutral: "#94a3b8"
};

export default function UploadModal({ open, onClose, onUploaded }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: "", artist: "", album: "", genre: "" });
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setForm({ title: "", artist: "", album: "", genre: "" });
    setSelectedEmotions([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const name = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    setForm(prev => ({ ...prev, title: prev.title || name }));
  };

  const toggleEmotion = (em) =>
    setSelectedEmotions(prev =>
      prev.includes(em) ? prev.filter(e => e !== em) : [...prev, em]
    );

  const handleUpload = async () => {
    if (!file) { toast.error("Please select an audio file"); return; }
    if (!form.title || !form.artist) { toast.error("Title and Artist are required"); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", form.title);
      fd.append("artist", form.artist);
      fd.append("album", form.album || "");
      fd.append("genre", form.genre || "");
      fd.append("emotion_tags", selectedEmotions.join(","));

      // Use the axios client — it auto-attaches the Bearer token
      const { data } = await client.post("/uploads/song", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(`"${form.title}" added to your library! 🎵`);
      onUploaded?.(data);
      reset();
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:50, backdropFilter:"blur(4px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%, -50%)",
              width:"100%", maxWidth:"500px", maxHeight:"90vh", overflowY:"auto", zIndex:51,
              background:"#0f0f1a", border:"1px solid #1e1e38", borderRadius:"20px", padding:"28px",
              boxShadow:"0 25px 60px rgba(0,0,0,0.6)" }}
          >
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"36px", height:"36px", background:"rgba(124,58,237,0.2)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Upload size={16} color="#a78bfa" />
                </div>
                <div>
                  <h2 style={{ color:"#fff", fontSize:"16px", fontWeight:"700", margin:0 }}>Upload Song</h2>
                  <p style={{ color:"#475569", fontSize:"12px", margin:0 }}>Sensor stays active while uploading</p>
                </div>
              </div>
              <button onClick={handleClose} style={{ background:"transparent", border:"none", color:"#475569", cursor:"pointer", padding:"4px" }}>
                <X size={20} />
              </button>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              style={{ border: dragOver ? "2px dashed #7c3aed" : "2px dashed #2a2a4a",
                borderRadius:"12px", padding:"24px", textAlign:"center", cursor:"pointer",
                background: dragOver ? "rgba(124,58,237,0.05)" : "rgba(255,255,255,0.02)",
                transition:"all 0.2s", marginBottom:"20px" }}
            >
              <input ref={fileRef} type="file" accept="audio/*" style={{ display:"none" }}
                onChange={e => handleFile(e.target.files[0])} />
              {file ? (
                <div style={{ display:"flex", alignItems:"center", gap:"12px", justifyContent:"center" }}>
                  <Music2 size={20} color="#a78bfa" />
                  <div style={{ textAlign:"left" }}>
                    <p style={{ color:"#a78bfa", fontWeight:"600", fontSize:"13px", margin:0 }}>{file.name}</p>
                    <p style={{ color:"#475569", fontSize:"11px", margin:0 }}>{(file.size/1024/1024).toFixed(1)} MB</p>
                  </div>
                  <CheckCircle size={16} color="#34d399" style={{ marginLeft:"auto" }} />
                </div>
              ) : (
                <>
                  <Upload size={24} color="#2a2a4a" style={{ marginBottom:"8px" }} />
                  <p style={{ color:"#64748b", fontSize:"13px", margin:"0 0 4px 0" }}>Click or drag & drop your audio file</p>
                  <p style={{ color:"#334155", fontSize:"11px", margin:0 }}>MP3, WAV, OGG, FLAC, M4A — max 50MB</p>
                </>
              )}
            </div>

            {/* Form */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"16px" }}>
              {[
                { key:"title",  label:"Title *",  placeholder:"Song title" },
                { key:"artist", label:"Artist *", placeholder:"Artist name" },
                { key:"album",  label:"Album",    placeholder:"Optional" },
                { key:"genre",  label:"Genre",    placeholder:"e.g. Pop, Rock" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ color:"#64748b", fontSize:"12px", display:"block", marginBottom:"5px" }}>{label}</label>
                  <input value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                    placeholder={placeholder}
                    style={{ width:"100%", padding:"9px 12px", background:"#1a1a2e", border:"1px solid #2a2a4a",
                      borderRadius:"8px", color:"#fff", fontSize:"13px", outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
            </div>

            {/* Emotion tags */}
            <div style={{ marginBottom:"22px" }}>
              <label style={{ color:"#64748b", fontSize:"12px", display:"block", marginBottom:"8px" }}>
                Mood Tags <span style={{ color:"#334155" }}>(when should this song play?)</span>
              </label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {EMOTIONS.map(em => (
                  <button key={em} onClick={() => toggleEmotion(em)} style={{
                    padding:"5px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:"500",
                    cursor:"pointer", border:"1px solid",
                    background: selectedEmotions.includes(em) ? EMOTION_COLORS[em] + "20" : "transparent",
                    borderColor: selectedEmotions.includes(em) ? EMOTION_COLORS[em] : "#2a2a4a",
                    color: selectedEmotions.includes(em) ? EMOTION_COLORS[em] : "#475569",
                    transition:"all 0.15s"
                  }}>{em}</button>
                ))}
              </div>
            </div>

            {/* Upload button */}
            <button onClick={handleUpload} disabled={uploading}
              style={{ width:"100%", padding:"12px", borderRadius:"10px", border:"none",
                background: uploading ? "#4c1d95" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color:"#fff", fontSize:"14px", fontWeight:"600",
                cursor: uploading ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
              {uploading ? "Uploading..." : <><Upload size={15} /> Upload Song</>}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
