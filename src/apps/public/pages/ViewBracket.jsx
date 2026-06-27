import { useState, useEffect } from "react";
import { getMatchBracket } from "../../../services/api";
import EmptyState from "../../admin/components/EmptyState";
import LoadingState from "../../admin/components/LoadingState";

function ViewBracket() {
  const [bracket, setBracket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMatchBracket()
      .then(setBracket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading bracket..." />;
  if (error) {
    return (
      <div>
        <h1>Tournament Bracket</h1>
        <div className="admin-error-message">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <header className="public-page-header">
        <h1>Bracket</h1>
        <p>View the current tournament bracket and progression.</p>
      </header>

      {bracket.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No bracket data"
          description="Tournament bracket matches will appear here."
        />
      ) : (
        <div className="admin-bracket-list">
          {bracket.map((match) => (
            <div key={match.id} className="admin-match-card">
              <div className="admin-match-card-header">
                <span className="admin-match-card-title">{match.title || "Bracket Match"}</span>
                <span className={`status-badge status-${match.status}`}>{match.status}</span>
              </div>

              <div className="admin-match-card-teams">
                <div className="admin-match-team">
                  <div className="admin-match-team-fallback">
                    {(match.blue_team?.shortname || match.blue_team?.name || "B")?.[0]}
                  </div>
                  <span className="admin-match-team-name">
                    {match.blue_team?.shortname || match.blue_team?.name || `Team ${match.blue_team_id}`}
                  </span>
                </div>

                <div className="admin-match-score-center">
                  {match.blue_score} - {match.red_score}
                </div>

                <div className="admin-match-team is-red">
                  <div className="admin-match-team-fallback">
                    {(match.red_team?.shortname || match.red_team?.name || "R")?.[0]}
                  </div>
                  <span className="admin-match-team-name">
                    {match.red_team?.shortname || match.red_team?.name || `Team ${match.red_team_id}`}
                  </span>
                </div>
              </div>

              <div className="admin-match-card-footer">
                <div className="admin-match-card-meta">
                  <span className="admin-match-mode-pill">{match.mode}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewBracket;
