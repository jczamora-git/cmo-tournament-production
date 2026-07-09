import React, { useState, useRef, useEffect } from "react";
import { adminGetTeams, adminUpdateTeam } from "../services/api";
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
 * Avoids CORS / Tainted Canvas issues by using a re-upload flow:
 * 1. Shows the team's current cloud logo as a standard <img> element.
 * 2. Requires a local file upload (drag & drop or click).
 * 3. Once uploaded locally, draws on canvas without security restrictions, allowing customization and upload.
 */
export default function LogoConverter({ team: propTeam, onComplete, onClose }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(propTeam || null);
  const [loadingTeams, setLoadingTeams] = useState(!propTeam);
  
  // Image & upload states
  const [imageSrc, setImageSrc] = useState(null); // Will hold the uploaded file data URL
  const [isUploaded, setIsUploaded] = useState(false); // True when a local file is loaded
  const [fileName, setFileName] = useState("logo");
  
  // Customization parameters
  const [outputSize, setOutputSize] = useState(512); // Default size 512x512
  const [scale, setScale] = useState(0.9); // Scale factor (0.5 to 1.0)
  const [bgMode, setBgMode] = useState("detect"); // 'transparent', 'detect', 'custom'
  const [customBgColor, setCustomBgColor] = useState("#ffffff");
  const [detectedBgColor, setDetectedBgColor] = useState("#ffffff");
  const [dragActive, setDragActive] = useState(false);
  const [imgElement, setImgElement] = useState(null);
  
  // Status & loading states
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" }); // 'success' | 'error' | 'info'

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Reset when team selection changes
  useEffect(() => {
    setIsUploaded(false);
    setImgElement(null);
    setImageSrc(null);
    setStatusMessage({ text: "", type: "" });
  }, [selectedTeam]);

  // Helper to detect background color by sampling the corner pixels of the image
  const detectBackgroundColor = (img) => {
    try {
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      tempCanvas.width = img.naturalWidth || img.width;
      tempCanvas.height = img.naturalHeight || img.height;
      tempCtx.drawImage(img, 0, 0);

      // Sample 4 corners: top-left, top-right, bottom-left, bottom-right
      const w = tempCanvas.width;
      const h = tempCanvas.height;
      const corners = [
        tempCtx.getImageData(0, 0, 1, 1).data,
        tempCtx.getImageData(w - 1, 0, 1, 1).data,
        tempCtx.getImageData(0, h - 1, 1, 1).data,
        tempCtx.getImageData(w - 1, h - 1, 1, 1).data,
      ];

      const rgbToHex = (r, g, b) => {
        return "#" + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        }).join("");
      };

      const colorCounts = {};
      let dominantColor = "#ffffff";
      let maxCount = 0;

      corners.forEach(([r, g, b, a]) => {
        if (a < 10) return; // Ignore transparent corners
        const hex = rgbToHex(r, g, b);
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        if (colorCounts[hex] > maxCount) {
          maxCount = colorCounts[hex];
          dominantColor = hex;
        }
      });

      return dominantColor;
    } catch (e) {
      console.warn("Could not read canvas pixels", e);
      return "#ffffff";
    }
  };

  // Load uploaded image into Image object
  useEffect(() => {
    if (!imageSrc || !isUploaded) return;

    const img = new Image();
    img.onload = () => {
      setImgElement(img);
      const detected = detectBackgroundColor(img);
      setDetectedBgColor(detected);
    };
    img.src = imageSrc;
  }, [imageSrc, isUploaded]);

  // Redraw canvas whenever parameters or image changes (only when local file is uploaded)
  useEffect(() => {
    if (!canvasRef.current || !isUploaded || !imgElement) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, outputSize, outputSize);

    // 1. Draw Background
    if (bgMode === "transparent") {
      // Keep it transparent (already cleared)
    } else if (bgMode === "detect") {
      ctx.fillStyle = detectedBgColor;
      ctx.fillRect(0, 0, outputSize, outputSize);
    } else if (bgMode === "custom") {
      ctx.fillStyle = customBgColor;
      ctx.fillRect(0, 0, outputSize, outputSize);
    }

    // 2. Draw Image
    const imgWidth = imgElement.naturalWidth || imgElement.width;
    const imgHeight = imgElement.naturalHeight || imgElement.height;

    // Smart Centering Logic:
    // Fit the image inside the target size * scale factor, maintaining aspect ratio.
    const maxBoundingSize = outputSize * scale;
    const widthRatio = maxBoundingSize / imgWidth;
    const heightRatio = maxBoundingSize / imgHeight;
    const finalScale = Math.min(widthRatio, heightRatio);

    const drawWidth = imgWidth * finalScale;
    const drawHeight = imgHeight * finalScale;

    const x = (outputSize - drawWidth) / 2;
    const y = (outputSize - drawHeight) / 2;

    // Draw the image (since it's a local object/data URL, this will never taint the canvas)
    ctx.drawImage(imgElement, x, y, drawWidth, drawHeight);
  }, [imgElement, outputSize, scale, bgMode, customBgColor, detectedBgColor, isUploaded]);

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPG, SVG, WebP).");
      return;
    }

    // Save filename without extension
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    setFileName(nameWithoutExt);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target.result);
      setIsUploaded(true);
      setStatusMessage({ text: "Logo loaded locally. Customization controls are now unlocked!", type: "info" });
    };
    reader.readAsDataURL(file);
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Upload/Save Converted Image
  const handleSaveAndUpload = async () => {
    if (!selectedTeam) {
      setStatusMessage({ text: "Please select a team first.", type: "error" });
      return;
    }

    if (!canvasRef.current || !isUploaded) {
      setStatusMessage({ text: "Please upload a logo file to convert.", type: "error" });
      return;
    }

    setUploading(true);
    setStatusMessage({ text: "Processing and uploading normalized logo...", type: "info" });

    try {
      // 1. Convert Canvas to Blob (no tainting error, since the source was a local file upload)
      const blob = await new Promise((resolve) => {
        canvasRef.current.toBlob((b) => resolve(b), "image/png");
      });

      if (!blob) {
        throw new Error("Failed to process image canvas.");
      }

      // 2. Prepare Form Data containing team data + processed file
      const formData = new FormData();
      formData.append("name", selectedTeam.name);
      if (selectedTeam.shortname) formData.append("shortname", selectedTeam.shortname);
      if (selectedTeam.captain_name) formData.append("captain_name", selectedTeam.captain_name);
      if (selectedTeam.contact) formData.append("contact", selectedTeam.contact);
      if (selectedTeam.tournament_id) formData.append("tournament_id", selectedTeam.tournament_id);
      if (selectedTeam.tournament_mode_id) formData.append("tournament_mode_id", selectedTeam.tournament_mode_id);
      
      // Append processed file
      formData.append("logo", blob, `${selectedTeam.name.toLowerCase().replace(/\s+/g, "_")}_1x1.png`);

      // 3. Update database via API
      await adminUpdateTeam(selectedTeam.id, formData);

      setStatusMessage({ text: "Logo normalized and successfully updated in database!", type: "success" });
      
      if (onComplete) {
        onComplete(selectedTeam.id);
      }
    } catch (err) {
      console.error("Upload failed", err);
      setStatusMessage({ text: `Failed to update logo: ${err.message}`, type: "error" });
    } finally {
      setUploading(false);
    }
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

        .upload-instruction-card {
          background: rgba(239, 68, 68, 0.05);
          border: 1px dashed rgba(239, 68, 68, 0.25);
          color: #f87171;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          text-align: center;
          font-weight: 500;
        }

        .upload-zone {
          border: 2px dashed rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 2rem 1rem;
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .upload-zone:hover, .upload-zone.drag-active {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }

        .upload-icon {
          width: 36px;
          height: 36px;
          margin: 0 auto 0.75rem auto;
          color: #9ca3af;
        }

        .upload-text strong {
          color: #3b82f6;
        }

        .upload-text p {
          margin: 0.25rem 0 0 0;
          font-size: 0.8rem;
          color: #6b7280;
        }

        .config-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          transition: opacity 0.3s ease;
        }

        .config-card.disabled {
          opacity: 0.4;
          pointer-events: none;
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
        }

        .preview-canvas, .preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
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
          <p>Instantly crop, scale, and save 1:1 square team logos directly to the cloud.</p>
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

          {/* Upload Instructions Banner if original cloud image is shown */}
          {!isUploaded && selectedTeam?.logo && (
            <div className="upload-instruction-card">
              ⚠️ To convert this logo, please re-upload the file below.
            </div>
          )}

          {/* Upload Area */}
          <div
            className={`upload-zone ${dragActive ? "drag-active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: "none" }}
            />
            <svg
              className="upload-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="upload-text">
              {isUploaded ? (
                <>
                  New logo loaded. Click or drag to replace.
                </>
              ) : (
                <>
                  <strong>Drag & drop logo file</strong> or <strong>click to upload</strong>
                </>
              )}
              <p>Supports PNG, JPG, SVG, WebP</p>
            </span>
          </div>

          {/* Configuration Card - Disabled until a file is locally uploaded */}
          <div className={`config-card ${!isUploaded ? "disabled" : ""}`}>
            {/* Output Size */}
            <div className="config-group">
              <span className="config-label">
                Resolution <span className="config-value-badge">{outputSize}px Square</span>
              </span>
              <div className="btn-group">
                <button
                  type="button"
                  className={`toggle-btn ${outputSize === 512 ? "active" : ""}`}
                  onClick={() => setOutputSize(512)}
                >
                  512 x 512
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${outputSize === 1024 ? "active" : ""}`}
                  onClick={() => setOutputSize(1024)}
                >
                  1024 x 1024
                </button>
              </div>
            </div>

            {/* Margins/Scale */}
            <div className="config-group">
              <span className="config-label">
                Inside Margin (Scale) <span className="config-value-badge">{Math.round(scale * 100)}%</span>
              </span>
              <input
                type="range"
                className="range-slider"
                min="0.5"
                max="1.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
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
                  Match Image
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

        {/* Right Side: Preview & Sync Action */}
        <div className="preview-section">
          <div className="preview-container">
            {isUploaded ? (
              // Display HTML Canvas for the active local editing flow
              <canvas
                ref={canvasRef}
                width={outputSize}
                height={outputSize}
                className="preview-canvas"
              />
            ) : selectedTeam?.logo ? (
              // Display a standard <img> element for the cloud logo (avoids canvas taint error)
              <img
                src={getFullImageUrl(selectedTeam.logo)}
                alt={`${selectedTeam.name} Current Logo`}
                className="preview-image"
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
                <span>No logo uploaded yet</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="save-btn"
            disabled={!selectedTeam || !isUploaded || uploading}
            onClick={handleSaveAndUpload}
          >
            {uploading ? (
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
                <span>Uploading...</span>
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
