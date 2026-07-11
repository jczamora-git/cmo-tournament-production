import { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarDays, Clock, Loader2, Radio, RefreshCw } from "lucide-react";
import { getUpcomingMatches } from "../../../services/api";
import EmptyState from "../../admin/components/EmptyState";
import LoadingState from "../../admin/components/LoadingState";

function TeamSide({ name, shortname, id, logo, isRed, isWinner }) {
  const label = shortname || name || (id ? `Team ${id}` : "TBD");
  const fullName = name && shortname && name !== shortname ? name : null;
  const fallbackInitial = String(label).charAt(0).toUpperCase();
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={[
        "public-esports-team",
        isRed ? "is-red" : "",
        isWinner ? "is-winner" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {logo && !imgError ? (
        <img
          src={logo}
          alt=""
          className="public-esports-logo"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="public-esports-logo-fallback" aria-hidden="true">
          {fallbackInitial}
        </div>
      )}
      <div className="public-esports-team-meta">
        <span className="public-esports-team-name" title={name || label}>
          {label}
        </span>
        {fullName ? <span className="public-esports-team-sub">{fullName}</span> : null}
        {isWinner ? <span className="public-esports-team-sub">Winner</span> : null}
      </div>
    </div>
  );
}

function normalizeStatus(status) {
  const s = String(status || "queued").toLowerCase();
  if (["live", "active", "ongoing"].includes(s)) return "live";
  if (["finished", "completed", "done"].includes(s)) return "finished";
  if (["setup", "drafting"].includes(s)) return s;
  return "queued";
}

function statusBadgeClass(status) {
  if (status === "live") return "public-esports-badge public-esports-badge-live";
  if (status === "finished") return "public-esports-badge public-esports-badge-finished";
  return "public-esports-badge public-esports-badge-queued";
}

function statusLabel(status) {
  if (status === "live") return "Live";
  if (status === "finished") return "Finished";
  if (status === "setup") return "Setup";
  return "Queued";
}

function formatUpdated(date) {
  if (!date) return null;
  try {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return date.toLocaleString();
  }
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

  if (loading) return <LoadingState message="Loading schedule…" />;
  if (error) {
    return (
      <div className="public-esports-page">
        <header className="public-esports-hero">
          <div className="public-esports-kicker">
            <CalendarDays size={12} aria-hidden="true" />
            Schedule
          </div>
          <h1>Tournament Schedule</h1>
        </header>
        <div className="admin-error-message">{error}</div>
        <button type="button" className="public-bracket-refresh-btn" onClick={() => load()}>
          <RefreshCw size={16} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="public-esports-page">
      <header className="public-esports-hero">
        <div className="public-esports-kicker">
          <CalendarDays size={12} aria-hidden="true" />
          Live Schedule
        </div>
        <h1>Tournament Schedule</h1>
        <p>
          Upcoming and live matches synced from the Controller. Auto-refreshes while this page
          is open.
        </p>
      </header>

      <div className="public-esports-toolbar">
        <div className="public-esports-meta">
          {lastUpdated ? (
            <span className="public-esports-meta-item">
              <Clock size={14} aria-hidden="true" />
              Last updated {formatUpdated(lastUpdated)}
            </span>
          ) : null}
          {refreshing ? (
            <span className="public-esports-meta-item">
              <Loader2 size={14} className="public-bracket-spin" aria-hidden="true" />
              Updating…
            </span>
          ) : null}
          <span className="public-esports-meta-item">
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </span>
        </div>
        <button
          type="button"
          className="public-bracket-refresh-btn"
          onClick={() => load({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "public-bracket-spin" : undefined}
            aria-hidden="true"
          />
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
        Object.entries(groupedMatches).map(([stage, stageMatches]) => (
          <section key={stage} className="public-esports-stage">
            <h2 className="public-esports-stage-title">{stage}</h2>
            <div className="public-esports-list">
              {stageMatches.map((match) => {
                const seriesFormat = match.series_format || match.mode;
                const status = normalizeStatus(match.status);
                const winnerId = match.series_winner_team_id
                  ? Number(match.series_winner_team_id)
                  : null;
                const blueWon = winnerId && Number(match.blue_team_id) === winnerId;
                const redWon = winnerId && Number(match.red_team_id) === winnerId;

                return (
                  <article
                    key={match.id}
                    className={[
                      "public-esports-card",
                      status === "live" ? "is-live" : "",
                      status === "queued" ? "is-queued" : "",
                      status === "finished" ? "is-finished" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="public-esports-card-accent" aria-hidden="true" />
                    <div className="public-esports-card-inner">
                      <div className="public-esports-card-top">
                        <div className="public-esports-card-identity">
                          <span className="public-esports-round">{stage}</span>
                          <span className="public-esports-match-no">
                            Match #{match.match_no ?? match.id}
                          </span>
                        </div>
                        <div className="public-esports-card-badges">
                          <span className={statusBadgeClass(status)}>
                            {status === "live" ? (
                              <Radio size={11} aria-hidden="true" />
                            ) : null}
                            {statusLabel(status)}
                          </span>
                          {seriesFormat ? (
                            <span className="public-esports-badge public-esports-badge-mode">
                              {seriesFormat}
                            </span>
                          ) : null}
                          {match.queue_order != null ? (
                            <span className="public-esports-badge public-esports-badge-queue">
                              Queue {match.queue_order}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="public-esports-teams">
                        <TeamSide
                          name={match.blue_team_name || match.blue_team?.name}
                          shortname={
                            match.blue_team_shortname || match.blue_team?.shortname
                          }
                          id={match.blue_team_id}
                          logo={match.blue_team_logo || match.blue_team?.logo}
                          isRed={false}
                          isWinner={blueWon}
                        />

                        <div className="public-esports-scoreboard">
                          <div className="public-esports-score-row">
                            <span
                              className={[
                                "public-esports-score",
                                blueWon ? "is-winner" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {match.blue_score ?? 0}
                            </span>
                            <span className="public-esports-vs">VS</span>
                            <span
                              className={[
                                "public-esports-score",
                                redWon ? "is-winner" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {match.red_score ?? 0}
                            </span>
                          </div>
                        </div>

                        <TeamSide
                          name={match.red_team_name || match.red_team?.name}
                          shortname={
                            match.red_team_shortname || match.red_team?.shortname
                          }
                          id={match.red_team_id}
                          logo={match.red_team_logo || match.red_team?.logo}
                          isRed={true}
                          isWinner={redWon}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default ViewSchedule;
