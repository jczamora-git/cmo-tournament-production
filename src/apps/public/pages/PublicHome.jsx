import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTournaments } from "../../../services/api";
import { apiUrl } from "../../../config/api";

const MODAL_KEY = "jeizi_registration_modal_dismissed";

function RegistrationModal({ onClose, uploadUrl, tournament }) {
  const navigate = useNavigate();
  const name = tournament?.name;

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

  const isDatabaseTrue = (value) => value === true || value === 1 || value === "1" || value === "true";
  
  const REGISTRATION_STATUSES = new Set(["upcoming", "ongoing"]);
  
  const isRegistrationTournament = (tournament) => {
    const status = String(tournament?.status || "").trim().toLowerCase();
    return isDatabaseTrue(tournament?.is_active) && REGISTRATION_STATUSES.has(status);
  };

  const eligibleTournaments = tournaments.filter(isRegistrationTournament);
  
  const uploadUrl = eligibleTournaments.length === 1 
    ? `/upload-team?tournament=${eligibleTournaments[0].id}`
    : "/upload-team";

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
        backgroundImage: [
          "linear-gradient(to bottom, rgba(5,7,11,0.30) 0%, rgba(5,7,11,0.55) 45%, rgba(5,7,11,0.88) 78%, rgba(5,7,11,1) 100%)",
          "linear-gradient(to right, rgba(180,10,10,0.18) 0%, transparent 60%)",
          `url(${coverUrl})`,
        ].join(", "),
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  if (loading) {
    return (
      <section className="ph-hero">
        <div className="ph-hero__content">
          <div className="ph-hero__copy">
            <h1 className="ph-hero__title" style={{ opacity: 0.3 }}>Loading...</h1>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section className="ph-hero" style={heroStyle}>
        <div className="ph-hero__content">
          <div className="ph-hero__copy">
            {featured && (
              <p className="ph-hero__meta">
                {[featured.game_type, featured.season, featured.status?.toUpperCase()]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            )}

            <div className="ph-hero__title-row">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={featured?.name || "Tournament logo"}
                  className="ph-hero__logo"
                />
              )}
              <h1 className="ph-hero__title">
                {featured?.name || "Jeizi Productions Tournament"}
              </h1>
            </div>

            <p className="ph-hero__desc">
              {featured?.description || "Official tournament portal by Jeizi Productions."}
            </p>
            <div className="ph-hero__actions">
              <Link to="/schedule" className="ph-hero__btn-primary">
                View Schedule
              </Link>
              <div className="ph-hero__secondary-links">
                {uploadEnabled ? (
                  <Link to={uploadUrl} className="ph-hero__link">
                    Register Team
                  </Link>
                ) : (
                  <span className="ph-hero__link ph-hero__link--disabled">
                    Registration Closed
                  </span>
                )}
                <span className="ph-hero__link-sep">·</span>
                <Link to="/live" className="ph-hero__link">
                  Watch Live
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Non-hero page content ── */}
      <div className="public-page-content">
        {/* ── Tournament Information Sections ── */}
        {featured && (
          <div className="ph-info-sections">
            {/* Quick Status Bar */}
            <div className="ph-quick-status">
              <div className="ph-status-item">
                <span className="ph-status-label">Registration</span>
                <span className="ph-status-value" style={{ color: uploadEnabled ? "#4ade80" : "#94a3b8" }}>
                  {uploadEnabled ? "Open" : "Closed"}
                </span>
              </div>
              <div className="ph-status-item">
                <span className="ph-status-label">Tournament</span>
                <span className="ph-status-value">{featured.status === "ongoing" ? "In Progress" : featured.status === "upcoming" ? "Upcoming" : "Completed"}</span>
              </div>
              <div className="ph-status-item">
                <span className="ph-status-label">Live Broadcast</span>
                <span className="ph-status-value">Check Schedule</span>
              </div>
            </div>

            {/* Tournament Overview */}
            <section className="ph-section ph-overview-section">
              <div className="ph-overview-grid">
                <div className="ph-overview-left">
                  <h2 className="ph-section-title">About the Tournament</h2>
                  <p className="ph-overview-desc">
                    {featured.description || "The official tournament portal by Jeizi Productions."}
                  </p>
                </div>
                <div className="ph-overview-right">
                  <div className="ph-overview-details">
                    <div className="ph-detail-row">
                      <span className="ph-detail-label">Game</span>
                      <span className="ph-detail-value">{featured.game_type || "—"}</span>
                    </div>
                    <div className="ph-detail-row">
                      <span className="ph-detail-label">Season</span>
                      <span className="ph-detail-value">{featured.season || "—"}</span>
                    </div>
                    <div className="ph-detail-row">
                      <span className="ph-detail-label">Status</span>
                      <span className="ph-detail-value" style={{ textTransform: "capitalize" }}>{featured.status || "—"}</span>
                    </div>
                    {(featured.start_date || featured.end_date) && (
                      <div className="ph-detail-row">
                        <span className="ph-detail-label">Dates</span>
                        <span className="ph-detail-value">
                          {featured.start_date ? new Date(featured.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
                          {featured.end_date ? ` – ${new Date(featured.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
            
            {/* Tournament Divisions / Modes */}
            {featured.modes && featured.modes.length > 0 && (
              <section className="ph-section ph-modes-section">
                <h2 className="ph-section-title" style={{ marginBottom: "24px" }}>Tournament Divisions</h2>
                <div className="ph-modes-grid">
                  {featured.modes.map((mode) => (
                    <div key={mode.id || mode.code} className="ph-mode-card">
                      <h3 className="ph-mode-name">{mode.name}</h3>
                      <p className="ph-mode-type">{mode.competition_type === 'team' ? 'Team Competition' : 'Individual Competition'}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
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

      </div>

      {/* Registration Modal */}
      {showModal && eligibleTournaments.length > 0 && <RegistrationModal onClose={dismissModal} uploadUrl={uploadUrl} tournament={eligibleTournaments.length === 1 ? eligibleTournaments[0] : featured} />}
    </div>
  );
}

export default PublicHome;
