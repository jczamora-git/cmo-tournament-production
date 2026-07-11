/**
 * Public bracket API — mirrors Controller GET /api/brackets/:id/preview
 * so production BracketTreePreview gets the same structure/labels/connectors.
 *
 * Pipeline (same as Controller):
 * 1) Load seeds + settings_json
 * 2) generateSingleEliminationBracket(...) → full tree with source refs
 * 3) Overlay live match teams/scores from bracket_nodes + matches by node_key
 */
const express = require("express");
const db = require("../db");
const { generateSingleEliminationBracket } = require("../services/bracketGenerator");

const router = express.Router();

function toInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadBracket(connection, idParam) {
  const id = toInt(idParam);
  if (!id) return null;
  try {
    const [byId] = await connection.query(`SELECT * FROM brackets WHERE id = ? LIMIT 1`, [id]);
    if (byId[0]) return byId[0];
  } catch (_) {
    /* ignore */
  }
  try {
    const [byPublic] = await connection.query(
      `SELECT * FROM brackets WHERE public_bracket_id = ? LIMIT 1`,
      [id]
    );
    if (byPublic[0]) return byPublic[0];
  } catch (_) {
    /* ignore */
  }
  return null;
}

/**
 * Load live node+match rows keyed by node_key (Controller-compatible fields).
 */
async function loadLiveNodesByKey(connection, bracketId) {
  // Prefer join on match_id; also try public_match_id mappings
  const queries = [
    `SELECT
        bn.node_key,
        bn.position,
        bn.label,
        bn.match_id,
        bn.public_match_id,
        bn.winner_to_node_id,
        bn.winner_to_slot,
        bn.loser_to_node_id,
        bn.loser_to_slot,
        bn.next_node_id,
        bn.next_public_node_id,
        bn.id AS node_id,
        m.id AS match_db_id,
        m.match_no,
        m.blue_team_id,
        m.red_team_id,
        m.blue_score,
        m.red_score,
        m.status,
        m.series_winner_team_id,
        m.series_completed,
        m.mode,
        m.series_format,
        m.title,
        bt.name AS blue_team_name,
        bt.shortname AS blue_team_short,
        rt.name AS red_team_name,
        rt.shortname AS red_team_short
     FROM bracket_nodes bn
     LEFT JOIN matches m
       ON m.id = bn.match_id
       OR (bn.public_match_id IS NOT NULL AND m.public_match_id = bn.public_match_id)
       OR (bn.public_match_id IS NOT NULL AND m.id = bn.public_match_id)
     LEFT JOIN teams bt ON bt.id = m.blue_team_id
     LEFT JOIN teams rt ON rt.id = m.red_team_id
     WHERE bn.bracket_id = ?`,
    `SELECT
        bn.node_key,
        bn.position,
        bn.label,
        bn.match_id,
        bn.public_match_id,
        bn.id AS node_id,
        m.id AS match_db_id,
        m.match_no,
        m.blue_team_id,
        m.red_team_id,
        m.blue_score,
        m.red_score,
        m.status,
        m.series_winner_team_id,
        m.series_completed,
        m.mode,
        m.series_format,
        bt.name AS blue_team_name,
        bt.shortname AS blue_team_short,
        rt.name AS red_team_name,
        rt.shortname AS red_team_short
     FROM bracket_nodes bn
     LEFT JOIN matches m ON m.id = bn.match_id
     LEFT JOIN teams bt ON bt.id = m.blue_team_id
     LEFT JOIN teams rt ON rt.id = m.red_team_id
     WHERE bn.bracket_id = ?`,
    `SELECT bn.node_key, bn.position, bn.label, bn.match_id, bn.public_match_id, bn.id AS node_id
     FROM bracket_nodes bn WHERE bn.bracket_id = ?`,
  ];

  for (const sql of queries) {
    try {
      const [rows] = await connection.query(sql, [bracketId]);
      return rows;
    } catch (_) {
      /* try next */
    }
  }
  return [];
}

/**
 * Build waiting labels from generator structure (source refs) + display numbers.
 * Controller uses winner_to_node_id; production often lacks that after sync,
 * but generator already encodes source_a_ref / source_b_ref.
 */
