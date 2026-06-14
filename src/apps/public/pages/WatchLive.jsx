import { useState, useEffect } from "react";
import { getPublicLiveSettings } from "../../../services/api";
import { buildFacebookEmbedUrl } from "../../../config/live";
import EmptyState from "../../admin/components/EmptyState";

function WatchLive() {
  const [embedUrl, setEmbedUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicLiveSettings()
      .then((settings) => {
        if (settings.is_live_enabled && settings.facebook_live_url) {
          setEmbedUrl(buildFacebookEmbedUrl(settings.facebook_live_url));
        } else {
          setEmbedUrl("");
        }
      })
      .catch((err) => console.error("Failed to fetch live settings:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null; // or a simple loading state

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title-group">
          <h1>Watch Live</h1>
          <p className="admin-page-subtitle">Jeizi Productions Tournament Live Broadcast</p>
        </div>
      </div>

      <div className="admin-dashboard-chips" style={{ marginBottom: "24px" }}>
        <span>Facebook Live</span>
        <span>Public Broadcast</span>
        <span>SK Barangay MLBB Season 2</span>
      </div>

      {embedUrl ? (
        <div className="admin-card" style={{ padding: "16px" }}>
          <div className="admin-live-container" style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "10px", backgroundColor: "#000" }}>
            <iframe
              title="Facebook Live Broadcast"
              src={embedUrl}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>
          <p className="admin-page-subtitle" style={{ marginTop: "16px", textAlign: "center", fontSize: "13px" }}>
            If the live video does not load, make sure the Facebook Live post is public.
          </p>
        </div>
      ) : (
        <EmptyState
          icon="📡"
          title="No Facebook Live URL configured yet."
          description="Set VITE_FACEBOOK_LIVE_URL in your environment variables or update src/config/live.js for testing."
        />
      )}
    </div>
  );
}

export default WatchLive;
