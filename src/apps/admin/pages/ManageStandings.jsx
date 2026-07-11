import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getBrGroupStandings,
  adminGetTournaments,
  getTournamentModes,
} from "../../../services/api";
import BrStandingsTables from "../../../components/BrStandingsTables";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import Toast from "../components/Toast";

function isBrMode(mode) {
  if (!mode) return false;
  const code = String(mode.code || "").toLowerCase();
  const name = String(mode.name || "").toLowerCase();
  const type = String(mode.competition_type || "").toLowerCase();
  return (
    type.includes("battle") ||
    type.includes("royale") ||
    type === "br" ||
    code === "br" ||
    name.includes("battle royale") ||
    name.includes(" br")
  );
}

function formatUpdatedAt(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function ManageStandings() {
  const [tournaments, setTournaments] = useState([]);
  const [modes, setModes] = useState([]);
  const [tournamentId, setTournamentId] = useState("");
  const [modeId, setModeId] = useState("");
  const [data, setData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  useEffect(() => {
    adminGetTournaments()
      .then((rows) => setTournaments(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message || "Failed to load tournaments"))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    if (loadingList || tournamentId || tournaments.length === 0) return;
    const withBr = tournaments.find((t) => (t.modes || []).some(isBrMode));
    const pick = withBr || tournaments[0];
    if (!pick) return;
    setTournamentId(String(pick.id));
  }, [loadingList, tournamentId, tournaments]);

  useEffect(() => {
    if (!tournamentId) {
      setModes([]);
      setModeId("");
      return;
    }

    const embedded = tournaments.find((t) => String(t.id) === String(tournamentId));
    if (embedded?.modes?.length) {
      setModes(embedded.modes);
      return;
    }

    getTournamentModes(tournamentId)
      .then((rows) => setModes(Array.isArray(rows) ? rows : []))
      .catch(() => setModes([]));
  }, [tournamentId, tournaments]);

  useEffect(() => {
    if (!modes.length) return;
    if (modeId && modes.some((m) => String(m.id) === String(modeId))) return;
    const brMode = modes.find(isBrMode) || modes[0];
    if (brMode) setModeId(String(brMode.id));
  }, [modes, modeId]);

  const loadStandings = useCallback(
    async ({ silent = false } = {}) => {
      if (!tournamentId || !modeId) {
        setData(null);
        return;
      }

      setLoadingStandings(true);
      setError("");
      try {
        const result = await getBrGroupStandings({
          tournament_id: tournamentId,
          tournament_mode_id: modeId,
        });
        setData(result);
        setLastFetchedAt(new Date().toISOString());
        if (!silent) {
          setToast({ message: "Standings refreshed", type: "success" });
        }
      } catch (err) {
        setData(null);
        setError(err.message || "Failed to load standings");
        if (!silent) {
          setToast({ message: err.message || "Failed to refresh standings", type: "error" });
        }
      } finally {
        setLoadingStandings(false);
      }
    },
    [tournamentId, modeId]
  );

  useEffect(() => {
    loadStandings({ silent: true });
  }, [loadStandings]);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => String(t.id) === String(tournamentId)) || data?.tournament,
    [tournaments, tournamentId, data]
  );
  const selectedMode = useMemo(
    () => modes.find((m) => String(m.id) === String(modeId)) || data?.mode,
    [modes, modeId, data]
  );

  const groups = data?.groups || [];
  const hasRows = groups.some((g) => (g.standings || []).length > 0);
  const totalRounds = useMemo(() => {
    let max = 0;
    for (const g of groups) {
      for (const s of g.standings || []) {
        max = Math.max(max, Number(s.rounds_played) || 0);
      }
    }
    return max;
  }, [groups]);

  if (loadingList) return <LoadingState message="Loading standings admin..." />;

  return (
    <div>
      {toast.message ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      ) : null}

      <div className="admin-page-header">
        <div className="admin-page-title-group">
          <h1>BR Standings</h1>
          <p className="admin-page-subtitle">
            View group standings synced from the Controller. Data updates when the
            Controller pushes to production.
          </p>
        </div>
        <div className="standings-admin-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => loadStandings({ silent: false })}
            disabled={loadingStandings || !tournamentId || !modeId}
          >
            {loadingStandings ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="brs-controls">
        <label className="brs-control">
          <span>Tournament</span>
          <select
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setModeId("");
              setData(null);
            }}
          >
            <option value="">Select tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="brs-control">
          <span>Mode</span>
          <select
            value={modeId}
            onChange={(e) => setModeId(e.target.value)}
            disabled={!tournamentId || modes.length === 0}
          >
            <option value="">{modes.length ? "Select mode" : "No modes"}</option>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {isBrMode(m) ? " · BR" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="standings-meta-row">
        <span className="standings-meta-pill standings-meta-pill--source">
          Data synced from Controller
        </span>
        {selectedTournament?.name ? (
          <span className="standings-meta-pill">{selectedTournament.name}</span>
        ) : null}
        {selectedMode?.name ? (
          <span className="standings-meta-pill">{selectedMode.name}</span>
        ) : null}
        <span className="standings-meta-pill">
          Teams: {data?.total_teams ?? 0}
        </span>
        <span className="standings-meta-pill">
          Rounds scored (max): {totalRounds}
        </span>
        <span className="standings-meta-pill">
          DB last updated: {formatUpdatedAt(data?.last_updated)}
        </span>
        <span className="standings-meta-pill">
          Page refreshed: {formatUpdatedAt(lastFetchedAt)}
        </span>
      </div>

      <p style={{ color: "var(--jz-text-muted)", fontSize: 13, marginTop: 0 }}>
        Admin note: Standings are <strong>pushed</strong> from the Controller (
        <code>POST /api/sync/standings/br</code>). Refresh reloads the latest saved
        data on production — it does not pull from the Controller.
      </p>

      {error ? <div className="admin-error-message">{error}</div> : null}

      {loadingStandings && !data ? (
        <LoadingState message="Loading group standings..." />
      ) : !tournamentId || !modeId ? (
        <EmptyState
          icon="📊"
          title="Select tournament & mode"
          description="Choose a tournament and BR mode to inspect standings."
        />
      ) : !hasRows ? (
        <EmptyState
          icon="📊"
          title="No standings data"
          description="Waiting for the Controller to push BR group standings for this mode."
        />
      ) : (
        <>
          <BrStandingsTables groups={groups} detailed variant="admin" />

          <div className="standings-raw-toggle">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? "Hide raw payload" : "Show raw payload"}
            </button>
            {showRaw ? (
              <pre className="standings-raw-box">{JSON.stringify(data, null, 2)}</pre>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export default ManageStandings;
