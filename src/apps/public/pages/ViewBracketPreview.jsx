import { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  AlertCircle,
  Clock,
  Loader2,
  Medal,
  Radio,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react";
import BracketTreePreview from "../../../components/bracket/BracketTreePreview";
import { getBracketPreview, getBrackets } from "../../../services/api";

const POLL_INTERVAL_MS = 58_000;

function formatLastUpdated(date) {
  if (!date) return null;
  try {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return date.toLocaleTimeString();
  }
}

function ViewBracketPreview() {
  const [searchParams] = useSearchParams();
  const urlBracketId = searchParams.get("bracket_id");
  const bracketId =
    urlBracketId && String(urlBracketId).trim() !== ""
      ? String(urlBracketId).trim()
      : null;

  const [preview, setPreview] = useState(null);
  const [bracketName, setBracketName] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [modeName, setModeName] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(bracketId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(!bracketId);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [bracketList, setBracketList] = useState([]);

  const applyMeta = useCallback((res) => {
    setBracketName(res?.bracket_name || res?.bracket?.name || "");
    setTournamentName(res?.tournament_name || "");
    setModeName(res?.tournament_mode_name || "");
  }, []);

  const fetchFromApi = useCallback(
    async (id, { silent = false } = {}) => {
      if (!id) return;
      if (silent) setIsRefreshing(true);
      else {
        setIsLoading(true);
        setError("");
      }

      try {
        const res = await getBracketPreview(id);
        if (res?.is_group_stage) {
          setNotFound(false);
          setError("Group stage brackets do not have a single-elimination tree preview.");
          applyMeta(res);
          if (!silent) setPreview(null);
          return;
        }
        if (res?.bracket) {
          setPreview(res.bracket);
          applyMeta(res);
          setLastUpdated(new Date());
          setNotFound(false);
          setError("");
        } else {
          setNotFound(true);
          setPreview(null);
          setError(res?.message || "Bracket not found");
        }
      } catch (err) {
        console.error("Failed to fetch bracket preview", err);
        const message = err?.message || "Failed to load bracket.";
        if (/not found/i.test(message)) {
          setNotFound(true);
          setPreview(null);
          setError("Bracket not found");
        } else if (!silent) {
          setNotFound(false);
          setError(message);
          setPreview(null);
        }
      } finally {
        if (silent) setIsRefreshing(false);
        else setIsLoading(false);
      }
    },
    [applyMeta]
  );

  useEffect(() => {
    if (!bracketId) {
      setNotFound(true);
      setIsLoading(false);
      setPreview(null);
      // Load list for picker when no id
      getBrackets()
        .then((res) => setBracketList(res?.brackets || res || []))
        .catch(() => setBracketList([]));
      return undefined;
    }
    fetchFromApi(bracketId);
    return undefined;
  }, [bracketId, fetchFromApi]);

  useEffect(() => {
    if (!bracketId) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFromApi(bracketId, { silent: true });
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [bracketId, fetchFromApi]);

  useEffect(() => {
    if (!bracketId) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchFromApi(bracketId, { silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [bracketId, fetchFromApi]);

  const handleManualRefresh = () => {
    if (!bracketId || isLoading || isRefreshing) return;
    fetchFromApi(bracketId, { silent: true });
  };

  const thirdPlaceEnabled = Boolean(preview?.third_place_match);
  const primaryTitle = tournamentName || bracketName || "Tournament Bracket";
  const secondaryTitle =
    tournamentName && bracketName && bracketName !== tournamentName ? bracketName : null;

  if (!bracketId) {
    return (
      <div className="public-bracket-page">
        <header className="public-bracket-header">
          <div className="public-bracket-header-main">
            <div className="public-bracket-badge">
              <Radio size={14} className="public-bracket-live-icon" aria-hidden="true" />
              <span>Live Bracket</span>
            </div>
            <h1 className="public-bracket-tournament-name">Bracket Preview</h1>
            <p className="helper-text" style={{ margin: 0 }}>
              Open a bracket with <code>/bracket-preview?bracket_id=…</code>
            </p>
          </div>
        </header>

        {bracketList.length > 0 ? (
          <div className="public-bracket-list-links">
            {bracketList.map((b) => (
              <Link
                key={b.id}
                className="public-bracket-list-link"
                to={`/bracket-preview?bracket_id=${b.id}`}
              >
                <div>
                  <strong>{b.tournament_name || b.name || `Bracket #${b.id}`}</strong>
                  <div className="helper-text">
                    {b.name && b.tournament_name ? b.name : null}
                    {b.tournament_mode_name ? ` · ${b.tournament_mode_name}` : ""}
                  </div>
                </div>
                <span className="helper-text">ID {b.id}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="public-bracket-not-found">
            <div className="public-bracket-not-found-icon" aria-hidden="true">
              <AlertCircle size={40} strokeWidth={1.75} />
            </div>
            <h1>No brackets available</h1>
            <p>
              Sync a bracket from the Controller, then open{" "}
              <code>/bracket-preview?bracket_id=…</code>
            </p>
          </div>
        )}
      </div>
    );
  }

  if (notFound && !isLoading && !preview) {
    return (
      <div className="public-bracket-page">
        <div className="public-bracket-not-found">
          <div className="public-bracket-not-found-icon" aria-hidden="true">
            <AlertCircle size={40} strokeWidth={1.75} />
          </div>
          <h1>Bracket not found</h1>
          <p>
            This page needs a valid bracket link.
            <br />
            Use <code>/bracket-preview?bracket_id=…</code> to open a live bracket.
          </p>
          <Link to="/bracket-preview" className="public-bracket-refresh-btn" style={{ marginTop: 12 }}>
            Browse brackets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="public-bracket-page">
      <header className="public-bracket-header">
        <div className="public-bracket-header-main">
          <div className="public-bracket-badge">
            <Radio size={14} className="public-bracket-live-icon" aria-hidden="true" />
            <span>Live Bracket</span>
          </div>
          <div className="public-bracket-titles">
            <h1 className="public-bracket-tournament-name">{primaryTitle}</h1>
            {secondaryTitle ? (
              <p className="public-bracket-bracket-name">{secondaryTitle}</p>
            ) : null}
            {modeName ? <span className="public-bracket-mode-chip">{modeName}</span> : null}
          </div>
          <div className="public-bracket-meta">
            {lastUpdated && (
              <span className="public-bracket-meta-item">
                <Clock size={14} aria-hidden="true" />
                Last updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
            {isRefreshing && (
              <span className="public-bracket-meta-item public-bracket-meta-refreshing">
                <Loader2 size={14} className="public-bracket-spin" aria-hidden="true" />
                Updating…
              </span>
            )}
          </div>
        </div>

        <div className="public-bracket-header-actions">
          <button
            type="button"
            className="public-bracket-refresh-btn"
            onClick={handleManualRefresh}
            disabled={isLoading || isRefreshing}
            title="Refresh bracket"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "public-bracket-spin" : undefined}
              aria-hidden="true"
            />
            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {isLoading && !preview ? (
        <section className="public-bracket-empty">
          <Loader2 size={32} className="public-bracket-spin" aria-hidden="true" />
          <strong>Loading bracket…</strong>
          <span>Fetching the latest match data.</span>
        </section>
      ) : error && !preview ? (
        <section className="public-bracket-empty">
          <AlertCircle size={32} aria-hidden="true" />
          <strong>Could not load bracket</strong>
          <span>{error}</span>
          <button
            type="button"
            className="public-bracket-refresh-btn"
            onClick={() => fetchFromApi(bracketId)}
            style={{ marginTop: 12 }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </section>
      ) : preview ? (
        <div className="public-bracket-shell">
          {error ? (
            <div className="public-bracket-banner-warn" role="status">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="public-bracket-stats">
            <div className="public-bracket-stat">
              <Trophy size={16} aria-hidden="true" />
              <div>
                <span className="public-bracket-stat-label">Bracket size</span>
                <strong>{preview.bracket_size ?? "—"}</strong>
              </div>
            </div>
            <div className="public-bracket-stat">
              <Users size={16} aria-hidden="true" />
              <div>
                <span className="public-bracket-stat-label">Participants</span>
                <strong>{preview.participant_count ?? "—"}</strong>
              </div>
            </div>
            {thirdPlaceEnabled ? (
              <div className="public-bracket-stat public-bracket-stat-accent">
                <Medal size={16} aria-hidden="true" />
                <div>
                  <span className="public-bracket-stat-label">3rd Place</span>
                  <strong>Enabled</strong>
                </div>
              </div>
            ) : null}
          </div>

          <section className="bracket-canvas public-bracket-canvas">
            <BracketTreePreview preview={preview} variant="full" />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ViewBracketPreview;
