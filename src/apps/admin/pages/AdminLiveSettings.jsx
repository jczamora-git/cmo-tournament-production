import { useState, useEffect } from "react";
import { adminGetLiveSettings, adminUpdateLiveSettings } from "../../../services/api";
import { buildFacebookEmbedUrl } from "../../../config/live";
import Toast from "../components/Toast";
import LoadingState from "../components/LoadingState";

function AdminLiveSettings() {
  const [url, setUrl] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  useEffect(() => {
    adminGetLiveSettings()
      .then((settings) => {
        setUrl(settings.facebook_live_url || "");
        setIsEnabled(settings.is_live_enabled || false);
      })
      .catch((err) => setToast({ message: err.message, type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminUpdateLiveSettings({
        facebook_live_url: url.trim(),
        is_live_enabled: isEnabled,
      });
      setToast({ message: "Live settings saved successfully", type: "success" });
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const embedUrl = buildFacebookEmbedUrl(url.trim());

  if (loading) return <LoadingState message="Loading settings..." />;

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title-group">
          <h1>Live Broadcast Settings</h1>
          <p className="admin-page-subtitle">Configure the Facebook Live broadcast for the public portal.</p>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-dashboard-main">
          <div className="admin-card">
            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label>Facebook Live URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.facebook.com/YOUR_PAGE/videos/YOUR_VIDEO_ID/"
                />
                <p className="admin-page-subtitle" style={{ marginTop: "6px", fontSize: "12px" }}>
                  Leave empty to clear the broadcast.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: "24px", flexDirection: "row", alignItems: "center", gap: "12px" }}>
                <input
                  type="checkbox"
                  id="enable-live"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  style={{ width: "auto", minHeight: "auto" }}
                />
                <label htmlFor="enable-live" style={{ marginBottom: 0, cursor: "pointer", textTransform: "none", color: "var(--jz-text-main)", fontSize: "15px" }}>
                  Enable Live Broadcast on Public Portal
                </label>
              </div>

              <button type="submit" className="button-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        </div>

        <div className="admin-dashboard-side">
          <div className="admin-card">
            <div className="admin-card-title-row">
              <div>
                <p className="admin-section-kicker">Preview</p>
                <h2>Broadcast Player</h2>
              </div>
            </div>
            
            {embedUrl ? (
              <div style={{ marginTop: "16px" }}>
                <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "10px", backgroundColor: "#000" }}>
                  <iframe
                    title="Facebook Live Preview"
                    src={embedUrl}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  />
                </div>
                {!isEnabled && (
                  <p className="admin-page-subtitle" style={{ marginTop: "12px", color: "#fca5a5", fontSize: "13px" }}>
                    Warning: Live broadcast is currently disabled and will not show on the public page.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "16px", padding: "32px 16px", textAlign: "center", border: "1px dashed var(--jz-border)", borderRadius: "10px", color: "var(--jz-text-muted)" }}>
                No preview available.<br/>Enter a valid Facebook URL.
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
    </div>
  );
}

export default AdminLiveSettings;
