import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTournaments } from "../../../services/api";
import LoadingState from "../../admin/components/LoadingState";
import EmptyState from "../../admin/components/EmptyState";

function ViewTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTournaments()
      .then(setTournaments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading tournaments..." />;
  if (error) return <EmptyState icon="⚠️" title="Error loading tournaments" description={error} />;

  return (
    <div>
      <header className="public-page-header">
        <h1>Tournaments</h1>
        <p>Browse all official esports tournaments.</p>
      </header>

      {tournaments.length === 0 ? (
        <EmptyState icon="🏆" title="No tournaments available" description="Check back later for upcoming events." />
      ) : (
        <div className="tournaments-grid">
          {tournaments.map((t) => {
            const coverUrl = t.cover_image_url || t.banner_url;
            const logoUrl = t.logo_image_url || t.logo_url;

            return (
              <Link key={t.id} to={`/videos?tournament=${t.id}`} className="admin-card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
                {coverUrl && (
                  <div style={{ width: "100%", height: "140px", overflow: "hidden" }}>
                    <img
                      src={coverUrl}
                      alt={t.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ padding: "18px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt=""
                          style={{ width: "28px", height: "28px", borderRadius: "6px", objectFit: "contain", border: "1px solid var(--jz-border)" }}
                        />
                      )}
                      <span className="admin-match-mode-pill">{t.game_type}</span>
                    </div>
                    <span className={`status-badge is-${t.status === 'ongoing' ? 'live' : t.status === 'upcoming' ? 'pending' : 'completed'}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ margin: "0 0 8px 0" }}>{t.name}</h2>
                  {t.season && <p className="admin-page-subtitle" style={{ margin: "0 0 12px 0" }}>{t.season}</p>}
                  {t.description && <p style={{ fontSize: "14px", color: "var(--jz-text-muted)", marginBottom: "16px", flex: 1 }}>{t.description}</p>}
                  <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ color: "#fca5a5", fontSize: "14px", fontWeight: "bold" }}>View Videos &rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ViewTournaments;
