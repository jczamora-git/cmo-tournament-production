import { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { getUpcomingMatches } from "../../../services/api";
import EmptyState from "../../admin/components/EmptyState";
import LoadingState from "../../admin/components/LoadingState";

function TeamDisplay({ name, shortname, id, logo, isRed, isWinner }) {
  const label = shortname || name || (id ? `Team ${id}` : "TBD");
  const fallbackInitial = label.charAt(0).toUpperCase();
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`admin-match-team ${isRed ? "is-red" : ""} ${isWinner ? "is-winner" : ""}`}
    >
      {logo && !imgError ? (
        <img
          src={logo}
          alt={`${label} logo`}
          className="admin-match-team-logo"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="admin-match-team-fallback">{fallbackInitial}</div>
      )}
      <span className="admin-match-team-name">{label}</span>
    </div>
  );
}

function statusLabel(status) {
  const s = String(status || "queued").toLowerCase();
  if (s === "live" || s === "active") return s.toUpperCase();
  return s.toUpperCase();
}

function ViewSchedule() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getUpcomingMatches();
      setMatches(Array.isArray(data) ? data : []);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load({ silent: true });
    }, 45000);
    return () => window.clearInterval(t);
  }, [load]);

  const groupedMatches = useMemo(() => {
    return matches.reduce((acc, match) => {
      const stage = match.title || "Uncategorized";
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(match);
      return acc;
    }, {});
  }, [matches]);

  if (loading) return <LoadingState message="Loading matches..." />;
  if (error) {
    return (
      <div>
        <h1>Schedule</h1>
        <div className="admin-error-message">{error}</div>
        <button type="button" className="public-bracket-refresh-btn" onClick={() => load()}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="public-page-header">
        <h1>Schedule</h1>
        <p>Upcoming and live matches from the Controller sync.</p>
      </header>

      <div className="public-matches-toolbar">
        <div className="helper-text" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : null}
          {refreshing ? (
            <>
              <Loader2 size={14} className="public-bracket-spin" /> Updating…
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="public-bracket-refresh-btn"
          onClick={() => load({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "public-bracket-spin" : undefined} />
          Refresh
        </button>
      </div>

      {matches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={48} strokeWidth={1.5} color="currentColor" />}
          title="No upcoming matches"
          description="Check back later for scheduled matches."
        />
      ) : (
        <div className="admin-match-list">
          {Object.entries(groupedMatches).map(([stage, stageMatches]) => (
            <div key={stage} style={{ marginBottom: "2rem" }}>
              <h2 className="public-stage-heading">{stage}</h2>
              <div className="admin-match-list">
                {stageMatches.map((match) => {
                  const seriesFormat = match.series_format || match.mode;
                  const status = String(match.status || "queued").toLowerCase();
                  const winnerId = match.series_winner_team_id
                    ? Number(match.series_winner_team_id)
                    : null;

                  return (
                    <div key={match.id} className="admin-match-card">
                      <div className="admin-match-card-header">
                        <span className="admin-match-card-title">
                          Match #{match.match_no ?? match.id}
                          {match.queue_order != null ? (
                            <span className="helper-text" style={{ marginLeft: 8, fontWeight: 500 }}>
                              Queue {match.queue_order}
                            </span>
                          ) : null}
                        </span>
                        <span className={`status-badge status-${status}`}>
                          {statusLabel(status)}
                        </span>
                      </div>

                      <div className="admin-match-card-teams">
                        <TeamDisplay
                          name={match.blue_team_name || match.blue_team?.name}
                          shortname={match.blue_team_shortname || match.blue_team?.shortname}
                          id={match.blue_team_id}
                          logo={match.blue_team_logo || match.blue_team?.logo}
                          isRed={false}
                          isWinner={winnerId && Number(match.blue_team_id) === winnerId}
                        />

                        <div
                          className="admin-match-score-center"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            justifyContent: "center",
                          }}
                        >
                          <span>{match.blue_score ?? 0}</span>
                          <span style={{ fontSize: "12px", opacity: 0.7 }}>VS</span>
                          <span>{match.red_score ?? 0}</span>
                        </div>

                        <TeamDisplay
                          name={match.red_team_name || match.red_team?.name}
                          shortname={match.red_team_shortname || match.red_team?.shortname}
                          id={match.red_team_id}
                          logo={match.red_team_logo || match.red_team?.logo}
                          isRed={true}
                          isWinner={winnerId && Number(match.red_team_id) === winnerId}
                        />
                      </div>

                      <div className="admin-match-card-footer">
                        <div className="admin-match-card-meta">
                          {seriesFormat ? (
                            <span className="admin-match-mode-pill">{seriesFormat}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ViewSchedule;
