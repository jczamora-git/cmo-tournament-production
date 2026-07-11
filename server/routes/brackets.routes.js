/**
 * Public read-only bracket endpoints for production site.
 * Builds a tree-shaped preview compatible with Controller BracketTreePreview.
 */
const express = require("express");
const db = require("../db");

const router = express.Router();

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isFinishedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "finished" || s === "done" || s === "completed";
}

/**
 * Load one bracket by production id OR public_bracket_id (Controller local id).
 */
async function loadBracket(connection, idParam) {
  const id = toInt(idParam);
  if (!id) return null;

  // Prefer exact production PK, then public_bracket_id mapping
  const [byId] = await connection.query(
    `SELECT * FROM brackets WHERE id = ? LIMIT 1`,
    [id]
  );
  if (byId[0]) return byId[0];

  try {
    const [byPublic] = await connection.query(
      `SELECT * FROM brackets WHERE public_bracket_id = ? LIMIT 1`,
      [id]
    );
    if (byPublic[0]) return byPublic[0];
  } catch (_) {
    /* column may not exist */
  }
  return null;
}

async function loadTournamentMeta(connection, tournamentId, modeId) {
  let tournamentName = null;
  let modeName = null;
  try {
    if (tournamentId) {
      const [t] = await connection.query(
        `SELECT name FROM tournaments WHERE id = ? LIMIT 1`,
        [tournamentId]
      );
      tournamentName = t[0]?.name || null;
    }
  } catch (_) {
    /* ignore */
  }
  try {
    if (modeId) {
      const [m] = await connection.query(
        `SELECT name FROM tournament_modes WHERE id = ? LIMIT 1`,
        [modeId]
      );
      modeName = m[0]?.name || null;
    }
  } catch (_) {
    /* ignore */
  }
  return { tournamentName, modeName };
}

/**
 * Build feeder maps: nodeId -> list of source node keys that advance into it.
 */
function buildFeederMaps(nodes) {
  const byId = new Map(nodes.map((n) => [Number(n.id), n]));
  const feeders = new Map(); // destinationId -> [{key, slot}]

  for (const n of nodes) {
    const nextId = toInt(n.next_node_id);
    if (!nextId) continue;
    if (!feeders.has(nextId)) feeders.set(nextId, []);
    feeders.get(nextId).push({
      key: n.node_key || `N${n.id}`,
      position: toInt(n.position) || 0,
      sourceId: Number(n.id),
    });
  }

  // Sort feeders by position for slot a/b
  for (const [k, list] of feeders.entries()) {
    list.sort((a, b) => a.position - b.position);
    feeders.set(k, list);
  }

  return { byId, feeders };
}

function teamDisplayName(match, side) {
  if (!match) return null;
  if (side === "blue") {
    return (
      match.blue_team_name ||
      match.blue_team_shortname ||
      (match.blue_team_id ? `Team #${match.blue_team_id}` : null)
    );
  }
  return (
    match.red_team_name ||
    match.red_team_shortname ||
    (match.red_team_id ? `Team #${match.red_team_id}` : null)
  );
}

