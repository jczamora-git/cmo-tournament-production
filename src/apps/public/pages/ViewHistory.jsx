import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, RefreshCw, ScrollText, Search } from "lucide-react";
import { getMatchHistory } from "../../../services/api";
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

function ViewHistory() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (q = "", { silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMatchHistory(q ? { q } : undefined);
      setMatches(Array.isArray(data) ? data : []);
      setError("");
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

  const filteredLocal = useMemo(() => {
    // Server already filters when q is set; keep client fallback
    return matches;
  }, [matches]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  if (loading) return <LoadingState message="Loading history..." />;
  if (error) {
    return (
      <div>
        <h1>Match History</h1>
        <div className="admin-error-message">{error}</div>
        <button type="button" className="public-bracket-refresh-btn" onClick={() => load(query)}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="public-page-header">
        <h1>Match History</h1>
        <p>Finished matches with final scores and winners.</p>
      </header>

      <div className="public-matches-toolbar">
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, flex: "1 1 260px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.55,
              }}
            />
            <input
              className="public-matches-search"
              style={{ paddingLeft: 36, width: "100%", maxWidth: "none" }}
              type="search"
              placeholder="Search team, title, mode…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="public-bracket-refresh-btn">
            Search
          </button>
        </form>
        <button
          type="button"
          className="public-bracket-refresh-btn"
          onClick={() => load(query, { silent: true })}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 size={16} className="public-bracket-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh
        </button>
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
        <div className="admin-match-list">
          {filteredLocal.map((match) => {
            const winnerId = match.series_winner_team_id
              ? Number(match.series_winner_team_id)
              : null;
            const blueWon = winnerId && Number(match.blue_team_id) === winnerId;
            const redWon = winnerId && Number(match.red_team_id) === winnerId;
            const winnerName = blueWon
              ? match.blue_team?.shortname ||
                match.blue_team?.name ||
                match.blue_team_name
              : redWon
                ? match.red_team?.shortname ||
                  match.red_team?.name ||
                  match.red_team_name
                : null;
            const seriesFormat = match.series_format || match.mode;

            return (
              <div key={match.id} className="admin-match-card">
                <div className="admin-match-card-header">
                  <span className="admin-match-card-title">
                    {match.title || `Match #${match.match_no ?? match.id}`}
                  </span>
                  <span className="status-badge status-finished">Finished</span>
                </div>

                <div className="admin-match-card-teams">
                  <TeamDisplay
                    name={match.blue_team_name || match.blue_team?.name}
                    shortname={match.blue_team_shortname || match.blue_team?.shortname}
                    id={match.blue_team_id}
                    logo={match.blue_team_logo || match.blue_team?.logo}
                    isRed={false}
                    isWinner={blueWon}
                  />

                  <div className="admin-match-score-center">
                    {match.blue_score ?? 0} - {match.red_score ?? 0}
                  </div>

                  <TeamDisplay
                    name={match.red_team_name || match.red_team?.name}
                    shortname={match.red_team_shortname || match.red_team?.shortname}
                    id={match.red_team_id}
                    logo={match.red_team_logo || match.red_team?.logo}
                    isRed={true}
                    isWinner={redWon}
                  />
                </div>

                <div className="admin-match-card-footer">
                  <div className="admin-match-card-meta">
                    {seriesFormat ? (
                      <span className="admin-match-mode-pill">{seriesFormat}</span>
                    ) : null}
                    {winnerName ? (
                      <span className="helper-text" style={{ marginLeft: 8 }}>
                        Winner: <span className="public-match-winner">{winnerName}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ViewHistory;
