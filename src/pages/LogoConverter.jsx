import React, { useState, useEffect } from "react";
import { adminGetTeams, adminNormalizeTeamLogo } from "../services/api";
import { apiUrl } from "../config/api";

// Helper to get absolute image URL (resolving local relative paths to backend port in development)
const getFullImageUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  return apiUrl(path);
};

/**
 * LogoConverter Component
 * 
 * Normalizes team logos to a perfect 1:1 square ratio with smart centering logic.
 * Integrates Option B: Full Server-side Processing using Sharp.
 * This completely avoids frontend CORS/Canvas tainting issues!
 * 
 * Props:
 * - team: Optional team object. If passed, it locks to this team.
 * - onComplete: Optional callback triggered after successful normalization.
 * - onClose: Optional callback to close the modal.
 */
export default function LogoConverter({ team: propTeam, onComplete, onClose }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(propTeam || null);
  const [loadingTeams, setLoadingTeams] = useState(!propTeam);
  
  // Customization parameters
  const [resolution, setResolution] = useState(512); // Output resolution (512 or 1024)
  const [margin, setMargin] = useState(90); // Content margin percentage (50 to 100)
  const [bgMode, setBgMode] = useState("detect"); // 'transparent', 'detect' (match), 'custom'
  const [customBgColor, setCustomBgColor] = useState("#ffffff");
  
  // Status & loading states
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" }); // 'success' | 'error' | 'info'

  // Fetch teams list if no propTeam is provided
  useEffect(() => {
    if (propTeam) {
      setSelectedTeam(propTeam);
      return;
    }
    
    setLoadingTeams(true);
    adminGetTeams()
      .then((data) => {
        setTeams(data || []);
      })
      .catch((err) => {
        setStatusMessage({ text: `Failed to load teams: ${err.message}`, type: "error" });
      })
      .finally(() => {
        setLoadingTeams(false);
      });
  }, [propTeam]);

  // Reset status when team selection changes
  useEffect(() => {
    setStatusMessage({ text: "", type: "" });
  }, [selectedTeam]);

  // Handle server-side logo normalization
  const handleNormalizeLogo = async () => {
    if (!selectedTeam) {
      setStatusMessage({ text: "Please select a team first.", type: "error" });
      return;
    }

    if (!selectedTeam.logo) {
      setStatusMessage({ text: "Selected team does not have a logo to normalize.", type: "error" });
      return;
    }

    setProcessing(true);
    setStatusMessage({ text: "Server is processing & normalising logo...", type: "info" });

    try {
      // Prepare payload parameters
      const payload = {
        resolution,
        margin,
        background: bgMode === "detect" ? "match" : bgMode === "transparent" ? "transparent" : customBgColor
      };

      // Call the backend endpoint
      const response = await adminNormalizeTeamLogo(selectedTeam.id, payload);

      setStatusMessage({ text: response.message || "Logo normalized and updated successfully!", type: "success" });
      
      if (onComplete) {
        onComplete(selectedTeam.id);
      }
    } catch (err) {
      console.error("Normalization failed", err);
      setStatusMessage({ text: `Failed to normalize logo: ${err.message}`, type: "error" });
    } finally {
      setProcessing(false);
    }
  };

  // Determine CSS preview styling to mock canvas behavior locally
  const getPreviewBgStyle = () => {
    if (bgMode === "transparent") return {};
    if (bgMode === "custom") return { backgroundColor: customBgColor };
    // For 'detect' mode, we can display a default dark background or transparent
    return { backgroundColor: "rgba(255, 255, 255, 0.05)" };
  };

  return (
    <div className="logo-converter-container">
      <style>{`
        .logo-converter-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
          color: #f3f4f6;
          font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
          background: #0b0f19;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }

        .logo-converter-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 1rem;
        }

        .logo-converter-header h1 {
          font-size: 1.8rem;
          font-weight: 700;
          margin: 0 0 0.25rem 0;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .logo-converter-header p {
          color: #9ca3af;
          margin: 0;
          font-size: 0.9rem;
        }

        .close-modal-btn {
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 1.5rem;
          cursor: pointer;
          transition: color 0.2s;
        }

        .close-modal-btn:hover {
          color: white;
        }

        .status-banner {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .status-banner.info {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }

        .status-banner.success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        .status-banner.error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .logo-converter-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2rem;
        }

        @media (max-width: 768px) {
          .logo-converter-layout {
            grid-template-columns: 1fr;
          }
        }

        .config-section {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .team-select-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .team-select-group select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.75rem;
          border-radius: 8px;
          outline: none;
          font-size: 1rem;
        }

        .config-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .config-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .config-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #d1d5db;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .config-value-badge {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          color: #9ca3af;
        }

        .btn-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .toggle-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #d1d5db;
          padding: 0.5rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.85rem;
        }

        .toggle-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .toggle-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .range-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
          outline: none;
        }

        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }

        .bg-options-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .color-picker-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.4rem;
          border-radius: 6px;
        }

        .color-picker-input {
          border: none;
          background: none;
          width: 32px;
          height: 32px;
          padding: 0;
          cursor: pointer;
        }

        .preview-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .preview-container {
          width: 100%;
          max-width: 320px;
          aspect-ratio: 1/1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          margin-bottom: 1.5rem;
          background-color: #1a202c;
          background-image: 
            linear-gradient(45deg, #0f172a 25%, transparent 25%), 
            linear-gradient(-45deg, #0f172a 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #0f172a 75%), 
            linear-gradient(-45deg, transparent 75%, #0f172a 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-sizing: border-box;
        }

        .preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }

        .preview-placeholder {
          color: #6b7280;
          text-align: center;
          font-size: 0.85rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .save-btn {
          width: 100%;
          max-width: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          color: white;
          padding: 0.85rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .save-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
        }

        .save-btn:disabled {
          background: rgba(255, 255, 255, 0.05);
          color: #4b5563;
          box-shadow: none;
          cursor: not-allowed;
        }
      `}</style>

      {/* Modal Header */}
      <div className="logo-converter-header">
        <div>
          <h1>Logo Normalizer & Cloud Sync</h1>
          <p>Instantly crop, scale, and save 1:1 square team logos directly on the server.</p>
        </div>
        {onClose && (
          <button type="button" className="close-modal-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Status Notifications */}
      {statusMessage.text && (
        <div className={`status-banner ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Layout grid */}
      <div className="logo-converter-layout">
        <div className="config-section">
          {/* Team Selector (if not locked by prop) */}
          <div className="team-select-group">
            <label className="config-label">Target Team</label>
            {loadingTeams ? (
              <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Loading team list...</span>
            ) : propTeam ? (
              <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", fontWeight: "600" }}>
                🎯 {selectedTeam?.name}
              </div>
            ) : (
              <select
                value={selectedTeam?.id || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const found = teams.find((t) => t.id === id);
                  setSelectedTeam(found || null);
                }}
              >
                <option value="">-- Choose a Team --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortname || "No shortname"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Configuration Card */}
          <div className="config-card">
            {/* Output Size */}
            <div className="config-group">
              <span className="config-label">
                Resolution <span className="config-value-badge">{resolution}px Square</span>
              </span>
              <div className="btn-group">
                <button
                  type="button"
                  className={`toggle-btn ${resolution === 512 ? "active" : ""}`}
                  onClick={() => setResolution(512)}
                >
                  512 x 512
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${resolution === 1024 ? "active" : ""}`}
                  onClick={() => setResolution(1024)}
                >
                  1024 x 1024
                </button>
              </div>
            </div>

            {/* Margins/Scale */}
            <div className="config-group">
              <span className="config-label">
                Content Margin (Scale) <span className="config-value-badge">{margin}%</span>
              </span>
              <input
                type="range"
                className="range-slider"
                min="50"
                max="100"
                step="5"
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value))}
              />
            </div>

            {/* Background Style */}
            <div className="config-group">
              <span className="config-label">Background Fill</span>
              <div className="bg-options-grid">
                <button
                  type="button"
                  className={`toggle-btn ${bgMode === "transparent" ? "active" : ""}`}
                  onClick={() => setBgMode("transparent")}
                >
                  Transparent
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${bgMode === "detect" ? "active" : ""}`}
                  onClick={() => setBgMode("detect")}
                >
                  Match Corner
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${bgMode === "custom" ? "active" : ""}`}
                  onClick={() => setBgMode("custom")}
                >
                  Custom
                </button>
              </div>
            </div>

            {bgMode === "custom" && (
              <div className="config-group">
                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    className="color-picker-input"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                  />
                  <span style={{ fontSize: "0.9rem" }}>{customBgColor.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: CSS-Based Live Preview & Server Sync Action */}
        <div className="preview-section">
          {/* Preview Container with custom background styling */}
          <div className="preview-container" style={getPreviewBgStyle()}>
            {selectedTeam?.logo ? (
              <img
                src={getFullImageUrl(selectedTeam.logo)}
                alt={`${selectedTeam.name} Current Logo`}
                className="preview-image"
                // Simulate output margin scale in real-time using CSS padding
                style={{
                  padding: `${(100 - margin) / 2}%`
                }}
              />
            ) : (
              <div className="preview-placeholder">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Select a team to preview logo</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="save-btn"
            disabled={!selectedTeam || !selectedTeam.logo || processing}
            onClick={handleNormalizeLogo}
          >
            {processing ? (
              <>
                <svg
                  className="animate-spin"
                  style={{ animation: "spin 1s linear infinite", marginRight: "8px" }}
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing on Server...</span>
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Save & Replace Logo</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
