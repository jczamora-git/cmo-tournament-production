import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { GitFork, ExternalLink } from "lucide-react";
import { getBrackets, getMatchBracket } from "../../../services/api";
import EmptyState from "../../admin/components/EmptyState";
import LoadingState from "../../admin/components/LoadingState";

function ViewBracket() {
  const [brackets, setBrackets] = useState([]);
  const [legacyMatches, setLegacyMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listRes, matchRes] = await Promise.all([
          getBrackets().catch(() => ({ brackets: [] })),
          getMatchBracket().catch(() => []),
        ]);
        if (cancelled) return;
        setBrackets(listRes?.brackets || []);
        setLegacyMatches(Array.isArray(matchRes) ? matchRes : []);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState message="Loading bracket..." />;
  if (error) {
    return (
      <div>
        <h1>Tournament Bracket</h1>
        <div className="admin-error-message">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <header className="public-page-header">
        <h1>Bracket</h1>
        <p>Open the full tree preview for a synced single-elimination bracket.</p>
      </header>

      {brackets.length > 0 ? (
        <div className="public-bracket-list-links">
          {brackets.map((b) => (
            <Link
              key={b.id}
              className="public-bracket-list-link"
              to={`/bracket-preview?bracket_id=${b.id}`}
            >
              <div>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {b.tournament_name || b.name || `Bracket #${b.id}`}
                  <ExternalLink size={14} style={{ opacity: 0.7 }} />
                </strong>
                <div className="helper-text">
                  {[b.name && b.tournament_name ? b.name : null, b.tournament_mode_name]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className="helper-text">Preview</span>
            </Link>
          ))}
        </div>
      ) : legacyMatches.length === 0 ? (
        <EmptyState
          icon={<GitFork size={48} strokeWidth={1.5} color="currentColor" />}
          title="Bracket empty"
          description="Sync a bracket from the Controller, then open the live tree preview."
        />
      ) : (
        <>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            No structured brackets found. Showing match list (legacy view).
          </p>
          <div className="admin-bracket-list">
            {legacyMatches.map((match) => (
              <div key={match.id} className="admin-match-card">
                <div className="admin-match-card-header">
                  <span className="admin-match-card-title">
                    {match.title || "Bracket Match"}
                  </span>
                  <span className={`status-badge status-${match.status}`}>
                    {match.status}
                  </span>
                </div>
                <div className="admin-match-card-teams">
                  <div className="admin-match-team">
                    <div className="admin-match-team-fallback">
                      {(match.blue_team?.shortname || match.blue_team?.name || "B")?.[0]}
                    </div>
                    <span className="admin-match-team-name">
                      {match.blue_team?.shortname ||
                        match.blue_team?.name ||
                        `Team ${match.blue_team_id}`}
                    </span>
                  </div>
                  <div className="admin-match-score-center">
                    {match.blue_score} - {match.red_score}
                  </div>
                  <div className="admin-match-team is-red">
                    <div className="admin-match-team-fallback">
                      {(match.red_team?.shortname || match.red_team?.name || "R")?.[0]}
                    </div>
                    <span className="admin-match-team-name">
                      {match.red_team?.shortname ||
                        match.red_team?.name ||
                        `Team ${match.red_team_id}`}
                    </span>
                  </div>
                </div>
                <div className="admin-match-card-footer">
                  <div className="admin-match-card-meta">
                    <span className="admin-match-mode-pill">{match.mode}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ViewBracket;
