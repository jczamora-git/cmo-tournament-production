import { useState, useEffect } from "react";
import { adminGetTeams, adminCreateTeam, adminUpdateTeam, adminDeleteTeam } from "../../../services/api";

function ManageTeams() {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState("");
  const [shortname, setShortname] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    try {
      const data = await adminGetTeams();
      setTeams(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, []);

  const resetForm = () => {
    setName("");
    setShortname("");
    setLogoUrl("");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Team name is required");
      return;
    }

    try {
      if (editingId) {
        await adminUpdateTeam(editingId, { name: name.trim(), shortname: shortname.trim() || null, logo: logoUrl.trim() || null });
      } else {
        await adminCreateTeam({ name: name.trim(), shortname: shortname.trim() || null, logo: logoUrl.trim() || null });
      }
      resetForm();
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (team) => {
    setEditingId(team.id);
    setName(team.name);
    setShortname(team.shortname || "");
    setLogoUrl(team.logo || "");
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this team?")) return;
    try {
      await adminDeleteTeam(id);
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Manage Teams</h1>

      <div className="card">
        <h3>{editingId ? "Edit Team" : "Add Team"}</h3>
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}
          <div className="form-group">
            <label>Team Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Team Liquid" />
          </div>
          <div className="form-group">
            <label>Short Name</label>
            <input type="text" value={shortname} onChange={(e) => setShortname(e.target.value)} placeholder="e.g. TL" />
          </div>
          <div className="form-group">
            <label>Logo URL</label>
            <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Add Team"}</button>
            {editingId && <button type="button" className="btn" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      <h2 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Teams ({teams.length})</h2>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <div className="team-list">
          {teams.map((team) => (
            <div key={team.id} className="card team-card">
              {team.logo && <img src={team.logo} alt={team.name} className="team-logo" />}
              <div style={{ flex: 1 }}>
                <strong>{team.name}</strong>
                {team.shortname && <span style={{ color: "#8899a6", marginLeft: "0.5rem" }}>({team.shortname})</span>}
              </div>
              <div className="card-actions">
                <button className="btn btn-sm" onClick={() => handleEdit(team)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(team.id)}>Delete</button>
              </div>
            </div>
          ))}
          {!teams.length && <p className="loading">No teams yet</p>}
        </div>
      )}
    </div>
  );
}

export default ManageTeams;
