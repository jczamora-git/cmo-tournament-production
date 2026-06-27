import { useState, useEffect, useCallback } from "react";
import { adminGetTeams, adminCreateTeam, adminUpdateTeam, adminDeleteTeam, adminGetTournaments, getTournamentModes } from "../../../services/api";
import Toast from "../components/Toast";
import ConfirmationModal from "../components/ConfirmationModal";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";

function ManageTeams() {
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [shortname, setShortname] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [contact, setContact] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [modeId, setModeId] = useState("");
  const [modesForSelected, setModesForSelected] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filters
  const [filterTournamentId, setFilterTournamentId] = useState("");
  const [filterModeId, setFilterModeId] = useState("");
  const [filterModes, setFilterModes] = useState([]);

  const fetchTeams = useCallback(async () => {
    try {
      const params = {};
      if (filterTournamentId) params.tournament_id = filterTournamentId;
      if (filterModeId) params.tournament_mode_id = filterModeId;
      const data = await adminGetTeams(params);
      setTeams(data);
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filterTournamentId, filterModeId]);

  const fetchTournaments = useCallback(async () => {
    try {
      const data = await adminGetTournaments();
      setTournaments(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);
  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  // Load modes when filter tournament changes
  useEffect(() => {
    if (filterTournamentId) {
      getTournamentModes(filterTournamentId).then(setFilterModes).catch(() => setFilterModes([]));
    } else {
      setFilterModes([]);
      setFilterModeId("");
    }
  }, [filterTournamentId]);

  // Load modes for the form tournament selector
  useEffect(() => {
    if (tournamentId) {
      getTournamentModes(tournamentId).then(setModesForSelected).catch(() => setModesForSelected([]));
    } else {
      setModesForSelected([]);
      setModeId("");
    }
  }, [tournamentId]);

  const resetForm = () => {
    setName("");
    setShortname("");
    setCaptainName("");
    setContact("");
    setLogoUrl("");
    setTournamentId("");
    setModeId("");
    setModesForSelected([]);
    setEditingId(null);
    setFormError("");
    setModalOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (team) => {
    setEditingId(team.id);
    setName(team.name);
    setShortname(team.shortname || "");
    setCaptainName(team.captain_name || "");
    setContact(team.contact || "");
    setLogoUrl(team.logo || "");
    setTournamentId(team.tournament_id ? String(team.tournament_id) : "");
    setModeId(team.tournament_mode_id ? String(team.tournament_mode_id) : "");
    setFormError("");
    setModalOpen(true);
    // Modes will load via useEffect when tournamentId changes
  };

  const handleTournamentChange = (val) => {
    setTournamentId(val);
    setModeId(""); // Reset mode when tournament changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setFormError("");

    if (!name.trim()) {
      setFormError("Team name is required");
      return;
    }

    // Require tournament and mode for new teams
    if (!editingId) {
      if (!tournamentId) {
        setFormError("Tournament is required for new teams");
        return;
      }
      if (!modeId) {
        setFormError("Mode / Division is required for new teams");
        return;
      }
    }

    setSaving(true);
    let success = false;
    try {
      const payload = {
        name: name.trim(),
        shortname: shortname.trim() || null,
        captain_name: captainName.trim() || null,
        contact: contact.trim() || null,
        logo: logoUrl.trim() || null,
      };
      if (tournamentId) payload.tournament_id = Number(tournamentId);
      if (modeId) payload.tournament_mode_id = Number(modeId);

      if (editingId) {
        await adminUpdateTeam(editingId, payload);
        setToast({ message: "Team updated successfully", type: "success" });
      } else {
        const result = await adminCreateTeam(payload);
        setToast({ message: result?.message || "Team created successfully", type: "success" });
      }
      resetForm();
      success = true;
    } catch (err) {
      console.error("Team save failed:", err);
      setFormError(err.message || "Failed to save team.");
    } finally {
      setSaving(false);
    }

    if (success) {
      try {
        await fetchTeams();
      } catch (refreshErr) {
        console.error("Team saved, but refreshing the list failed:", refreshErr);
        setToast({ message: "Team saved, but the list could not be refreshed. Please refresh the page.", type: "warning" });
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteTeam(deleteTarget.id);
      setToast({ message: `"${deleteTarget.name}" deleted`, type: "success" });
      setDeleteTarget(null);
      fetchTeams();
    } catch (err) {
      setToast({ message: err.message, type: "error" });
      setDeleteTarget(null);
    }
  };

  if (loading) return <LoadingState message="Loading teams..." />;

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title-group">
          <h1>Manage Teams</h1>
          <p className="admin-page-subtitle">Add, edit, and manage tournament teams.</p>
        </div>
        <button type="button" className="button-primary" onClick={openAdd}>
          + Add Team
        </button>
      </div>

      {/* Filters */}
      <div className="admin-filter-bar" style={{ marginBottom: "16px", gap: "8px", flexWrap: "wrap" }}>
        <select
          value={filterTournamentId}
          onChange={(e) => { setFilterTournamentId(e.target.value); setFilterModeId(""); }}
          style={{ minWidth: "180px" }}
        >
          <option value="">All Tournaments</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {filterTournamentId && filterModes.length > 0 && (
          <select
            value={filterModeId}
            onChange={(e) => setFilterModeId(e.target.value)}
            style={{ minWidth: "160px" }}
          >
            <option value="">All Modes</option>
            {filterModes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No teams yet"
          description="Create your first team to get started."
        >
          <button type="button" className="button-primary" onClick={openAdd} style={{ marginTop: "8px" }}>
            + Add Team
          </button>
        </EmptyState>
      ) : (
        <div className="admin-table-container">
          <table className="admin-teams-table">
            <thead>
              <tr>
                <th className="th-number">#</th>
                <th className="th-team">Team</th>
                <th className="th-shortname">Shortname</th>
                <th className="th-captain">Captain</th>
                <th className="th-mode">Mode</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => {
                const modeText = team.mode_code || team.mode_name || team.tournament_mode_id || "—";
                const modeLower = String(modeText).toLowerCase();
                let badgeClass = "mode-default";
                if (modeLower.includes("mp") || modeLower.includes("multiplayer")) badgeClass = "mode-mp";
                else if (modeLower.includes("br") || modeLower.includes("battle royale")) badgeClass = "mode-br";
                else if (modeLower.includes("moba")) badgeClass = "mode-moba";
                else if (modeLower.includes("magic chess") || modeLower.includes("mc")) badgeClass = "mode-mc";

                return (
                  <tr key={team.id}>
                    <td className="td-number">
                      <span className="admin-table-td-label">#</span>
                      {index + 1}
                    </td>
                    <td className="td-team">
                      <span className="admin-table-td-label">Team</span>
                      {team.logo ? (
                        <img src={team.logo} alt={team.name} className="td-team-logo" />
                      ) : (
                        <div className="td-team-logo-fallback">
                          {(team.shortname || team.name)?.[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <span>{team.name}</span>
                    </td>
                    <td className="td-shortname">
                      <span className="admin-table-td-label">Shortname</span>
                      {team.shortname || "—"}
                    </td>
                    <td className="td-captain">
                      <span className="admin-table-td-label">Captain</span>
                      {team.captain_name || "—"}
                    </td>
                    <td className="td-mode">
                      <span className="admin-table-td-label">Mode</span>
                      <span className={`admin-mode-badge ${badgeClass}`}>
                        {modeText}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div className="admin-team-actions">
                        <button type="button" className="button-ghost button-compact" onClick={() => openEdit(team)}>
                          Edit
                        </button>
                        <button type="button" className="button-danger-outline button-compact" onClick={() => setDeleteTarget(team)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal-panel">
            <div className="admin-modal-header">
              <h2>{editingId ? "Edit Team" : "Add Team"}</h2>
              <button type="button" className="admin-modal-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                {formError && <div className="admin-error-message">{formError}</div>}

                <div className="form-group">
                  <label>Tournament *</label>
                  <select value={tournamentId} onChange={(e) => handleTournamentChange(e.target.value)}>
                    <option value="">Select tournament</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {tournamentId && (
                  <div className="form-group">
                    <label>Mode / Division *</label>
                    <select value={modeId} onChange={(e) => setModeId(e.target.value)}>
                      <option value="">Select mode</option>
                      {modesForSelected.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Team Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Team Liquid"
                    autoFocus
                  />
                </div>
                <div className="admin-form-row">
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
                    <label>Logo URL</label>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="form-group">
                    <label>Captain Name</label>
                    <input
                      type="text"
                      value={captainName}
                      onChange={(e) => setCaptainName(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact</label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="button-ghost" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="button-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Team" : "Add Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete Team"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
    </div>
  );
}

export default ManageTeams;
