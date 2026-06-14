import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { adminVerify } from "../../services/api";
import AdminTopNav from "./components/AdminTopNav";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ManageTeams from "./pages/ManageTeams";
import ManageMatches from "./pages/ManageMatches";
import ManageHistory from "./pages/ManageHistory";
import ManageBracket from "./pages/ManageBracket";
import TeamSubmissions from "./pages/TeamSubmissions";
import AdminLiveSettings from "./pages/AdminLiveSettings";
import LoadingState from "./components/LoadingState";

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setChecking(false);
      return;
    }
    adminVerify()
      .then(() => setAuthenticated(true))
      .catch(() => {
        localStorage.removeItem("admin_token");
        setAuthenticated(false);
      })
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem("admin_token", token);
    setAuthenticated(true);
    navigate("/dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setAuthenticated(false);
    navigate("/");
  };

  if (checking) {
    return (
      <div className="admin-app">
        <LoadingState message="Checking authentication..." />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="admin-app">
      <AdminTopNav onLogout={handleLogout} />
      <main className="admin-shell">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/teams" element={<ManageTeams />} />
          <Route path="/team-submissions" element={<TeamSubmissions />} />
          <Route path="/matches" element={<ManageMatches />} />
          <Route path="/history" element={<ManageHistory />} />
          <Route path="/bracket" element={<ManageBracket />} />
          <Route path="/live-settings" element={<AdminLiveSettings />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminApp;
