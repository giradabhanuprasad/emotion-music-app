/**
 * src/components/Navbar.jsx
 */

import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Music, LayoutDashboard, LogOut, User, Upload } from "lucide-react";
import { useAuthStore } from "../store";
import { clsx } from "clsx";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Songs", icon: Upload },
];

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border"
      style={{ background: "rgba(8,8,16,0.85)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-5">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-glow-violet">
            <Music size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg gradient-text">EmotiTune</span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={clsx(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-all duration-200",
                  active
                    ? "bg-accent/10 text-accent-light border border-accent/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-panel"
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel border border-border">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <User size={12} className="text-accent-light" />
            </div>
            <span className="text-sm text-text-secondary font-body hidden sm:block">
              {user?.display_name || user?.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost !px-3 !py-2"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
