import { useState, useEffect } from "react";
import { adminGetTeams, adminGetMatches, adminGetSubmissions } from "../../../services/api";

function AdminDashboard() {
  const [stats, setStats] = useState({ teams: 0, matches: 0, submissions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminGetTeams(), adminGetMatches(), adminGetSubmissions()])
      .then(([teams, matches, submissions]) => {
        setStats({
          teams: teams.length,
          matches: matches.length,
          submissions: submissions.filter((s) => s.status === "pending").length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading dashboard...</p>;

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <div className="dashboard-stats">
        <div className="card stat-card">
          <div className="stat-number">{stats.teams}</div>
          <div className="stat-label">Teams</div>
        </div>
        <div className="card stat-card">
          <div className="stat-number">{stats.matches}</div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="card stat-card">
          <div className="stat-number">{stats.submissions}</div>
          <div className="stat-label">Pending Submissions</div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
