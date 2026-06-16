import { useState, useEffect, useRef } from "react";
import { adminGetTournaments, adminCreateTournament, adminUpdateTournament, adminDeleteTournament, adminUploadTournamentImage } from "../../../services/api";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Toast from "../components/Toast";

function ImageUploadCard({ title, helper, url, onUrlChange, type, tournamentId, previewVariant }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFileSelect = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError("");
    setSuccess(false);
    setUploading(true);
    try {
      const result = await adminUploadTournamentImage(file, type, tournamentId);
      onUrlChange(result.url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = () => {
    onUrlChange("");
    setError("");
    setSuccess(false);
  };

  const isCover = previewVariant === "cover";

  return (
    <div className={`admin-upload-card ${isCover ? "admin-upload-card-cover" : "admin-upload-card-logo"}`}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={handleFileChange}
      />

      <div className="admin-upload-card-header">
        <div className="admin-upload-card-icon">
          {isCover ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          )}
        </div>
        <div className="admin-upload-card-title-group">
          <span className="admin-upload-card-title">{title}</span>
          <span className="admin-upload-helper-text">{helper}</span>
        </div>
      </div>

      {url && (
        <div className={`admin-upload-preview ${isCover ? "admin-upload-preview-cover" : "admin-upload-preview-logo"}`}>
          <img src={url} alt={title} />
        </div>
      )}

      {!url && !uploading && (
        <div className={`admin-upload-dropzone ${isCover ? "admin-upload-dropzone-cover" : "admin-upload-dropzone-logo"}`} onClick={handleFileSelect}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Click to upload or drag file here</span>
          <span className="admin-upload-formats">PNG, JPG, WebP</span>
        </div>
      )}

      {uploading && (
        <div className="admin-upload-status admin-upload-status-loading">
          <div className="admin-upload-spinner" />
          <span>Uploading...</span>
        </div>
      )}

      {error && (
        <div className="admin-upload-status admin-upload-status-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && !error && (
        <div className="admin-upload-status admin-upload-status-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Upload successful</span>
        </div>
      )}

      <div className="admin-upload-actions">
        <button type="button" className="button-secondary button-compact" onClick={handleFileSelect} disabled={uploading}>
          {url ? (isCover ? "Change Cover" : "Change Logo") : (isCover ? "Choose Cover" : "Choose Logo")}
        </button>
        {url && (
          <button type="button" className="button-ghost button-compact" onClick={handleClear} disabled={uploading}>
            Remove
          </button>
        )}
        <button type="button" className="button-ghost button-compact" onClick={() => setShowUrlInput(!showUrlInput)} style={{ marginLeft: "auto" }}>
          {showUrlInput ? "Hide URL" : "Paste URL"}
        </button>
      </div>

      {showUrlInput && (
        <div className="admin-upload-url-input">
          <label className="admin-upload-url-label">Or paste image URL</label>
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/image.png"
          />
        </div>
      )}
    </div>
  );
}

function ManageTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: "", slug: "", game_type: "MLBB", season: "", description: "",
    status: "upcoming", banner_url: "", logo_url: "", cover_image_url: "", logo_image_url: "",
    start_date: "", end_date: "", is_active: true
  });

  const fetchTournaments = () => {
    setLoading(true);
    adminGetTournaments()
      .then(setTournaments)
      .catch((err) => setToast({ message: err.message, type: "error" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleOpenForm = (tournament = null) => {
    if (tournament) {
      setEditingTournament(tournament);
      setFormData({
        name: tournament.name || "",
        slug: tournament.slug || "",
        game_type: tournament.game_type || "MLBB",
        season: tournament.season || "",
        description: tournament.description || "",
        status: tournament.status || "upcoming",
        banner_url: tournament.banner_url || "",
        logo_url: tournament.logo_url || "",
        cover_image_url: tournament.cover_image_url || "",
        logo_image_url: tournament.logo_image_url || "",
        start_date: tournament.start_date ? tournament.start_date.split('T')[0] : "",
        end_date: tournament.end_date ? tournament.end_date.split('T')[0] : "",
        is_active: tournament.is_active
      });
    } else {
      setEditingTournament(null);
      setFormData({
        name: "", slug: "", game_type: "MLBB", season: "", description: "",
        status: "upcoming", banner_url: "", logo_url: "", cover_image_url: "", logo_image_url: "",
        start_date: "", end_date: "", is_active: true
      });
    }
    setIsFormOpen(true);
  };

  const generateSlug = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleCoverChange = (url) => {
    setFormData({ ...formData, cover_image_url: url, banner_url: url });
  };

  const handleLogoChange = (url) => {
    setFormData({ ...formData, logo_image_url: url, logo_url: url });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (!dataToSave.slug && dataToSave.name) {
      dataToSave.slug = generateSlug(dataToSave.name);
    }

    setSaving(true);
    try {
      if (editingTournament) {
        await adminUpdateTournament(editingTournament.id, dataToSave);
        setToast({ message: "Tournament updated successfully", type: "success" });
      } else {
        await adminCreateTournament(dataToSave);
        setToast({ message: "Tournament created successfully", type: "success" });
      }
      setIsFormOpen(false);
      fetchTournaments();
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this tournament? This may affect associated videos.")) {
      try {
        await adminDeleteTournament(id);
        setToast({ message: "Tournament deleted successfully", type: "success" });
        fetchTournaments();
      } catch (err) {
        setToast({ message: err.message, type: "error" });
      }
    }
  };

  if (loading) return <LoadingState message="Loading tournaments..." />;

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title-group">
          <h1>Manage Tournaments</h1>
          <p className="admin-page-subtitle">Add, edit, and manage tournaments.</p>
        </div>
        <button className="button-primary" onClick={() => handleOpenForm()}>
          Add Tournament
        </button>
      </div>

      {isFormOpen ? (
        <div className="admin-card tournament-form" style={{ marginBottom: "24px" }}>
          <div className="tournament-form-header">
            <div>
              <h2>{editingTournament ? "Edit Tournament" : "New Tournament"}</h2>
              <p className="admin-page-subtitle" style={{ marginTop: "4px" }}>
                {editingTournament
                  ? "Update tournament details and branding assets."
                  : "Create a tournament event with branding, schedule, and game type."}
              </p>
            </div>
            <button className="button-secondary button-compact" onClick={() => setIsFormOpen(false)}>Cancel</button>
          </div>

          <form onSubmit={handleSave} className="tournament-form-body">
            {/* Section: Basic Information */}
            <div className="tournament-form-section">
              <div className="tournament-form-section-title">
                <span className="tournament-form-section-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </span>
                <span>Basic Information</span>
              </div>

              <div className="tournament-form-grid">
                <div className="form-group tournament-form-full">
                  <label>Tournament Name</label>
                  <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. SK Barangay MLBB Season 2" />
                </div>
                <div className="form-group tournament-form-full">
                  <label>Slug (Auto-generated if empty)</label>
                  <input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="e.g. sk-mlbb-s2" />
                </div>
                <div className="form-group">
                  <label>Game Type</label>
                  <select value={formData.game_type} onChange={(e) => setFormData({ ...formData, game_type: e.target.value })}>
                    <option value="MLBB">MLBB</option>
                    <option value="HOK">HOK</option>
                    <option value="CODM">CODM</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Season</label>
                  <input value={formData.season} onChange={(e) => setFormData({ ...formData, season: e.target.value })} placeholder="e.g. Season 2" />
                </div>
                <div className="form-group tournament-form-full">
                  <label>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Brief description of the tournament..."></textarea>
                </div>
              </div>
            </div>

            {/* Section: Schedule */}
            <div className="tournament-form-section">
              <div className="tournament-form-section-title">
                <span className="tournament-form-section-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </span>
                <span>Schedule</span>
              </div>

              <div className="tournament-form-grid">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
                <div className="form-group tournament-form-full">
                  <div className="tournament-toggle-row">
                    <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                    <label htmlFor="is_active" className="tournament-toggle-label">
                      <span className="tournament-toggle-title">Active Tournament</span>
                      <span className="tournament-toggle-desc">Visible to the public when enabled</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Branding */}
            <div className="tournament-form-section">
              <div className="tournament-form-section-title">
                <span className="tournament-form-section-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </span>
                <span>Tournament Branding</span>
              </div>

              <div className="tournament-branding-grid">
                <ImageUploadCard
                  title="Tournament Cover Image"
                  helper="Recommended for hero/banner background."
                  url={formData.cover_image_url || formData.banner_url}
                  onUrlChange={handleCoverChange}
                  type="cover"
                  tournamentId={editingTournament?.id}
                  previewVariant="cover"
                />
                <ImageUploadCard
                  title="Tournament Logo Image"
                  helper="Recommended transparent PNG or square logo."
                  url={formData.logo_image_url || formData.logo_url}
                  onUrlChange={handleLogoChange}
                  type="logo"
                  tournamentId={editingTournament?.id}
                  previewVariant="logo"
                />
              </div>
            </div>

            {/* Section: Actions */}
            <div className="tournament-form-actions">
              <button type="submit" className="button-primary tournament-form-save" disabled={saving || uploading}>
                {saving ? "Saving Tournament..." : "Save Tournament"}
              </button>
              <button type="button" className="button-secondary" onClick={() => setIsFormOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isFormOpen && tournaments.length === 0 ? (
        <EmptyState icon="🏆" title="No tournaments found" description="Create a tournament to get started." />
      ) : (
        <div className="admin-matches-list">
          {!isFormOpen && tournaments.map((t) => (
            <div key={t.id} className="admin-match-card tournament-list-card">
              <div className="tournament-list-card-top">
                {(t.cover_image_url || t.banner_url) ? (
                  <div className="tournament-list-cover">
                    <img src={t.cover_image_url || t.banner_url} alt={t.name} />
                  </div>
                ) : (
                  <div className="tournament-list-cover tournament-list-cover-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                )}
                <div className="tournament-list-badges">
                  <span className="admin-match-mode-pill">{t.game_type}</span>
                  <span className={`status-badge status-${t.status === 'ongoing' ? 'live' : t.status === 'upcoming' ? 'upcoming' : 'finished'}`}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="tournament-list-body">
                <div className="tournament-list-info">
                  {(t.logo_image_url || t.logo_url) ? (
                    <img className="tournament-list-logo" src={t.logo_image_url || t.logo_url} alt="" />
                  ) : (
                    <div className="tournament-list-logo-fallback">
                      {t.name?.charAt(0)?.toUpperCase() || "T"}
                    </div>
                  )}
                  <div className="tournament-list-meta">
                    <h3>{t.name}</h3>
                    {t.season && <span className="tournament-list-season">{t.season}</span>}
                    <span className="tournament-list-slug">{t.slug}</span>
                  </div>
                </div>
                {!t.is_active && <span className="tournament-list-inactive">Inactive</span>}
              </div>
              <div className="admin-match-controls">
                <button className="button-secondary button-compact" onClick={() => handleOpenForm(t)}>Edit</button>
                <button className="button-danger button-compact" onClick={() => handleDelete(t.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
    </div>
  );
}

export default ManageTournaments;
