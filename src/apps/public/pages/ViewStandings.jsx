import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Trophy } from "lucide-react";
import { getBrGroupStandings, getTournaments, getTournamentModes } from "../../../services/api";
import BrStandingsTables from "../../../components/BrStandingsTables";
import EmptyState from "../../admin/components/EmptyState";
import LoadingState from "../../admin/components/LoadingState";

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
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function ViewStandings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [modes, setModes] = useState([]);
  const [tournamentId, setTournamentId] = useState(searchParams.get("tournament_id") || "");
  const [modeId, setModeId] = useState(searchParams.get("tournament_mode_id") || "");
  const [data, setData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTournaments()
      .then((rows) => setTournaments(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message || "Failed to load tournaments"))
      .finally(() => setLoadingList(false));
  }, []);

  // Prefer tournaments that have BR modes when nothing selected
  useEffect(() => {
    if (loadingList || tournamentId || tournaments.length === 0) return;

    const withBr = tournaments.find((t) => (t.modes || []).some(isBrMode));
    const pick = withBr || tournaments[0];
    if (!pick) return;

    setTournamentId(String(pick.id));
    const brMode = (pick.modes || []).find(isBrMode) || (pick.modes || [])[0];
    if (brMode) setModeId(String(brMode.id));
  }, [loadingList, tournamentId, tournaments]);

  useEffect(() => {
    if (!tournamentId) {
      setModes([]);
      return;
    }

    // Prefer modes already embedded on tournament list
    const embedded = tournaments.find((t) => String(t.id) === String(tournamentId));
    if (embedded?.modes?.length) {
      setModes(embedded.modes);
      return;
    }

    getTournamentModes(tournamentId)
      .then((rows) => setModes(Array.isArray(rows) ? rows : []))
      .catch(() => setModes([]));
  }, [tournamentId, tournaments]);

  // Keep mode valid when tournament/modes change
  useEffect(() => {
    if (!modes.length) return;
    if (modeId && modes.some((m) => String(m.id) === String(modeId))) return;
    const brMode = modes.find(isBrMode) || modes[0];
    if (brMode) setModeId(String(brMode.id));
  }, [modes, modeId]);

  const loadStandings = useCallback(async () => {
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
      setSearchParams(
        {
          tournament_id: String(tournamentId),
          tournament_mode_id: String(modeId),
        },
        { replace: true }
      );
    } catch (err) {
      setData(null);
      setError(err.message || "Failed to load standings");
    } finally {
      setLoadingStandings(false);
    }
  }, [tournamentId, modeId, setSearchParams]);

  useEffect(() => {
    loadStandings();
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

  if (loadingList) return <LoadingState message="Loading standings..." />;

  return (
    <div>
      <header className="public-page-header">
        <h1>Standings</h1>
        <p>Battle Royale group standings pushed from the tournament controller.</p>
      </header>

      <div className="standings-filter-bar">
        <label>
          Tournament
          <select
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setModeId("");
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

        <label>
          Mode
          <select
            value={modeId}
            onChange={(e) => setModeId(e.target.value)}
            disabled={!tournamentId || modes.length === 0}
          >
            <option value="">{modes.length ? "Select mode" : "No modes"}</option>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {isBrMode(m) ? " (BR)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(selectedTournament || selectedMode) && (
        <div className="standings-meta-row">
          {selectedTournament?.name ? (
            <span className="standings-meta-pill">{selectedTournament.name}</span>
          ) : null}
          {selectedMode?.name ? (
            <span className="standings-meta-pill">{selectedMode.name}</span>
          ) : null}
          {data?.last_updated ? (
            <span className="standings-meta-pill">
              Updated {formatUpdatedAt(data.last_updated)}
            </span>
          ) : null}
        </div>
      )}

      {error ? <div className="admin-error-message">{error}</div> : null}

      {loadingStandings ? (
        <LoadingState message="Loading group standings..." />
      ) : !tournamentId || !modeId ? (
        <EmptyState
          icon={<Trophy size={48} strokeWidth={1.5} color="currentColor" />}
          title="Select a tournament"
          description="Choose a tournament and mode to view BR group standings."
        />
      ) : !hasRows ? (
        <EmptyState
          icon={<Trophy size={48} strokeWidth={1.5} color="currentColor" />}
          title="No standings yet"
          description="Standings will appear here after the controller pushes BR group results."
        />
      ) : (
        <BrStandingsTables groups={groups} detailed={false} />
      )}
    </div>
  );
}

export default ViewStandings;
