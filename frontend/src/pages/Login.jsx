import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    const { ok, error } = await login(email, password);
    if (ok) { toast.success("Welcome back!"); navigate("/dashboard"); }
    else { toast.error(error || "Login failed"); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080810", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"400px", background:"#12121e", border:"1px solid #2a2a4a", borderRadius:"16px", padding:"32px" }}>
        <div style={{ textAlign:"center", marginBottom:"28px" }}>
          <div style={{ fontSize:"32px", marginBottom:"8px" }}>🎵</div>
          <h1 style={{ color:"#fff", fontSize:"24px", fontWeight:"700", margin:"0 0 4px 0" }}>EmotiTune</h1>
          <p style={{ color:"#888", fontSize:"13px", margin:0 }}>Music that feels what you feel</p>
        </div>

        <h2 style={{ color:"#fff", fontSize:"18px", fontWeight:"600", marginBottom:"20px" }}>Sign In</h2>

        <div style={{ marginBottom:"16px" }}>
          <label style={{ color:"#aaa", fontSize:"13px", display:"block", marginBottom:"6px" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width:"100%", padding:"10px 14px", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:"10px", color:"#fff", fontSize:"14px", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        <div style={{ marginBottom:"24px" }}>
          <label style={{ color:"#aaa", fontSize:"13px", display:"block", marginBottom:"6px" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width:"100%", padding:"10px 14px", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:"10px", color:"#fff", fontSize:"14px", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{ width:"100%", padding:"12px", background:"#7c3aed", border:"none", borderRadius:"10px", color:"#fff", fontSize:"15px", fontWeight:"600", cursor:"pointer", opacity: isLoading ? 0.6 : 1 }}
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>

        <p style={{ textAlign:"center", color:"#888", fontSize:"13px", marginTop:"20px" }}>
          New here?{" "}
          <span
            onClick={() => navigate("/register")}
            style={{ color:"#a78bfa", cursor:"pointer", fontWeight:"600" }}
          >
            Create account
          </span>
        </p>
      </div>
    </div>
  );
}
