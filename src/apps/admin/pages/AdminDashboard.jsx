import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { adminGetTeams, adminGetMatches, adminGetSubmissions } from "../../../services/api";
import LoadingState from "../components/LoadingState";

const overviewCards = [
  {
    title: "Teams",
    description: "Manage team branding, shortnames, and logos.",
    to: "/teams",
  },
  {
    title: "Submissions",
    description: "Review and approve team submissions.",
    to: "/team-submissions",
  },
  {
    title: "Matches",
    description: "Create and manage match queue and scores.",
    to: "/matches",
  },
  {
    title: "History",
    description: "Browse completed match results.",
    to: "/history",
  },
  {
    title: "Bracket",
    description: "View tournament bracket.",
    to: "/bracket",
  },
  {
    title: "Standings",
    description: "View BR group standings from the Controller.",
    to: "/standings",
  },
];

function AdminDashboard() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminGetTeams(), adminGetMatches(), adminGetSubmissions()])
      .then(([t, m, s]) => {
        setTeams(t || []);
        setMatches(m || []);
        setSubmissions(s || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "pending").length,
    [submissions]
  );

  const liveMatch = useMemo(
    () => matches.find((m) => m.status === "live") || matches.find((m) => m.status === "active") || null,
    [matches]
  );

  const teamsById = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(Number(t.id), t));
    return map;
  }, [teams]);

  if (loading) return <LoadingState message="Loading dashboard..." />;

  const blueTeam = liveMatch ? teamsById.get(Number(liveMatch.blue_team_id)) : null;
  const redTeam = liveMatch ? teamsById.get(Number(liveMatch.red_team_id)) : null;
  const blueTeamName = blueTeam?.shortname || blueTeam?.name || "Blue";
  const redTeamName = redTeam?.shortname || redTeam?.name || "Red";

  return (
    <div className="admin-dashboard">
      {/* Hero */}
      <section className="admin-dashboard-hero">
        <p className="admin-dashboard-eyebrow">JEIZI PRODUCTIONS</p>
        <h1>Tournament Admin</h1>
        <p>SK Barangay MLBB Season 2 — Admin Control Room</p>
        <div className="admin-dashboard-chips">
          <span>Admin Panel</span>
          <span>Tournament Manager</span>
          <span>Same-Origin API</span>
        </div>
      </section>

      {/* Stats */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-number">{teams.length}</div>
          <div className="admin-stat-label">Teams</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{matches.length}</div>
          <div className="admin-stat-label">Matches</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-number">{pendingCount}</div>
          <div className="admin-stat-label">Pending</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="admin-dashboard-grid">
        <div className="admin-dashboard-main">
          {/* Featured Match */}
          <section className="admin-card">
            <div className="admin-card-title-row">
              <div>
                <p className="admin-section-kicker">Featured Match</p>
                <h2>{liveMatch ? `Match: ${liveMatch.title || "Untitled"}` : "No Active Match"}</h2>
              </div>
              {liveMatch?.status && (
                <span className={`status-badge status-${liveMatch.status}`}>
                  {liveMatch.status}
                </span>
              )}
            </div>

            {liveMatch ? (
              <>
                <div className="admin-scoreboard">
                  <div className="admin-score-team">
                    <div className="admin-score-logo-fallback">
                      {blueTeamName[0]}
                    </div>
                    <div className="admin-score-team-name">{blueTeamName}</div>
                  </div>
                  <div className="admin-score-center">
                    {liveMatch.blue_score ?? 0} - {liveMatch.red_score ?? 0}
                  </div>
                  <div className="admin-score-team is-red">
                    <div className="admin-score-team-name">{redTeamName}</div>
                    <div className="admin-score-logo-fallback">
                      {redTeamName[0]}
                    </div>
                  </div>
                </div>
                <div className="admin-match-meta-pills">
                  <span>{liveMatch.mode || "BO3"}</span>
                  <span>{liveMatch.status}</span>
                </div>
                <div style={{ marginTop: "16px" }}>
                  <Link className="button-primary" to="/matches">
                    Manage Match
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--jz-text-muted)", marginTop: "8px" }}>
                <p>No live or active match right now.</p>
                <Link className="button-primary" to="/matches" style={{ marginTop: "12px", display: "inline-flex" }}>
                  Go to Matches
                </Link>
              </div>
            )}
          </section>
        </div>

        <div className="admin-dashboard-side">
          {/* Checklist */}
          <section className="admin-card">
            <div className="admin-card-title-row">
              <div>
                <p className="admin-section-kicker">Setup</p>
                <h2>Checklist</h2>
              </div>
            </div>
            <div className="admin-checklist-items">
              <div className={`admin-check-item${teams.length > 0 ? " is-ready" : ""}`}>
                <span className="admin-check-dot" />
                Teams loaded ({teams.length})
              </div>
              <div className={`admin-check-item${matches.length > 0 ? " is-ready" : ""}`}>
                <span className="admin-check-dot" />
                Matches created ({matches.length})
              </div>
              <div className={`admin-check-item${pendingCount === 0 ? " is-ready" : ""}`}>
                <span className="admin-check-dot" />
                {pendingCount === 0 ? "All submissions reviewed" : `${pendingCount} pending submissions`}
              </div>
              <div className={`admin-check-item${liveMatch ? " is-ready" : ""}`}>
                <span className="admin-check-dot" />
                {liveMatch ? "Live match active" : "No live match"}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Overview Cards */}
      <section>
        <div className="admin-card-title-row">
          <div>
            <p className="admin-section-kicker">Admin Sections</p>
            <h2>Quick Access</h2>
          </div>
        </div>
        <div className="admin-overview-grid">
          {overviewCards.map((card) => (
            <Link key={card.to} className="admin-overview-card" to={card.to}>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
              <span className="admin-card-arrow">Open →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