function buildMatchFromNode(node, match, feeders) {
  const nodeId = Number(node.id);
  const nodeKey = node.node_key || `N${nodeId}`;
  const feederList = feeders.get(nodeId) || [];
  const sourceA = feederList[0]?.key || null;
  const sourceB = feederList[1]?.key || null;

  const teamAId = match?.blue_team_id != null ? Number(match.blue_team_id) : null;
  const teamBId = match?.red_team_id != null ? Number(match.red_team_id) : null;
  let teamAName = teamDisplayName(match, "blue");
  let teamBName = teamDisplayName(match, "red");

  // Waiting labels when match slot empty but feeder known
  if (!teamAId && !teamAName) {
    teamAName = sourceA ? `Waiting: Winner of ${sourceA}` : "TBD";
  }
  if (!teamBId && !teamBName) {
    teamBName = sourceB ? `Waiting: Winner of ${sourceB}` : "TBD";
  }

  const finished =
    Boolean(match?.series_completed) ||
    isFinishedStatus(match?.status) ||
    Boolean(match?.series_winner_team_id);

  const displayNo =
    match?.match_no != null
      ? Number(match.match_no)
      : node.position != null
        ? Number(node.position)
        : nodeId;

  return {
    bracket_match_ref: nodeKey,
    bracket_match_no: displayNo,
    display_match_no: displayNo,
    team_a_id: teamAId,
    team_b_id: teamBId,
    team_a_name: teamAName,
    team_b_name: teamBName,
    seed_a: null,
    seed_b: null,
    team_a_source_ref: sourceA,
    team_b_source_ref: sourceB,
    source_a_ref: sourceA,
    source_b_ref: sourceB,
    blue_score: match?.blue_score ?? null,
    red_score: match?.red_score ?? null,
    series_winner_team_id: match?.series_winner_team_id ?? null,
    is_finished: finished,
    match_status: match?.status || null,
    match_id: match?.id || node.match_id || null,
    mode: match?.series_format || match?.mode || null,
    should_display: true,
    label: node.label || null,
  };
}

/**
 * GET /api/brackets/:id/preview
 * id = production brackets.id OR public_bracket_id
 */
