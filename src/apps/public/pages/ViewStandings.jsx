import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Trophy } from "lucide-react";
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
    /\bbr\b/.test(name)
  );
}

function formatUpdatedAt(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
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
  // Public page: track load failure without exposing technical API messages
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getTournaments()
      .then((rows) => setTournaments(Array.isArray(rows) ? rows : []))
      .catch(() => setTournaments([]))
      .finally(() => setLoadingList(false));
  }, []);

  // Default tournament/mode when nothing selected
  useEffect(() => {
    if (loadingList || tournamentId || tournaments.length === 0) return;

    const withBr = tournaments.find((t) => (t.modes || []).some(isBrMode));
    const pick = withBr || tournaments[0];
    if (!pick) return;

    setTournamentId(String(pick.id));
    const brMode = (pick.modes || []).find(isBrMode) || (pick.modes || [])[0];
    if (brMode) setModeId(String(brMode.id));
  }, [loadingList, tournamentId, tournaments]);

  // Load modes for selected tournament
  useEffect(() => {
    if (!tournamentId) {
      setModes([]);
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

  // Correct invalid mode IDs (e.g. mode from another tournament in the URL)
  useEffect(() => {
    if (!modes.length) return;
    if (modeId && modes.some((m) => String(m.id) === String(modeId))) return;
    const brMode = modes.find(isBrMode) || modes[0];
    if (brMode) setModeId(String(brMode.id));
    else setModeId("");
  }, [modes, modeId]);

  const modeIsValid = useMemo(() => {
    if (!tournamentId || !modeId) return false;
    // Until modes are known, avoid firing a request that may 404 with a bad URL pair
    if (!modes.length) return false;
    return modes.some((m) => String(m.id) === String(modeId));
  }, [tournamentId, modeId, modes]);

  const loadStandings = useCallback(async () => {
    if (!modeIsValid) {
      setData(null);
      setLoadFailed(false);
      return;
    }

    setLoadingStandings(true);
    setLoadFailed(false);
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
    } catch {
      // Hide technical API errors from public visitors
      setData(null);
      setLoadFailed(true);
    } finally {
      setLoadingStandings(false);
    }
  }, [modeIsValid, tournamentId, modeId, setSearchParams]);

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
  const updatedLabel = formatUpdatedAt(data?.last_updated);

  if (loadingList) return <LoadingState message="Loading standings..." />;

  return (
    <div className="brs-page">
      <header className="brs-page-header">
        <div className="brs-page-header-main">
          <p className="brs-page-eyebrow">Live Group Standings</p>
          <h1>BR Standings</h1>
          <p className="brs-page-subtitle">
            {selectedTournament?.name
              ? `${selectedTournament.name}${selectedMode?.name ? ` · ${selectedMode.name}` : ""}`
              : "Battle Royale group points after each controller sync."}
          </p>
        </div>

        {updatedLabel ? (
          <div className="brs-updated-chip" title="Synced from tournament controller">
            <Clock3 size={15} strokeWidth={2} aria-hidden />
            <div className="brs-updated-chip-text">
              <span className="brs-updated-chip-label">Data from Controller</span>
              <span>Updated {updatedLabel}</span>
            </div>
          </div>
        ) : null}
      </header>

      <div className="brs-controls">
        <label className="brs-control">
          <span>Tournament</span>
          <select
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setModeId("");
              setData(null);
              setLoadFailed(false);
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
            onChange={(e) => {
              setModeId(e.target.value);
              setLoadFailed(false);
            }}
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

      {loadingStandings || (tournamentId && modeId && !modes.length) ? (
        <LoadingState message="Loading group standings..." />
      ) : !tournamentId || !modeId ? (
        <EmptyState
          icon={<Trophy size={48} strokeWidth={1.5} color="currentColor" />}
          title="Select a tournament"
          description="Choose a tournament and BR mode to view group standings."
        />
      ) : !hasRows || loadFailed ? (
        <EmptyState
          icon={<Trophy size={48} strokeWidth={1.5} color="currentColor" />}
          title="No standings data available yet"
          description="Standings will appear here after the controller pushes BR group results."
        />
      ) : (
        <BrStandingsTables groups={groups} detailed={false} variant="public" />
      )}
    </div>
  );
}

export default ViewStandings;