function buildDisplayNoByRef(structure) {
  const map = new Map();
  (structure.rounds || []).forEach((round) => {
    (round.matches || []).forEach((m) => {
      if (m.bracket_match_ref) {
        const no = m.display_match_no ?? m.match_no ?? m.bracket_match_no;
        if (no != null) map.set(m.bracket_match_ref, Number(no));
      }
    });
  });
  if (structure.third_place_match?.bracket_match_ref) {
    const m = structure.third_place_match;
    const no = m.display_match_no ?? m.match_no ?? m.bracket_match_no;
    if (no != null) map.set(m.bracket_match_ref, Number(no));
  }
  return map;
}

function waitingLabel(sourceRef, displayNoByRef, kind = "winner") {
  if (!sourceRef) return "TBD";
  const n = displayNoByRef.get(sourceRef);
  const who = kind === "loser" ? "Loser" : "Winner";
  if (n != null) return `Waiting: ${who} of Match #${n}`;
  return `Waiting: ${who} of ${sourceRef}`;
}

function applyLiveOverlay(structure, liveRows) {
  const byKey = new Map();
  for (const row of liveRows) {
    if (row.node_key) byKey.set(String(row.node_key), row);
  }

  // map ref -> live match_no for "Waiting: Winner of Match #N" (Controller style)
  const liveMatchNoByRef = new Map();
  for (const row of liveRows) {
    if (row.node_key && row.match_no != null) {
      liveMatchNoByRef.set(String(row.node_key), Number(row.match_no));
    }
  }

  const apply = (match, nodeKey, { thirdPlace = false } = {}) => {
    const live = byKey.get(nodeKey || match.bracket_match_ref);
    const sourceA = match.source_a_ref || match.team_a_source_ref || null;
    const sourceB = match.source_b_ref || match.team_b_source_ref || null;

    // Keep generator display_match_no for MATCH N headers (Controller parity)
    const generatorDisplayNo =
      match.display_match_no ?? match.bracket_match_no ?? null;

    if (!live) {
      return {
        ...match,
        source_a_ref: sourceA,
        source_b_ref: sourceB,
        team_a_source_ref: sourceA,
        team_b_source_ref: sourceB,
        display_match_no: generatorDisplayNo,
      };
    }

    const finished =
      String(live.status || "").toLowerCase() === "finished" ||
      String(live.status || "").toLowerCase() === "done" ||
      String(live.status || "").toLowerCase() === "completed" ||
      Boolean(live.series_winner_team_id) ||
      live.series_completed === 1 ||
      live.series_completed === true;

    const teamAId =
      live.blue_team_id != null && Number(live.blue_team_id) > 0
        ? Number(live.blue_team_id)
        : match.team_a_id && Number(match.team_a_id) > 0
          ? Number(match.team_a_id)
          : null;
    const teamBId =
      live.red_team_id != null && Number(live.red_team_id) > 0
        ? Number(live.red_team_id)
        : match.team_b_id && Number(match.team_b_id) > 0
          ? Number(match.team_b_id)
          : null;

    // Generator may already place a real team (or BYE) in a slot before match link exists
    const genA = match.team_a_name;
    const genB = match.team_b_name;
    const genAIsReal =
      genA &&
      !String(genA).startsWith("Winner of") &&
      !String(genA).startsWith("Loser of") &&
      !String(genA).startsWith("Waiting:") &&
      String(genA).toUpperCase() !== "TBD";
    const genBIsReal =
      genB &&
      !String(genB).startsWith("Winner of") &&
      !String(genB).startsWith("Loser of") &&
      !String(genB).startsWith("Waiting:") &&
      String(genB).toUpperCase() !== "TBD";

    let teamAName = null;
    let teamBName = null;

    if (teamAId) {
      teamAName =
        live.blue_team_name ||
        live.blue_team_short ||
        (genAIsReal ? genA : null) ||
        `Team #${teamAId}`;
    } else if (genAIsReal) {
      teamAName = genA; // seed / BYE from generator
    }

    if (teamBId) {
      teamBName =
        live.red_team_name ||
        live.red_team_short ||
        (genBIsReal ? genB : null) ||
        `Team #${teamBId}`;
    } else if (genBIsReal) {
      teamBName = genB;
    }

    return {
      ...match,
      team_a_id: teamAId,
      team_b_id: teamBId,
      team_a_name: teamAName,
      team_b_name: teamBName,
      team_a_auto_advanced: teamAId ? false : match.team_a_auto_advanced,
      team_b_auto_advanced: teamBId ? false : match.team_b_auto_advanced,
      match_id: live.match_db_id || live.match_id || match.match_id,
      match_no: live.match_no != null ? Number(live.match_no) : match.match_no,
      // Header number: keep generator sequential display (1..N), not global match_no
      display_match_no: generatorDisplayNo,
      match_status: live.status || match.match_status,
      blue_score: live.blue_score != null ? live.blue_score : match.blue_score ?? 0,
      red_score: live.red_score != null ? live.red_score : match.red_score ?? 0,
      series_winner_team_id: live.series_winner_team_id ?? match.series_winner_team_id,
      is_finished: finished,
      source_a_ref: sourceA,
      source_b_ref: sourceB,
      team_a_source_ref: sourceA,
      team_b_source_ref: sourceB,
      should_display: match.should_display !== false,
      is_third_place: thirdPlace || match.is_third_place,
    };
  };

  structure.rounds = (structure.rounds || []).map((round) => ({
    ...round,
    matches: (round.matches || []).map((m) => apply(m, m.bracket_match_ref)),
  }));

  if (structure.third_place_match) {
    structure.third_place_match = apply(
      structure.third_place_match,
      structure.third_place_match.bracket_match_ref || "B3M1",
      { thirdPlace: true }
    );
  }

  // Waiting labels: prefer feeder live match_no (Controller attachWaitingLabels style),
  // else generator display_match_no of the source ref.
  const displayNoByRef = buildDisplayNoByRef(structure);
  const waitingNoByRef = new Map(displayNoByRef);
  for (const [ref, no] of liveMatchNoByRef.entries()) {
    waitingNoByRef.set(ref, no);
  }

  const fillWaiting = (match, { thirdPlace = false } = {}) => {
    const sourceA = match.source_a_ref || match.team_a_source_ref;
    const sourceB = match.source_b_ref || match.team_b_source_ref;
    let teamAName = match.team_a_name;
    let teamBName = match.team_b_name;

    const needsWaiting = (n, teamId) => {
      if (teamId) return false;
      if (!n) return true;
      const s = String(n);
      return (
        s === "TBD" ||
        s.startsWith("Winner of ") ||
        s.startsWith("Loser of ") ||
        s.startsWith("Waiting:")
      );
    };

    if (needsWaiting(teamAName, match.team_a_id)) {
      teamAName = waitingLabel(sourceA, waitingNoByRef, thirdPlace ? "loser" : "winner");
    }
    if (needsWaiting(teamBName, match.team_b_id)) {
      teamBName = waitingLabel(sourceB, waitingNoByRef, thirdPlace ? "loser" : "winner");
    }

    if (String(match.team_a_name || "").toUpperCase() === "BYE") teamAName = "BYE";
    if (String(match.team_b_name || "").toUpperCase() === "BYE") teamBName = "BYE";

    return {
      ...match,
      team_a_name: teamAName || "TBD",
      team_b_name: teamBName || "TBD",
      display_match_no:
        match.display_match_no ??
        displayNoByRef.get(match.bracket_match_ref) ??
        match.bracket_match_no,
    };
  };

  structure.rounds = (structure.rounds || []).map((round) => ({
    ...round,
    matches: (round.matches || []).map((m) => fillWaiting(m)),
  }));
  if (structure.third_place_match) {
    structure.third_place_match = fillWaiting(structure.third_place_match, {
      thirdPlace: true,
    });
  }

  return structure;
}

