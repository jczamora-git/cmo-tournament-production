import { useState, useEffect } from "react";
import {
  adminGetMatches,
  adminGetTeams,
  adminCreateMatch,
  adminUpdateMatch,
  adminDeleteMatch,
} from "../../../services/api";

function ManageMatches() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [blueTeamId, setBlueTeamId] = useState("");
  const [redTeamId, setRedTeamId] = useState("");
  const [mode, setMode] = useState("BO3");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("queued");
  const [editingId, setEditingId] = useState(null);
  const [blueScore, setBlueScore] = useState(0);
  const [redScore, setRedScore] = useState(0);

  const fetchData = async () => {
    try {
      const [m, t] = await Promise.all([adminGetMatches(), adminGetTeams()]);
      setMatches(m);
      setTeams(t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setBlueTeamId("");
    setRedTeamId("");
    setMode("BO3");
    setTitle("");
    setStatus("queued");
    setBlueScore(0);
    setRedScore(0);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!blueTeamId || !redTeamId) {
      setError("Both teams are required");
      return;
    }

    try {
      if (editingId) {
        await adminUpdateMatch(editingId, {
          blue_team_id: Number(blueTeamId),
          red_team_id: Number(redTeamId),
          mode,
          title: title || "Match",
          status,
          blue_score: Number(blueScore),
          red_score: Number(redScore),
        });
      } else {
        await adminCreateMatch({
          blue_team_id: Number(blueTeamId),
          red_team_id: Number(redTeamId),
          mode,
          title: title || "Match",
          status,
        });
      }
      resetForm();
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (match) => {
    setEditingId(match.id);
    setBlueTeamId(match.blue_team_id || "");
    setRedTeamId(match.red_team_id || "");
    setMode(match.mode || "BO3");
    setTitle(match.title || "");
    setStatus(match.status || "queued");
    setBlueScore(match.blue_score || 0);
    setRedScore(match.red_score || 0);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this match?")) return;
    try {
      await adminDeleteMatch(id);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const teamName = (id) => {
    const t = teams.find((t) => t.id === id);
    return t ? t.shortname || t.name : `Team ${id}`;
  };

  if (loading) return <p className="loading">Loading...</p>;

  return (
    <div>
      <h1>Manage Matches</h1>

      <div className="card">
        <h3>{editingId ? "Edit Match" : "Create Match"}</h3>
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}
          <div className="form-row">
            <div className="form-group">
              <label>Blue Team *</label>
              <select value={blueTeamId} onChange={(e) => setBlueTeamId(e.target.value)}>
                <option value="">Select team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Red Team *</label>
              <select value={redTeamId} onChange={(e) => setRedTeamId(e.target.value)}>
                <option value="">Select team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="BO1">BO1</option>
                <option value="BO3">BO3</option>
                <option value="BO5">BO5</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="queued">Queued</option>
                <option value="upcoming">Upcoming</option>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="finished">Finished</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Upper Bracket R1" />
          </div>
          {editingId && (
            <div className="form-row">
              <div className="form-group">
                <label>Blue Score</label>
                <input type="number" value={blueScore} onChange={(e) => setBlueScore(e.target.value)} min="0" />
              </div>
              <div className="form-group">
                <label>Red Score</label>
                <input type="number" value={redScore} onChange={(e) => setRedScore(e.target.value)} min="0" />
              </div>
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create Match"}</button>
            {editingId && <button type="button" className="btn" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <h2 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Matches ({matches.length})</h2>
      {matches.map((match) => (
        <div key={match.id} className="card match-row">
          <div className="match-teams">
            <span>{teamName(match.blue_team_id)}</span>
            <span className="match-score">{match.blue_score} - {match.red_score}</span>
            <span>{teamName(match.red_team_id)}</span>
          </div>
          <div className="match-meta">
            {match.mode} &middot; {match.title} &middot; {match.status}
          </div>
          <div className="card-actions">
            <button className="btn btn-sm" onClick={() => handleEdit(match)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(match.id)}>Delete</button>
          </div>
        </div>
      ))}
      {!matches.length && <p className="loading">No matches yet</p>}
    </div>
  );
}

export default ManageMatches;
