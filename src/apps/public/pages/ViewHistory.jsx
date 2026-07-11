import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, RefreshCw, ScrollText, Search, Trophy } from "lucide-react";
import { getMatchHistory } from "../../../services/api";
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

function formatFinishedAt(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function roundLabel(match) {
  const title = match.title || match.round_name || null;
  const matchNo = match.match_no != null ? match.match_no : match.id;
  if (title) return `${title} · Match #${matchNo}`;
  return `Match #${matchNo}`;
}

function ViewHistory() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (q = "", { silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMatchHistory(q ? { q } : undefined);
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
    load(query);
  }, [load, query]);

  const filteredLocal = useMemo(() => matches, [matches]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setQuery("");
  };

  if (loading) return <LoadingState message="Loading history…" />;
  if (error) {
    return (
      <div className="public-esports-page">
        <header className="public-esports-hero">
          <div className="public-esports-kicker">
            <ScrollText size={12} aria-hidden="true" />
            History
          </div>
          <h1>Match History</h1>
        </header>
        <div className="admin-error-message">{error}</div>
        <button
          type="button"
          className="public-bracket-refresh-btn"
          onClick={() => load(query)}
        >
          <RefreshCw size={16} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="public-esports-page">
      <header className="public-esports-hero">
        <div className="public-esports-kicker">
          <Trophy size={12} aria-hidden="true" />
          Results Archive
        </div>
        <h1>Match History</h1>
        <p>
          Finished matches with final scores, winners, and series format. Search by team, stage,
          or mode.
        </p>
      </header>

      <div className="public-esports-toolbar">
        <form className="public-esports-search-form" onSubmit={handleSearch}>
          <div className="public-esports-search-wrap">
            <Search size={15} aria-hidden="true" />
            <input
              className="public-esports-search"
              type="search"
              placeholder="Search team, round, mode…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search match history"
            />
          </div>
          <button type="submit" className="public-bracket-refresh-btn">
            Search
          </button>
          {query ? (
            <button
              type="button"
              className="public-bracket-refresh-btn"
              onClick={handleClearSearch}
            >
              Clear
            </button>
          ) : null}
        </form>

        <div className="public-esports-meta">
          {lastUpdated ? (
            <span className="public-esports-meta-item">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          ) : null}
          <span className="public-esports-meta-item">
            {filteredLocal.length} result{filteredLocal.length === 1 ? "" : "s"}
            {query ? ` for “${query}”` : ""}
          </span>
          <button
            type="button"
            className="public-bracket-refresh-btn"
            onClick={() => load(query, { silent: true })}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 size={16} className="public-bracket-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {filteredLocal.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={48} strokeWidth={1.5} color="currentColor" />}
          title={query ? "No matches found" : "No match history"}
          description={
            query
              ? "Try a different search term."
              : "Completed matches will appear here after sync."
          }
        />
      ) : (
        <div className="public-esports-list">
          {filteredLocal.map((match) => {
            const winnerId = match.series_winner_team_id
              ? Number(match.series_winner_team_id)
              : null;
            const blueWon = winnerId && Number(match.blue_team_id) === winnerId;
            const redWon = winnerId && Number(match.red_team_id) === winnerId;
            const winnerName = blueWon
              ? match.blue_team?.shortname ||
                match.blue_team?.name ||
                match.blue_team_name ||
                match.blue_team_shortname
              : redWon
                ? match.red_team?.shortname ||
                  match.red_team?.name ||
                  match.red_team_name ||
                  match.red_team_shortname
                : null;
            const seriesFormat = match.series_format || match.mode;
            const finishedAt = formatFinishedAt(
              match.series_completed_at || match.finished_at || match.updated_at
            );
            const stage = match.title || match.round_name || null;

            return (
              <article key={match.id} className="public-esports-card is-finished">
                <div className="public-esports-card-accent" aria-hidden="true" />
                <div className="public-esports-card-inner">
                  <div className="public-esports-card-top">
                    <div className="public-esports-card-identity">
                      {stage ? (
                        <span className="public-esports-round">{stage}</span>
                      ) : null}
                      <span className="public-esports-match-no">{roundLabel(match)}</span>
                    </div>
                    <div className="public-esports-card-badges">
                      <span className="public-esports-badge public-esports-badge-finished">
                        Finished
                      </span>
                      {seriesFormat ? (
                        <span className="public-esports-badge public-esports-badge-mode">
                          {seriesFormat}
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
                        <span className="public-esports-vs">—</span>
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

                  <div className="public-esports-card-footer">
                    {winnerName ? (
                      <div className="public-esports-winner">
                        <Trophy size={14} aria-hidden="true" />
                        Winner: <strong>{winnerName}</strong>
                      </div>
                    ) : (
                      <div className="public-esports-winner">Series complete</div>
                    )}
                    <div className="public-esports-footer-meta">
                      {finishedAt ? <span>{finishedAt}</span> : null}
                      {match.match_no != null ? (
                        <span>#{match.match_no}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ViewHistory;