/**
 * GET /api/brackets/:id/preview  (Controller-parity)
 */
router.get("/:id/preview", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const bracketRow = await loadBracket(connection, req.params.id);
    if (!bracketRow) {
      return res.status(404).json({ success: false, message: "Bracket not found" });
    }

    const bracketId = Number(bracketRow.id);

    let tournamentName = null;
    let tournamentModeName = null;
    try {
      if (bracketRow.tournament_id) {
        const [t] = await connection.query(`SELECT name FROM tournaments WHERE id = ? LIMIT 1`, [
          bracketRow.tournament_id,
        ]);
        tournamentName = t[0]?.name || null;
      }
      if (bracketRow.tournament_mode_id) {
        const [m] = await connection.query(
          `SELECT name FROM tournament_modes WHERE id = ? LIMIT 1`,
          [bracketRow.tournament_mode_id]
        );
        tournamentModeName = m[0]?.name || null;
      }
    } catch (_) {
      /* optional */
    }

    let settings = {};
    try {
      settings =
        typeof bracketRow.settings_json === "string"
          ? JSON.parse(bracketRow.settings_json)
          : bracketRow.settings_json || {};
    } catch {
      settings = {};
    }

    // Group stage guard
    if (
      bracketRow.name === "CODM BR Group Stage" ||
      settings.groupA_team_ids ||
      settings.groupB_team_ids
    ) {
      return res.json({
        success: true,
        bracket_id: bracketId,
        bracket_name: bracketRow.name || null,
        tournament_name: tournamentName,
        tournament_mode_name: tournamentModeName,
        is_group_stage: true,
        bracket: null,
        message: "Group stage brackets do not have a single-elimination tree preview.",
      });
    }

    // Seeds (Controller table: bracket_seeds) — preferred source for generator tree
    let seeds = [];
    const seedQueries = [
      `SELECT bs.team_id, bs.seed_no,
              COALESCE(t.name, bs.team_name) AS name
       FROM bracket_seeds bs
       LEFT JOIN teams t ON t.id = bs.team_id
       WHERE bs.bracket_id = ?
       ORDER BY bs.seed_no ASC`,
      `SELECT bs.team_id, bs.seed_no, t.name
       FROM bracket_seeds bs
       LEFT JOIN teams t ON t.id = bs.team_id
       WHERE bs.bracket_id = ?
       ORDER BY bs.seed_no ASC`,
      `SELECT team_id, seed_no, team_name AS name
       FROM bracket_seeds
       WHERE bracket_id = ?
       ORDER BY seed_no ASC`,
    ];
    for (const sql of seedQueries) {
      try {
        const [seedRows] = await connection.query(sql, [bracketId]);
        seeds = seedRows;
        break;
      } catch (seedErr) {
        console.warn("[brackets] seeds query variant failed:", seedErr.message);
      }
    }

    if (seeds.length < 2) {
      // Try building participants from R1 nodes/matches
      const live = await loadLiveNodesByKey(connection, bracketId);
      const r1 = live
        .filter((n) => String(n.node_key || "").startsWith("R1"))
        .sort((a, b) => String(a.node_key).localeCompare(String(b.node_key)));
      const participants = [];
      let seed = 1;
      for (const n of r1) {
        if (n.blue_team_id) {
          participants.push({
            team_id: Number(n.blue_team_id),
            seed: seed++,
            name: n.blue_team_name || n.blue_team_short || `Team ${n.blue_team_id}`,
          });
        }
        if (n.red_team_id) {
          participants.push({
            team_id: Number(n.red_team_id),
            seed: seed++,
            name: n.red_team_name || n.red_team_short || `Team ${n.red_team_id}`,
          });
        }
      }
      if (participants.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Bracket has fewer than 2 seeds; cannot build preview",
        });
      }
      seeds = participants.map((p) => ({
        team_id: p.team_id,
        seed_no: p.seed,
        name: p.name,
      }));
    }

    const roundModes = settings.roundModes || {};
    const options = settings.options || {};
    const participants = seeds.map((s) => ({
      team_id: Number(s.team_id),
      seed: Number(s.seed_no ?? s.seed),
      name: s.name || `Team ${s.team_id}`,
    }));

    let structure = generateSingleEliminationBracket(participants, {
      roundModes,
      bracketType: options.bracketType || bracketRow.bracket_type || "single_elimination",
      seedingMode: options.seedingMode || "manual",
      includeThirdPlace:
        options.includeThirdPlace != null
          ? options.includeThirdPlace
          : Boolean(bracketRow.third_place_enabled),
      thirdPlaceMode: roundModes["Battle for Third"],
    });

    // Overlay live match state by node_key (R1M1, R2M1, B3M1, …)
    try {
      const liveRows = await loadLiveNodesByKey(connection, bracketId);
      structure = applyLiveOverlay(structure, liveRows);
    } catch (overlayErr) {
      console.warn("[brackets] live overlay skipped:", overlayErr.message);
    }

    res.json({
      success: true,
      bracket_id: bracketId,
      public_bracket_id: bracketRow.public_bracket_id || null,
      bracket_name: bracketRow.name || "Tournament Bracket",
      tournament_name: tournamentName,
      tournament_mode_name: tournamentModeName,
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

/** GET /api/brackets — list */
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
    if (/doesn't exist|does not exist/i.test(error.message || "")) {
      return res.json({ success: true, brackets: [] });
    }
    console.error("Failed to list brackets", error);
    res.status(500).json({ message: "Failed to list brackets" });
  }
});

module.exports = router;
