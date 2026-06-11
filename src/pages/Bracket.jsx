import { useState, useEffect } from "react";
import { getMatchBracket } from "../services/api";

function Bracket() {
  const [bracket, setBracket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMatchBracket()
      .then(setBracket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h1>Bracket</h1>
      <div className="bracket-container">
        {bracket.map((match) => (
          <div key={match.id} className="card match-row">
            <div className="match-teams">
              <span>{match.blue_team?.shortname || match.blue_team?.name || `Team ${match.blue_team_id}`}</span>
              <span className="match-score">
                {match.blue_score} - {match.red_score}
              </span>
              <span>{match.red_team?.shortname || match.red_team?.name || `Team ${match.red_team_id}`}</span>
            </div>
            <div className="match-meta">
              {match.mode} &middot; {match.title} &middot; {match.status}
            </div>
          </div>
        ))}
        {!bracket.length && <p className="loading">No bracket data</p>}
      </div>
    </div>
  );
}

export default Bracket;
