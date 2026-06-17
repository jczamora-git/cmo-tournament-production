import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTournaments } from "../../../services/api";
import { apiUrl } from "../../../config/api";

const MODAL_KEY = "jeizi_registration_modal_dismissed";

function RegistrationModal({ onClose, tournament }) {
  const navigate = useNavigate();
  const name = tournament?.name;
  const uploadUrl = tournament ? `/upload-team?tournament=${tournament.id}` : "/upload-team";

  return (
    <div className="ph-modal-backdrop" onClick={onClose}>
      <div className="ph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ph-modal-icon">🏆</div>
        <h2>
          {name
            ? `Are you registered on this ${name} event?`
            : "Are you registered on this tournament event?"}
        </h2>
        <p className="ph-modal-sub">
          Upload your team logo and submit your team details now.
        </p>
        <div className="ph-modal-actions">
          <button
            className="ph-btn ph-btn-primary"
            onClick={() => navigate(uploadUrl)}
          >
            Upload Team Logo / Register Team
          </button>
          <button className="ph-modal-dismiss" onClick={onClose}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

function TournamentCard({ tournament }) {
  const coverUrl = tournament.cover_image_url || tournament.banner_url;
  const logoUrl = tournament.logo_image_url || tournament.logo_url;

  return (
    <div className="ph-tournament-card">
      {coverUrl && (
        <div className="ph-tournament-card-cover">
          <img src={coverUrl} alt={tournament.name} />
        </div>
      )}
      <div className="ph-tournament-card-body">
        <div className="ph-featured-top">
          {logoUrl && (
            <img src={logoUrl} alt="" className="ph-tournament-card-logo" />
          )}
          <span className="ph-featured-game">{tournament.game_type}</span>
          <span className="ph-featured-status">{tournament.status.toUpperCase()}</span>
        </div>
        <h3>{tournament.name}</h3>
        {tournament.season && <p className="ph-tournament-card-season">{tournament.season}</p>}
        {tournament.description && <p className="ph-featured-desc">{tournament.description}</p>}
        <Link to={`/videos?tournament=${tournament.id}`} className="ph-btn ph-btn-secondary" style={{ marginTop: "auto" }}>
          View Videos &rarr;
        </Link>
      </div>
    </div>
  );
}

function PublicHome() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getTournaments()
      .then((data) => setTournaments(data || []))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));

    fetch(apiUrl("/api/public-settings"))
      .then((res) => res.json())
      .then((data) => setUploadEnabled(data.team_upload_enabled !== false))
      .catch(() => setUploadEnabled(true));
  }, []);

  useEffect(() => {
    if (!loading) {
      const dismissed = sessionStorage.getItem(MODAL_KEY);
      if (!dismissed && uploadEnabled) {
        const timer = setTimeout(() => setShowModal(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading]);

  const dismissModal = () => {
    setShowModal(false);
    sessionStorage.setItem(MODAL_KEY, "true");
  };

  const featured =
    tournaments.find((t) => t.status === "ongoing" && t.is_active) ||
    tournaments.find((t) => t.status === "upcoming" && t.is_active) ||
    tournaments.find((t) => t.is_active) ||
    tournaments[0] ||
    null;

  const coverUrl = featured?.cover_image_url || featured?.banner_url || null;
  const logoUrl = featured?.logo_image_url || featured?.logo_url || null;

  const heroStyle = coverUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(5,7,11,0.72) 0%, rgba(5,7,11,0.92) 100%), url(${coverUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  if (loading) {
    return (
      <div>
        <section className="ph-hero">
          <span className="ph-hero-eyebrow">Jeizi Productions Tournament</span>
          <h1 style={{ opacity: 0.4 }}>Loading...</h1>
        </section>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="ph-hero" style={heroStyle}>
        {logoUrl && (
          <img src={logoUrl} alt="" className="ph-hero-logo" />
        )}
        <span className="ph-hero-eyebrow">Jeizi Productions Tournament</span>
        <h1>{featured?.name || "Jeizi Productions Tournament"}</h1>
        <p className="ph-hero-subtitle">
          {featured?.description || "Official tournament portal by Jeizi Productions."}
        </p>
        {featured && (
          <div className="ph-hero-badges">
            <span className="ph-featured-game">{featured.game_type}</span>
            <span className="ph-featured-status">{featured.status.toUpperCase()}</span>
            {featured.season && <span className="ph-hero-season">{featured.season}</span>}
          </div>
        )}
        <div className="ph-hero-actions">
          {uploadEnabled ? (
            <Link to={featured ? `/upload-team?tournament=${featured.id}` : "/upload-team"} className="ph-btn ph-btn-primary">
              Upload Team
            </Link>
          ) : (
            <Link to="/upload-team" className="ph-btn ph-btn-secondary" style={{ opacity: 0.7 }}>
              Registration Closed
            </Link>
          )}
          <Link to="/live" className="ph-btn ph-btn-blue">
            Watch Live
          </Link>
          <Link to="/matches" className="ph-btn ph-btn-secondary">
            View Matches
          </Link>
        </div>
      </section>

      {/* Featured Tournament */}
      {featured && (
        <section className="ph-section">
          <div className="ph-section-header">
            <h2>Featured Tournament</h2>
            <p>The current active tournament event.</p>
          </div>
          <div className="ph-featured">
            <div className="ph-featured-top">
              {logoUrl && (
                <img src={logoUrl} alt="" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain", border: "1px solid rgba(148,163,184,0.16)" }} />
              )}
              <span className="ph-featured-game">{featured.game_type}</span>
              <span className="ph-featured-status">{featured.status.toUpperCase()}</span>
              {featured.season && <span className="ph-hero-season">{featured.season}</span>}
            </div>
            <h3>{featured.name}</h3>
            <p className="ph-featured-desc">
              {featured.description || "Official tournament portal by Jeizi Productions."}
            </p>
            <div className="ph-featured-actions">
              <Link to={`/videos?tournament=${featured.id}`} className="ph-btn ph-btn-secondary">
                View Videos &rarr;
              </Link>
              <Link to="/tournaments" className="ph-btn ph-btn-secondary">
                View Tournament
              </Link>
              {uploadEnabled && (
                <Link to={`/upload-team?tournament=${featured.id}`} className="ph-btn ph-btn-primary">
                  Upload Team
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Active & Recent Tournaments */}
      {tournaments.length > 0 && (
        <section className="ph-section">
          <div className="ph-section-header">
            <h2>Active &amp; Recent Tournaments</h2>
            <p>Browse all current and past tournament events.</p>
          </div>
          <div className="ph-tournament-grid">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}

      {/* Action Tiles */}
      <section className="ph-section">
        <div className="ph-section-header">
          <h2>Tournament Hub</h2>
          <p>Everything you need in one place.</p>
        </div>
        <div className="ph-tiles">
          <Link to="/upload-team" className="ph-tile">
            <div className="ph-tile-icon" style={{ background: uploadEnabled ? undefined : "rgba(148, 163, 184, 0.12)", borderColor: uploadEnabled ? undefined : "rgba(148, 163, 184, 0.2)", color: uploadEnabled ? undefined : "#94a3b8" }}>📋</div>
            <div className="ph-tile-content">
              <h3 style={{ color: uploadEnabled ? undefined : "#94a3b8" }}>{uploadEnabled ? "Register Team" : "Registration Closed"}</h3>
              <p>{uploadEnabled ? "Submit your team details and logo for the tournament." : "Team registration and logo upload are now closed."}</p>
            </div>
          </Link>
          <Link to="/live" className="ph-tile">
            <div className="ph-tile-icon is-green">📡</div>
            <div className="ph-tile-content">
              <h3>Watch Live</h3>
              <p>Watch the official tournament broadcast in real-time.</p>
            </div>
          </Link>
          <Link to="/tournaments" className="ph-tile">
            <div className="ph-tile-icon is-blue">🎮</div>
            <div className="ph-tile-content">
              <h3>Browse Tournaments</h3>
              <p>View all tournaments and event details.</p>
            </div>
          </Link>
          <Link to="/videos" className="ph-tile">
            <div className="ph-tile-icon is-orange">🎬</div>
            <div className="ph-tile-content">
              <h3>Video Archives</h3>
              <p>Replay past broadcasts and tournament highlights.</p>
            </div>
          </Link>
          <Link to="/matches" className="ph-tile">
            <div className="ph-tile-icon is-blue">⚔️</div>
            <div className="ph-tile-content">
              <h3>Match Schedule</h3>
              <p>Check current and upcoming match schedules.</p>
            </div>
          </Link>
          <Link to="/bracket" className="ph-tile">
            <div className="ph-tile-icon">🏆</div>
            <div className="ph-tile-content">
              <h3>Tournament Bracket</h3>
              <p>View elimination bracket and team standings.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Watch Section */}
      <section className="ph-section">
        <div className="ph-watch">
          <h2>Watch the Action</h2>
          <p>
            Follow live broadcasts and replay archives from recent tournaments.
          </p>
          <div className="ph-watch-actions">
            <Link to="/live" className="ph-btn ph-btn-blue">
              Watch Live
            </Link>
            <Link to="/videos" className="ph-btn ph-btn-secondary">
              View Videos
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="ph-footer-cta">
        <h2>{uploadEnabled ? "Ready to join the tournament?" : "Tournament in progress"}</h2>
        <button
          className={uploadEnabled ? "ph-btn ph-btn-primary" : "ph-btn ph-btn-secondary"}
          onClick={() => navigate("/upload-team")}
          style={!uploadEnabled ? { opacity: 0.7 } : {}}
        >
          {uploadEnabled ? "Submit Your Team" : "Registration Closed"}
        </button>
      </section>

      {/* Registration Modal */}
      {showModal && <RegistrationModal onClose={dismissModal} tournament={featured} />}
    </div>
  );
}

export default PublicHome;
