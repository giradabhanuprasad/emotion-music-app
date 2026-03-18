import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store";
import toast from "react-hot-toast";

export default function Register() {
  const [form, setForm] = useState({ email:"", username:"", password:"", display_name:"" });
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!form.email || !form.username || !form.password) { toast.error("Please fill in all required fields"); return; }
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { ok, error } = await register(form);
    if (ok) { toast.success("Account created! Please sign in."); navigate("/login"); }
    else { toast.error(Array.isArray(error) ? error[0]?.msg : error || "Registration failed"); }
  };

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value }),
    style: { width:"100%", padding:"10px 14px", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:"10px", color:"#fff", fontSize:"14px", outline:"none", boxSizing:"border-box" }
  });

  return (
    <div style={{ minHeight:"100vh", background:"#080810", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"400px", background:"#12121e", border:"1px solid #2a2a4a", borderRadius:"16px", padding:"32px" }}>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div style={{ fontSize:"32px", marginBottom:"8px" }}>🎵</div>
          <h1 style={{ color:"#fff", fontSize:"24px", fontWeight:"700", margin:"0 0 4px 0" }}>EmotiTune</h1>
          <p style={{ color:"#888", fontSize:"13px", margin:0 }}>Join the emotion-aware music experience</p>
        </div>

        <h2 style={{ color:"#fff", fontSize:"18px", fontWeight:"600", marginBottom:"20px" }}>Create Account</h2>

        {[
          { key:"email",        label:"Email *",        type:"email",    placeholder:"you@example.com" },
          { key:"username",     label:"Username *",     type:"text",     placeholder:"cooluser42" },
          { key:"display_name", label:"Display Name",   type:"text",     placeholder:"Cool User" },
          { key:"password",     label:"Password *",     type:"password", placeholder:"Min 8 characters" },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key} style={{ marginBottom:"16px" }}>
            <label style={{ color:"#aaa", fontSize:"13px", display:"block", marginBottom:"6px" }}>{label}</label>
            <input type={type} placeholder={placeholder} {...field(key)} />
          </div>
        ))}

        <button
          onClick={handleRegister}
          disabled={isLoading}
          style={{ width:"100%", padding:"12px", background:"#7c3aed", border:"none", borderRadius:"10px", color:"#fff", fontSize:"15px", fontWeight:"600", cursor:"pointer", marginTop:"8px", opacity: isLoading ? 0.6 : 1 }}
        >
          {isLoading ? "Creating account..." : "Create Account"}
        </button>

        <p style={{ textAlign:"center", color:"#888", fontSize:"13px", marginTop:"20px" }}>
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            style={{ color:"#a78bfa", cursor:"pointer", fontWeight:"600" }}
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}
