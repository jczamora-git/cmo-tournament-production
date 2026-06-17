import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { submitTeam } from "../../../services/api";
import { apiUrl } from "../../../config/api";

function UploadTeam() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    team_name: "",
    shortname: "",
    captain_name: "",
    contact: "",
    logo_url: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [success, setSuccess] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileRef = useRef(null);

  const VALID_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const triggerFileSelect = () => {
    if (fileRef.current) fileRef.current.click();
  };


  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploadStatus("");
    setUploading(true);

    // Validate type
    if (!VALID_TYPES.has(file.type)) {
      setUploadError("Invalid file type. Please upload PNG, JPG, or WebP.");
      setUploading(false);
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setUploadError("Logo file is too large. Please upload an image under 3MB.");
      setUploading(false);
      return;
    }

    try {
      // Step 1 — compress / convert to WebP
      setUploadStatus("Optimizing logo...");
      const { compressToWebp } = await import("../../../utils/imageCompressor");
      const webpBlob = await compressToWebp(file);

      // Step 2 — wrap in a File with a safe name (no spaces, parens, or original name)
      const safeFile = new File(
        [webpBlob],
        `team-logo-${Date.now()}.webp`,
        { type: "image/webp" },
      );

      // Step 3 — upload
      setUploadStatus("Uploading logo...");
      const formData = new FormData();
      formData.append("file", safeFile);

      const res = await fetch(apiUrl("/api/uploads/team-logo"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload failed");
      }

      const data = await res.json();
      setForm((prev) => ({ ...prev, logo_url: data.url }));
      setUploadedFileName(safeFile.name);
      setUploadStatus("Logo uploaded successfully");
    } catch (err) {
      setUploadError("Logo upload failed. Please try another image.");
      setUploadStatus("");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const removeLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: "" }));
    setUploadedFileName("");
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
      setShowSuccessModal(true);
      setForm({ team_name: "", shortname: "", captain_name: "", contact: "", logo_url: "", notes: "" });
      setUploadedFileName("");
      
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ph-section team-upload-page">
      <div className="ph-section-header">
        <div className="ph-hero-badges" style={{ marginBottom: "16px" }}>
          <span className="ph-hero-season">Team Registration</span>
          <span className="ph-hero-season" style={{ background: "rgba(220, 38, 38, 0.12)", color: "#fca5a5", borderColor: "rgba(220, 38, 38, 0.2)" }}>Admin Review Required</span>
        </div>
        <h2>Upload Team</h2>
        <p>Submit your squad for the current tournament.</p>
      </div>

      <div className="team-registration-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="admin-error-message">{error}</div>}
          {success && <div className="admin-error-message" style={{ backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "rgba(34, 197, 94, 0.4)", color: "#bbf7d0" }}>{success}</div>}

          <div className="form-group">
            <label>Team Name *</label>
            <p className="form-helper-text">Enter your official team name.</p>
            <input
              type="text"
              name="team_name"
              value={form.team_name}
              onChange={handleChange}
              placeholder="e.g. Team Liquid"
            />
          </div>

          <div className="form-group">
            <label>Short Name / Tag *</label>
            <p className="form-helper-text">Example: CMO, JZI, TNC</p>
            <input
              type="text"
              name="shortname"
              value={form.shortname}
              onChange={handleChange}
              placeholder="e.g. TL"
            />
          </div>

          <div className="form-group">
            <label>Team Logo *</label>
            <p className="form-helper-text">Upload your team logo in PNG, JPG, or WebP format. Max 3MB.</p>
            
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              hidden
            />

            {!form.logo_url && (
              <div 
                className={`custom-upload-card ${uploading ? "is-uploading" : ""}`}
                onClick={triggerFileSelect}
              >
                <svg className="custom-upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <div className="custom-upload-text">
                  {uploading ? (uploadStatus || "Uploading...") : "Choose Logo"}
                </div>
                {!uploading && <div className="custom-upload-subtext">Click to browse files</div>}
              </div>
            )}

            {form.logo_url && (
              <div className="upload-preview-container">
                <img src={form.logo_url} alt="Logo preview" className="upload-logo-preview" />
                <div className="upload-status">
                  <div className="upload-status-title">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    Logo uploaded successfully
                  </div>
                  <div className="upload-status-filename">{uploadedFileName || "Team Logo"}</div>
                </div>
                <div className="upload-actions">
                  <button type="button" className="ph-btn ph-btn-secondary" style={{ padding: "8px 12px", minHeight: "36px", fontSize: "13px" }} onClick={triggerFileSelect}>
                    Change
                  </button>
                  <button type="button" className="ph-btn ph-btn-secondary" style={{ padding: "8px 12px", minHeight: "36px", fontSize: "13px", color: "#fca5a5", borderColor: "rgba(220, 38, 38, 0.3)" }} onClick={removeLogo}>
                    Remove
                  </button>
                </div>
              </div>
            )}
            
            {uploadError && <p style={{ color: "#fca5a5", fontSize: "13px", marginTop: "8px" }}>{uploadError}</p>}
          </div>

          <div className="form-group">
            <label>Captain Name *</label>
            <p className="form-helper-text">Person admins can contact for this team.</p>
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
            <p className="form-helper-text">Use a phone number, Facebook profile, or Messenger link.</p>
            <input
              type="text"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              placeholder="e.g. 09xx-xxx-xxxx or m.me/username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: "32px" }}>
            <label>Notes</label>
            <p className="form-helper-text">Add player list, remarks, or other details if needed.</p>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any additional info about your team"
              rows={4}
            />
          </div>

          <button type="submit" className="ph-btn ph-btn-primary" style={{ width: "100%", fontSize: "16px", padding: "14px" }} disabled={loading || uploading}>
            {loading ? "Submitting..." : "Submit Team"}
          </button>
        </form>
      </div>

      {showSuccessModal && (
        <div className="submission-success-backdrop">
          <div className="submission-success-modal">
            <div className="submission-success-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="submission-success-title">Team Submitted Successfully!</h2>
            <p className="submission-success-message">
              Your team logo and details have been submitted. Please wait for admin approval.
            </p>
            <p style={{ color: "#64748b", fontSize: "13px" }}>Redirecting you back to the homepage...</p>
            
            <div className="submission-success-footer">
              <button 
                type="button" 
                className="ph-btn ph-btn-secondary" 
                onClick={() => navigate("/")}
                style={{ width: "100%" }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadTeam;
