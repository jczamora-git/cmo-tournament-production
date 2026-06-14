import { useState, useEffect } from "react";
import { getUpcomingMatches } from "../../../services/api";

function ViewMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getUpcomingMatches()
      .then(setMatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading matches...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Matches</h1>
      <p className="page-desc">Current and upcoming tournament matches.</p>
      {matches.map((match) => (
        <div key={match.id} className="card match-row">
          <div className="match-teams">
            <span>{match.blue_team?.shortname || match.blue_team?.name || `Team ${match.blue_team_id}`}</span>
            <span className="match-vs">vs</span>
            <span>{match.red_team?.shortname || match.red_team?.name || `Team ${match.red_team_id}`}</span>
          </div>
          <div className="match-meta">
            {match.mode} &middot; {match.title} &middot; {match.status}
          </div>
        </div>
      ))}
      {!matches.length && <p className="loading">No upcoming matches</p>}
    </div>
  );
}

export default ViewMatches;
