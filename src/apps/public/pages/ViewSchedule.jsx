import { useState, useEffect } from "react";
import { getUpcomingMatches } from "../../../services/api";
import EmptyState from "../../admin/components/EmptyState";
import LoadingState from "../../admin/components/LoadingState";

function TeamDisplay({ name, shortname, id, logo, isRed }) {
  const label = shortname || name || (id ? `Team ${id}` : "TBD");
  const fallbackInitial = label.charAt(0).toUpperCase();

  const [imgError, setImgError] = useState(false);

  return (
    <div className={`admin-match-team ${isRed ? "is-red" : ""}`}>
      {logo && !imgError ? (
        <img 
          src={logo} 
          alt={`${label} logo`} 
          className="admin-match-team-logo" 
          onError={() => setImgError(true)} 
        />
      ) : (
        <div className="admin-match-team-fallback">
          {fallbackInitial}
        </div>
      )}
      <span className="admin-match-team-name">{label}</span>
    </div>
  );
}

function ViewSchedule() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getUpcomingMatches()
      .then(setMatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading matches..." />;
  if (error) {
    return (
      <div>
        <h1>Schedule</h1>
        <div className="admin-error-message">{error}</div>
      </div>
    );
  }

  // Group matches by title
  const groupedMatches = matches.reduce((acc, match) => {
    const stage = match.title || "Uncategorized";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(match);
    return acc;
  }, {});

  return (
    <div>
      <header className="public-page-header">
        <h1>Schedule</h1>
        <p>View current and upcoming tournament matches grouped by stage.</p>
      </header>

      {matches.length === 0 ? (
        <EmptyState
          icon="⚔️"
          title="No upcoming matches"
          description="Check back later for scheduled matches."
        />
      ) : (
        <div className="admin-match-list">
          {Object.entries(groupedMatches).map(([stage, stageMatches]) => (
            <div key={stage} style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", marginBottom: "1rem" }}>{stage}</h2>
              <div className="admin-match-list">
                {stageMatches.map((match) => {
                  const isMultiTeam =
                    match.competition_type === "group" ||
                    match.mode?.toLowerCase().includes("br") ||
                    match.mode?.toLowerCase().includes("magic");

                  if (isMultiTeam) {
                    return (
                      <div key={match.id} className="admin-match-card" style={{ justifyContent: "center", textAlign: "center", padding: "32px" }}>
                        <span className="admin-match-card-title">Group schedule and standings will appear here.</span>
                        <div className="admin-match-mode-pill" style={{ display: "inline-block", marginTop: "8px" }}>{match.mode || "Group Stage"}</div>
                      </div>
                    );
                  }

                  const seriesFormat = match.series_format || match.mode;

                  return (
                    <div key={match.id} className="admin-match-card">
                      <div className="admin-match-card-header">
                        <span className="admin-match-card-title">
                          Match #{match.match_no ?? match.id} {match.title || ""}
                        </span>
                        <span className={`status-badge status-${match.status?.toLowerCase() || "queued"}`}>
                          {match.status?.toUpperCase() || "QUEUED"}
                        </span>
                      </div>

                      <div className="admin-match-card-teams">
                        <TeamDisplay 
                          name={match.blue_team_name || match.blue_team?.name}
                          shortname={match.blue_team_shortname || match.blue_team?.shortname}
                          id={match.blue_team_id}
                          logo={match.blue_team_logo || match.blue_team?.logo}
                          isRed={false}
                        />

                        <div className="admin-match-score-center" style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                          <span>{match.blue_score ?? 0}</span>
                          <span style={{ fontSize: "12px", opacity: 0.7 }}>VS</span>
                          <span>{match.red_score ?? 0}</span>
                        </div>

                        <TeamDisplay 
                          name={match.red_team_name || match.red_team?.name}
                          shortname={match.red_team_shortname || match.red_team?.shortname}
                          id={match.red_team_id}
                          logo={match.red_team_logo || match.red_team?.logo}
                          isRed={true}
                        />
                      </div>

                      <div className="admin-match-card-footer">
                        <div className="admin-match-card-meta">
                          {seriesFormat && <span className="admin-match-mode-pill">{seriesFormat}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewSchedule;
