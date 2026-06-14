import { useState } from "react";
import { submitTeam } from "../../../services/api";

function UploadTeam() {
  const [form, setForm] = useState({
    team_name: "",
    shortname: "",
    captain_name: "",
    contact: "",
    logo_url: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.team_name.trim()) {
      setError("Team name is required");
      return;
    }
    if (!form.captain_name.trim()) {
      setError("Captain name is required");
      return;
    }
    if (!form.contact.trim()) {
      setError("Contact number or messenger link is required");
      return;
    }

    setLoading(true);
    try {
      const result = await submitTeam(form);
      setSuccess(result.message || "Team submitted successfully. Please wait for admin approval.");
      setForm({ team_name: "", shortname: "", captain_name: "", contact: "", logo_url: "", notes: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Upload Team</h1>
      <p className="page-desc">Submit your team for the tournament. Your submission will be reviewed by an admin before being added to the official team list.</p>

      <div className="card form-card">
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <div className="form-group">
            <label>Team Name *</label>
            <input
              type="text"
              name="team_name"
              value={form.team_name}
              onChange={handleChange}
              placeholder="e.g. Team Liquid"
            />
          </div>

          <div className="form-group">
            <label>Short Name / Tag</label>
            <input
              type="text"
              name="shortname"
              value={form.shortname}
              onChange={handleChange}
              placeholder="e.g. TL"
            />
          </div>

          <div className="form-group">
            <label>Captain Name *</label>
            <input
              type="text"
              name="captain_name"
              value={form.captain_name}
              onChange={handleChange}
              placeholder="Captain's name"
            />
          </div>

          <div className="form-group">
            <label>Contact Number or Messenger Link *</label>
            <input
              type="text"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              placeholder="e.g. 09xx-xxx-xxxx or m.me/username"
            />
          </div>

          <div className="form-group">
            <label>Team Logo URL (optional)</label>
            <input
              type="text"
              name="logo_url"
              value={form.logo_url}
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any additional info about your team"
              rows={3}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Submitting..." : "Submit Team"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UploadTeam;
