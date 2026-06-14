import { useState, useEffect } from "react";
import { getMatchHistory } from "../../../services/api";

function ViewHistory() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMatchHistory()
      .then(setMatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading history...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Match History</h1>
      <p className="page-desc">Past match results.</p>
      {matches.map((match) => (
        <div key={match.id} className="card match-row">
          <div className="match-teams">
            <span>Team {match.blue_team_id}</span>
            <span className="match-score">
              {match.blue_score} - {match.red_score}
            </span>
            <span>Team {match.red_team_id}</span>
          </div>
          <div className="match-meta">
            {match.mode} &middot; {match.title} &middot; Finished
          </div>
        </div>
      ))}
      {!matches.length && <p className="loading">No match history yet</p>}
    </div>
  );
}

export default ViewHistory;
