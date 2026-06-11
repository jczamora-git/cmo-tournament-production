import { useState, useEffect } from "react";
import { getMatches } from "../services/api";

function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMatches()
      .then(setMatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>All Matches</h1>
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
            {match.mode} &middot; {match.title} &middot; {match.status}
          </div>
        </div>
      ))}
      {!matches.length && <p className="loading">No matches found</p>}
    </div>
  );
}

export default Matches;
