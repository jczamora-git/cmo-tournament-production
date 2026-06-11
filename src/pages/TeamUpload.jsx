import { useState, useEffect } from "react";
import { getTeams, createTeam, deleteTeam } from "../services/api";

function TeamUpload() {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState("");
  const [shortname, setShortname] = useState("");
  const [logo, setLogo] = useState(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    try {
      const data = await getTeams();
      setTeams(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Team name is required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (shortname.trim()) formData.append("shortname", shortname.trim());
      if (logo) {
        formData.append("logo", logo);
      } else if (logoUrl.trim()) {
        formData.append("logo", logoUrl.trim());
      }

      await createTeam(formData);
      setName("");
      setShortname("");
      setLogo(null);
      setLogoUrl("");
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTeam(id);
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Team Management</h1>

      <div className="card">
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}
          <div className="form-group">
            <label>Team Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Liquid"
            />
          </div>
          <div className="form-group">
            <label>Short Name</label>
            <input
              type="text"
              value={shortname}
              onChange={(e) => setShortname(e.target.value)}
              placeholder="e.g. TL"
            />
          </div>
          <div className="form-group">
            <label>Logo File</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogo(e.target.files[0] || null)}
            />
          </div>
          <div className="form-group">
            <label>Or Logo URL</label>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <button type="submit" className="btn btn-primary">Add Team</button>
        </form>
      </div>

      <h2 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Teams</h2>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <div className="team-list">
          {teams.map((team) => (
            <div key={team.id} className="card team-card">
              {team.logo && (
                <img src={team.logo} alt={team.name} className="team-logo" />
              )}
              <div style={{ flex: 1 }}>
                <strong>{team.name}</strong>
                {team.shortname && (
                  <span style={{ color: "#8899a6", marginLeft: "0.5rem" }}>
                    ({team.shortname})
                  </span>
                )}
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(team.id)}
              >
                Delete
              </button>
            </div>
          ))}
          {!teams.length && <p className="loading">No teams yet</p>}
        </div>
      )}
    </div>
  );
}

export default TeamUpload;
