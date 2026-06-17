import { useState, useEffect } from "react";
import { apiUrl } from "../../../config/api";
import Toast from "../components/Toast";
import LoadingState from "../components/LoadingState";

function RegistrationSettings() {
  const [settings, setSettings] = useState({
    team_upload_enabled: true,
    team_upload_closed_message: "",
    team_upload_deadline_text: "",
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/registration-settings"), {
        headers: { "x-admin-token": localStorage.getItem("admin_token") },
      });
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setSettings({
        team_upload_enabled: data.team_upload_enabled,
        team_upload_closed_message: data.team_upload_closed_message || "",
        team_upload_deadline_text: data.team_upload_deadline_text || "",
      });
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/admin/registration-settings"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": localStorage.getItem("admin_token"),
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save settings");
      }

      showToast("Registration settings saved successfully");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState text="Loading settings..." />;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>Registration Settings</h2>
      </div>

      <div className="admin-card">
        <form onSubmit={handleSave}>
          <div className="admin-form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="team_upload_enabled"
                checked={settings.team_upload_enabled}
                onChange={handleChange}
                style={{ width: "20px", height: "20px" }}
              />
              <span style={{ fontSize: "16px", fontWeight: "600" }}>Team Upload / Registration Open</span>
            </label>
            <p className="admin-helper-text" style={{ marginTop: "8px", marginLeft: "30px" }}>
              If checked, the public can upload team logos and submit registrations. If unchecked, the upload form is closed.
            </p>
          </div>

          <div className="admin-form-group" style={{ marginTop: "24px" }}>
            <label>Closed Message (Optional)</label>
            <input
              type="text"
              className="admin-input"
              name="team_upload_closed_message"
              value={settings.team_upload_closed_message}
              onChange={handleChange}
              placeholder="e.g. Team registration and logo upload are now closed."
            />
            <p className="admin-helper-text">This message is shown to users when registration is closed.</p>
          </div>

          <div className="admin-form-group" style={{ marginTop: "24px" }}>
            <label>Upload Deadline Text (Optional)</label>
            <input
              type="text"
              className="admin-input"
              name="team_upload_deadline_text"
              value={settings.team_upload_deadline_text}
              onChange={handleChange}
              placeholder="e.g. June 17, 2026, 11:59 PM"
            />
          </div>

          <div style={{ marginTop: "32px" }}>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>

      {toast.message && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default RegistrationSettings;
