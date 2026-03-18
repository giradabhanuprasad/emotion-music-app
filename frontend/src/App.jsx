/**
 * src/App.jsx
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

// ── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── Public Route (redirect if authed) ────────────────────────────────────────
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const { fetchMe, isAuthenticated } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token && !isAuthenticated) fetchMe();
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={<PublicRoute><Login /></PublicRoute>}
        />
        <Route
          path="/register"
          element={<PublicRoute><Register /></PublicRoute>}
        />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#141428",
            color: "#e2e2f0",
            border: "1px solid #1e1e38",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
          },
          success: { iconTheme: { primary: "#a3e635", secondary: "#141428" } },
          error:   { iconTheme: { primary: "#f87171", secondary: "#141428" } },
        }}
      />
      <AppShell />
    </BrowserRouter>
  );
}
