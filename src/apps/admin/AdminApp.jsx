import { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { adminVerify } from "../../services/api";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ManageTeams from "./pages/ManageTeams";
import ManageMatches from "./pages/ManageMatches";
import ManageHistory from "./pages/ManageHistory";
import ManageBracket from "./pages/ManageBracket";
import TeamSubmissions from "./pages/TeamSubmissions";

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

  if (checking) return <p className="loading">Checking authentication...</p>;

  if (!authenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="app admin-app">
      <nav className="nav admin-nav">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/teams">Teams</NavLink>
        <NavLink to="/team-submissions">Submissions</NavLink>
        <NavLink to="/matches">Matches</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/bracket">Bracket</NavLink>
        <button className="btn btn-danger btn-sm nav-logout" onClick={handleLogout}>
          Logout
        </button>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/teams" element={<ManageTeams />} />
          <Route path="/team-submissions" element={<TeamSubmissions />} />
          <Route path="/matches" element={<ManageMatches />} />
          <Route path="/history" element={<ManageHistory />} />
          <Route path="/bracket" element={<ManageBracket />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminApp;
