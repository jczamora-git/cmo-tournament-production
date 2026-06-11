import { useState, useEffect } from "react";
import { getUpcomingMatches } from "../services/api";

function Upcoming() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getUpcomingMatches()
      .then(setMatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Upcoming Matches</h1>
      {matches.map((match) => (
        <div key={match.id} className="card match-row">
          <div className="match-teams">
            <span>Team {match.blue_team_id}</span>
            <span style={{ color: "#8899a6" }}>vs</span>
            <span>Team {match.red_team_id}</span>
          </div>
          <div className="match-meta">
            {match.mode} &middot; {match.title}
          </div>
        </div>
      ))}
      {!matches.length && <p className="loading">No upcoming matches</p>}
    </div>
  );
}

export default Upcoming;