router.get("/:id/preview", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const bracket = await loadBracket(connection, req.params.id);
    if (!bracket) {
      return res.status(404).json({
        success: false,
        message: "Bracket not found",
      });
    }

    const bracketId = Number(bracket.id);
    const { tournamentName, modeName } = await loadTournamentMeta(
      connection,
      bracket.tournament_id,
      bracket.tournament_mode_id
    );

    // Rounds
    let roundsRows = [];
    try {
      try {
        const [rows] = await connection.query(
          `SELECT * FROM bracket_rounds WHERE bracket_id = ? ORDER BY round_number ASC, id ASC`,
          [bracketId]
        );
        roundsRows = rows;
      } catch (_) {
        try {
          const [rows] = await connection.query(
            `SELECT * FROM bracket_rounds WHERE bracket_id = ? ORDER BY round_no ASC, id ASC`,
            [bracketId]
          );
          roundsRows = rows;
        } catch (__) {
          const [rows] = await connection.query(
            `SELECT * FROM bracket_rounds WHERE bracket_id = ? ORDER BY id ASC`,
            [bracketId]
          );
          roundsRows = rows;
        }
      }
    } catch (_) {
      roundsRows = [];
    }

    // Nodes + optional match join
    let nodes = [];
    try {
      const [rows] = await connection.query(
        `SELECT bn.*,
                m.id AS match_db_id,
                m.match_no,
                m.title AS match_title,
                m.mode AS match_mode,
                m.series_format,
                m.status AS match_status,
                m.blue_team_id,
                m.red_team_id,
                m.blue_score,
                m.red_score,
                m.series_winner_team_id,
                m.series_completed,
                bt.name AS blue_team_name,
                bt.shortname AS blue_team_shortname,
                rt.name AS red_team_name,
                rt.shortname AS red_team_shortname
         FROM bracket_nodes bn
         LEFT JOIN matches m ON m.id = bn.match_id
         LEFT JOIN teams bt ON bt.id = m.blue_team_id
         LEFT JOIN teams rt ON rt.id = m.red_team_id
         WHERE bn.bracket_id = ?
         ORDER BY bn.id ASC`,
        [bracketId]
      );
      nodes = rows;
    } catch (e) {
      // Minimal fallback without joins
      try {
        const [rows] = await connection.query(
          `SELECT * FROM bracket_nodes WHERE bracket_id = ? ORDER BY id ASC`,
          [bracketId]
        );
        nodes = rows;
      } catch (e2) {
        nodes = [];
      }
    }

    // If match_id empty but public_match_id set, try resolve
    for (const n of nodes) {
      if (!n.match_db_id && n.public_match_id) {
        try {
          const [mrows] = await connection.query(
            `SELECT m.*,
                    bt.name AS blue_team_name, bt.shortname AS blue_team_shortname,
                    rt.name AS red_team_name, rt.shortname AS red_team_shortname
             FROM matches m
             LEFT JOIN teams bt ON bt.id = m.blue_team_id
             LEFT JOIN teams rt ON rt.id = m.red_team_id
             WHERE m.public_match_id = ? OR m.id = ?
             LIMIT 1`,
            [n.public_match_id, n.public_match_id]
          );
          if (mrows[0]) {
            const m = mrows[0];
            Object.assign(n, {
              match_db_id: m.id,
              match_no: m.match_no,
              match_title: m.title,
              match_mode: m.mode,
              series_format: m.series_format,
              match_status: m.status,
              blue_team_id: m.blue_team_id,
              red_team_id: m.red_team_id,
              blue_score: m.blue_score,
              red_score: m.red_score,
              series_winner_team_id: m.series_winner_team_id,
              series_completed: m.series_completed,
              blue_team_name: m.blue_team_name,
              blue_team_shortname: m.blue_team_shortname,
              red_team_name: m.red_team_name,
              red_team_shortname: m.red_team_shortname,
            });
          }
        } catch (_) {
          /* ignore */
        }
      }
    }

    const { feeders } = buildFeederMaps(nodes);

    // Group nodes by round
    const nodesByRoundId = new Map();
    for (const n of nodes) {
      const rid = n.round_id != null ? Number(n.round_id) : 0;
      if (!nodesByRoundId.has(rid)) nodesByRoundId.set(rid, []);
      nodesByRoundId.get(rid).push(n);
    }
    for (const list of nodesByRoundId.values()) {
      list.sort((a, b) => (toInt(a.position) || 0) - (toInt(b.position) || 0) || a.id - b.id);
    }

    const isThirdPlaceRound = (r) => {
      const name = String(r.name || "").toLowerCase();
      const side = String(r.bracket_side || "").toLowerCase();
      return (
        side.includes("third") ||
        name.includes("third") ||
        name.includes("3rd") ||
        name.includes("battle for third")
      );
    };

    const mainRounds = [];
    let thirdPlaceMatch = null;
    let displayMatchCounter = 0;

    const orderedRounds =
      roundsRows.length > 0
        ? roundsRows
        : // Synthetic single round if only nodes exist
          [{ id: 0, name: "Bracket", round_number: 1, round_no: 1 }];

    for (const r of orderedRounds) {
      const rid = r.id != null ? Number(r.id) : 0;
      const roundNodes = nodesByRoundId.get(rid) || [];
      if (!roundNodes.length && rid !== 0) continue;

      const roundNo = toInt(r.round_number) || toInt(r.round_no) || toInt(r.sort_order) || mainRounds.length + 1;
      const title = r.name || `Round ${roundNo}`;
      const mode =
        r.default_series_format ||
        roundNodes.find((n) => n.series_format || n.match_mode)?.series_format ||
        roundNodes.find((n) => n.match_mode)?.match_mode ||
        null;

      const matches = roundNodes.map((node) => {
        const match = node.match_db_id
          ? {
              id: node.match_db_id,
              match_no: node.match_no,
              mode: node.match_mode,
              series_format: node.series_format,
              status: node.match_status,
              blue_team_id: node.blue_team_id,
              red_team_id: node.red_team_id,
              blue_score: node.blue_score,
              red_score: node.red_score,
              series_winner_team_id: node.series_winner_team_id,
              series_completed: node.series_completed,
              blue_team_name: node.blue_team_name,
              blue_team_shortname: node.blue_team_shortname,
              red_team_name: node.red_team_name,
              red_team_shortname: node.red_team_shortname,
            }
          : null;
        displayMatchCounter += 1;
        const built = buildMatchFromNode(node, match, feeders);
        if (!built.display_match_no) built.display_match_no = displayMatchCounter;
        if (!built.bracket_match_no) built.bracket_match_no = displayMatchCounter;
        return built;
      });

      if (isThirdPlaceRound(r) && matches.length) {
        // Use first node as third place card
        const m = matches[0];
        thirdPlaceMatch = {
          ...m,
          team_a_name: m.team_a_name,
          team_b_name: m.team_b_name,
          mode: mode || m.mode,
          is_third_place: true,
        };
        continue;
      }

      mainRounds.push({
        round_no: roundNo,
        title,
        mode: mode || "—",
        matches,
      });
    }

    // Nodes without round_id → append
    const orphanNodes = nodesByRoundId.get(0) || [];
    if (orphanNodes.length && !roundsRows.length) {
      // already handled in synthetic round
    } else if (orphanNodes.length) {
      mainRounds.push({
        round_no: mainRounds.length + 1,
        title: "Other Matches",
        mode: "—",
        matches: orphanNodes.map((node) => {
          const match = node.match_db_id
            ? {
                id: node.match_db_id,
                match_no: node.match_no,
                mode: node.match_mode,
                series_format: node.series_format,
                status: node.match_status,
                blue_team_id: node.blue_team_id,
                red_team_id: node.red_team_id,
                blue_score: node.blue_score,
                red_score: node.red_score,
                series_winner_team_id: node.series_winner_team_id,
                series_completed: node.series_completed,
                blue_team_name: node.blue_team_name,
                blue_team_shortname: node.blue_team_shortname,
                red_team_name: node.red_team_name,
                red_team_shortname: node.red_team_shortname,
              }
            : null;
          return buildMatchFromNode(node, match, feeders);
        }),
      });
    }

    // Participant estimate from seeds or unique teams
    let participantCount = 0;
    try {
      const [seedRows] = await connection.query(
        `SELECT COUNT(*) AS c FROM bracket_seeds WHERE bracket_id = ?`,
        [bracketId]
      );
      participantCount = Number(seedRows[0]?.c || 0);
    } catch (_) {
      const teamIds = new Set();
      for (const n of nodes) {
        if (n.blue_team_id) teamIds.add(Number(n.blue_team_id));
        if (n.red_team_id) teamIds.add(Number(n.red_team_id));
      }
      participantCount = teamIds.size;
    }

    const firstRoundMatches =
      mainRounds[0]?.matches?.filter((m) => m.should_display !== false).length || 0;
    const bracketSize =
      firstRoundMatches > 0 ? Math.pow(2, Math.ceil(Math.log2(firstRoundMatches * 2))) : null;

    const structure = {
      bracket_size: bracketSize,
      participant_count: participantCount || null,
      byes: null,
      rounds: mainRounds,
      third_place_match: thirdPlaceMatch,
    };

    res.json({
      success: true,
      bracket_id: bracketId,
      public_bracket_id: bracket.public_bracket_id || null,
      bracket_name: bracket.name || "Tournament Bracket",
      tournament_name: tournamentName,
      tournament_mode_name: modeName,
      is_group_stage: false,
      bracket: structure,
    });
  } catch (error) {
    console.error("Failed to build public bracket preview", error);
    res.status(500).json({
      success: false,
      message: "Failed to load bracket preview",
      error: error.message,
    });
  } finally {
    try {
      connection.release();
    } catch (_) {
      /* ignore */
    }
  }
});

/**
 * GET /api/brackets
 * List public brackets (for linking).
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.id, b.public_bracket_id, b.name, b.bracket_type, b.status,
              b.tournament_id, b.tournament_mode_id,
              t.name AS tournament_name,
              tm.name AS tournament_mode_name
       FROM brackets b
       LEFT JOIN tournaments t ON t.id = b.tournament_id
       LEFT JOIN tournament_modes tm ON tm.id = b.tournament_mode_id
       ORDER BY b.id DESC
       LIMIT 100`
    );
    res.json({ success: true, brackets: rows });
  } catch (error) {
    // Soft empty if table missing
    if (/doesn't exist|does not exist/i.test(error.message || "")) {
      return res.json({ success: true, brackets: [] });
    }
    console.error("Failed to list brackets", error);
    res.status(500).json({ message: "Failed to list brackets" });
  }
});

module.exports = router;
