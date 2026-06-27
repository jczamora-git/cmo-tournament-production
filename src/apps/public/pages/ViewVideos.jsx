import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getVideos, getTournaments } from "../../../services/api";
import LoadingState from "../../admin/components/LoadingState";
import EmptyState from "../../admin/components/EmptyState";

function ViewVideos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [videos, setVideos] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedTournament = searchParams.get("tournament") || "";

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getVideos(),
      getTournaments()
    ])
      .then(([vRes, tRes]) => {
        setVideos(vRes);
        setTournaments(tRes);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (e) => {
    if (e.target.value) {
      setSearchParams({ tournament: e.target.value });
    } else {
      setSearchParams({});
    }
  };

  const filteredVideos = selectedTournament 
    ? videos.filter(v => v.tournament_id?.toString() === selectedTournament)
    : videos;

  if (loading) return <LoadingState message="Loading video archive..." />;
  if (error) return <EmptyState icon="⚠️" title="Error loading videos" description={error} />;

  return (
    <div>
      <header className="public-page-header" style={{ flexWrap: "wrap", gap: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Video Archives</h1>
          <p>Watch replays, highlights, and live broadcasts.</p>
        </div>
        <div style={{ minWidth: "250px" }}>
          <select value={selectedTournament} onChange={handleFilterChange} style={{ width: "100%", padding: "10px", borderRadius: "8px", backgroundColor: "var(--jz-bg-card)", border: "1px solid var(--jz-border)", color: "var(--jz-text-main)" }}>
            <option value="">All Tournaments</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </header>

      {filteredVideos.length === 0 ? (
        <EmptyState icon="🎬" title="No videos available" description="There are no published videos for this selection." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
          {filteredVideos.map((v) => (
            <div key={v.id} className="admin-card" style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", backgroundColor: "#000", marginBottom: "16px" }}>
                <iframe 
                  src={v.embed_url || v.source_url} 
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} 
                  allowFullScreen 
                  title={v.title}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <span className="admin-match-mode-pill">{v.video_type.replace('_', ' ').toUpperCase()}</span>
                {v.is_featured && <span style={{ color: "var(--jz-accent-primary)", fontSize: "12px", fontWeight: "bold" }}>★ Featured</span>}
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "18px" }}>{v.title}</h3>
              {v.tournament_name && <p className="admin-page-subtitle" style={{ margin: "0 0 12px 0", color: "var(--jz-text-muted)" }}>{v.tournament_name} {v.season ? `- ${v.season}` : ''}</p>}
              {v.description && <p style={{ fontSize: "14px", color: "var(--jz-text-main)", marginBottom: "0", flex: 1 }}>{v.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewVideos;
