import { useState, useEffect } from "react";
import { adminGetSubmissions, adminApproveSubmission, adminRejectSubmission } from "../../../services/api";

function TeamSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");

  const fetchSubmissions = async () => {
    try {
      const data = await adminGetSubmissions();
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const handleApprove = async (sub) => {
    if (!confirm(`Approve team "${sub.team_name}"?`)) return;
    try {
      await adminApproveSubmission(sub.id, {
        team_name: sub.team_name,
        shortname: sub.shortname,
        logo_url: sub.logo_url,
      });
      fetchSubmissions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (sub) => {
    if (!confirm(`Reject team "${sub.team_name}"?`)) return;
    try {
      await adminRejectSubmission(sub.id);
      fetchSubmissions();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = submissions.filter((s) => filter === "all" || s.status === filter);

  if (loading) return <p className="loading">Loading submissions...</p>;

  return (
    <div>
      <h1>Team Submissions</h1>

      <div className="filter-bar">
        <button className={`btn btn-sm ${filter === "pending" ? "btn-primary" : ""}`} onClick={() => setFilter("pending")}>
          Pending ({submissions.filter((s) => s.status === "pending").length})
        </button>
        <button className={`btn btn-sm ${filter === "approved" ? "btn-primary" : ""}`} onClick={() => setFilter("approved")}>
          Approved
        </button>
        <button className={`btn btn-sm ${filter === "rejected" ? "btn-primary" : ""}`} onClick={() => setFilter("rejected")}>
          Rejected
        </button>
        <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : ""}`} onClick={() => setFilter("all")}>
          All
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {filtered.map((sub) => (
        <div key={sub.id} className="card submission-card">
          <div className="submission-header">
            <strong>{sub.team_name}</strong>
            {sub.shortname && <span className="tag">{sub.shortname}</span>}
            <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
          </div>
          <div className="submission-details">
            <p><strong>Captain:</strong> {sub.captain_name}</p>
            <p><strong>Contact:</strong> {sub.contact}</p>
            {sub.logo_url && <p><strong>Logo:</strong> <a href={sub.logo_url} target="_blank" rel="noreferrer">{sub.logo_url}</a></p>}
            {sub.notes && <p><strong>Notes:</strong> {sub.notes}</p>}
            <p className="submission-date">Submitted: {new Date(sub.created_at).toLocaleString()}</p>
          </div>
          {sub.status === "pending" && (
            <div className="card-actions">
              <button className="btn btn-primary btn-sm" onClick={() => handleApprove(sub)}>Approve</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleReject(sub)}>Reject</button>
            </div>
          )}
        </div>
      ))}
      {!filtered.length && <p className="loading">No {filter} submissions</p>}
    </div>
  );
}

export default TeamSubmissions;
