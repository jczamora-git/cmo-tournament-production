import { useState, useEffect, useCallback } from "react";
import { adminGetSubmissions, adminApproveSubmission, adminRejectSubmission } from "../../../services/api";
import Toast from "../components/Toast";
import ConfirmationModal from "../components/ConfirmationModal";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";

function TeamSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [filter, setFilter] = useState("pending");
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const data = await adminGetSubmissions();
      setSubmissions(data);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { sub, action } = confirmAction;
    try {
      if (action === "approve") {
        await adminApproveSubmission(sub.id, {
          team_name: sub.team_name,
          shortname: sub.shortname,
          logo_url: sub.logo_url,
        });
        setToast({ message: `"${sub.team_name}" approved`, type: "success" });
      } else {
        await adminRejectSubmission(sub.id);
        setToast({ message: `"${sub.team_name}" rejected`, type: "success" });
      }
      fetchSubmissions();
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setConfirmAction(null);
    }
  };

  const filtered = submissions.filter((s) => filter === "all" || s.status === filter);
  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  if (loading) return <LoadingState message="Loading submissions..." />;

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title-group">
          <h1>Team Submissions</h1>
          <p className="admin-page-subtitle">Review and manage team registration submissions.</p>
        </div>
      </div>

      <div className="admin-filter-bar">
        <button
          type="button"
          className={`admin-filter-pill${filter === "pending" ? " is-active" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          className={`admin-filter-pill${filter === "approved" ? " is-active" : ""}`}
          onClick={() => setFilter("approved")}
        >
          Approved
        </button>
        <button
          type="button"
          className={`admin-filter-pill${filter === "rejected" ? " is-active" : ""}`}
          onClick={() => setFilter("rejected")}
        >
          Rejected
        </button>
        <button
          type="button"
          className={`admin-filter-pill${filter === "all" ? " is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title={`No ${filter} submissions`}
          description={filter === "pending" ? "All submissions have been reviewed." : `No ${filter} submissions found.`}
        />
      ) : (
        <div className="admin-submission-list">
          {filtered.map((sub) => (
            <div key={sub.id} className="admin-submission-card">
              <div className="admin-submission-header">
                <strong>{sub.team_name}</strong>
                {sub.shortname && <span className="admin-submission-tag">{sub.shortname}</span>}
                <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
              </div>
              <div className="admin-submission-details">
                <p><strong>Captain:</strong> {sub.captain_name}</p>
                <p><strong>Contact:</strong> {sub.contact}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", marginBottom: "8px" }}>
                  {sub.logo_url ? (
                    <>
                      <img
                        src={sub.logo_url}
                        alt={`${sub.team_name} logo`}
                        style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "contain", border: "1px solid var(--jz-border)", background: "rgba(0,0,0,0.3)" }}
                      />
                      <a href={sub.logo_url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "var(--jz-text-soft)" }}>View full logo</a>
                    </>
                  ) : (
                    <div style={{ width: "48px", height: "48px", borderRadius: "8px", border: "1px solid var(--jz-border)", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "var(--jz-text-soft)" }}>
                      {sub.shortname ? sub.shortname.slice(0, 3).toUpperCase() : "?"}
                    </div>
                  )}
                </div>
                {sub.notes && <p><strong>Notes:</strong> {sub.notes}</p>}
                <p className="admin-submission-date">
                  Submitted: {new Date(sub.created_at).toLocaleString()}
                </p>
              </div>
              {sub.status === "pending" && (
                <div className="admin-submission-actions">
                  <button
                    type="button"
                    className="button-success button-compact"
                    onClick={() => setConfirmAction({ sub, action: "approve" })}
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    className="button-danger-outline button-compact"
                    onClick={() => setConfirmAction({ sub, action: "reject" })}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        open={!!confirmAction}
        title={confirmAction?.action === "approve" ? "Approve Team" : "Reject Team"}
        message={
          confirmAction?.action === "approve"
            ? `Approve "${confirmAction?.sub?.team_name}" and add them to the tournament?`
            : `Reject "${confirmAction?.sub?.team_name}"? They will need to resubmit.`
        }
        confirmText={confirmAction?.action === "approve" ? "Approve" : "Reject"}
        variant={confirmAction?.action === "reject" ? "danger" : undefined}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
    </div>
  );
}

export default TeamSubmissions;
