/**
 * Public read-only bracket endpoints.
 * Builds Controller-compatible tree preview for BracketTreePreview:
 * - bracket_match_ref + source_a_ref/source_b_ref → connecting lines
 * - team names / scores / waiting labels → correct advancement display
 */
const express = require("express");
const db = require("../db");

const router = express.Router();

function toInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isFinishedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "finished" || s === "done" || s === "completed";
}

function isTruthyFlag(v) {
  return v === true || v === 1 || v === "1" || v === "true";
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

async function loadTournamentMeta(connection, tournamentId, modeId) {
  let tournamentName = null;
  let modeName = null;
  try {
    if (tournamentId) {
      const [t] = await connection.query(`SELECT name FROM tournaments WHERE id = ? LIMIT 1`, [
        tournamentId,
      ]);
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

function isThirdPlaceRound(r) {
  const name = String(r?.name || "").toLowerCase();
  const side = String(r?.bracket_side || r?.side || "").toLowerCase();
  return (
    side.includes("third") ||
    name.includes("third") ||
    name.includes("3rd") ||
    name.includes("battle for third")
  );
}

function sortNodes(list) {
  return [...list].sort(
    (a, b) =>
      (toInt(a.position) ?? 9999) - (toInt(b.position) ?? 9999) ||
      (toInt(a.id) || 0) - (toInt(b.id) || 0)
  );
}

function nodeKeyOf(node, roundNo, indexInRound) {
  const raw = node.node_key != null ? String(node.node_key).trim() : "";
  if (raw) return raw;
  return `R${roundNo}M${indexInRound + 1}`;
}

/**
 * Resolve feeder links into each destination node.
 * Priority:
 * 1) explicit next_node_id / next_public_node_id graph
 * 2) classic SE pairing by position within consecutive main rounds
 */
function resolveFeeders(mainRoundNodes, allNodes) {
  // destNodeId -> [sourceKey, sourceKey]
  const feedersByDestId = new Map();

  const nodesById = new Map(allNodes.map((n) => [Number(n.id), n]));
  const nodesByKey = new Map();
  for (const n of allNodes) {
    if (n._key) nodesByKey.set(String(n._key), n);
    if (n.node_key) nodesByKey.set(String(n.node_key), n);
    if (n.public_node_id != null) nodesByKey.set(String(n.public_node_id), n);
  }

  const pushFeeder = (destId, sourceKey, sourcePos) => {
    if (!destId || !sourceKey) return;
    if (!feedersByDestId.has(destId)) feedersByDestId.set(destId, []);
    const list = feedersByDestId.get(destId);
    if (list.some((x) => x.key === sourceKey)) return;
    list.push({ key: sourceKey, position: sourcePos ?? 0 });
    list.sort((a, b) => a.position - b.position);
  };

  // 1) Explicit graph edges
  for (const n of allNodes) {
    const sourceKey = n._key;
    const sourcePos = toInt(n.position) || 0;
    let destId = toInt(n.next_node_id);

    if (!destId && n.next_public_node_id != null && n.next_public_node_id !== "") {
      const ref = String(n.next_public_node_id);
      const dest =
        nodesByKey.get(ref) ||
        nodesById.get(toInt(ref)) ||
        allNodes.find((x) => String(x.public_node_id) === ref);
      if (dest) destId = Number(dest.id);
    }

    if (destId) pushFeeder(destId, sourceKey, sourcePos);
  }

  // 2) SE structure inference when graph is sparse/missing
  for (let r = 1; r < mainRoundNodes.length; r += 1) {
    const prev = mainRoundNodes[r - 1];
    const curr = mainRoundNodes[r];
    for (let i = 0; i < curr.length; i += 1) {
      const dest = curr[i];
      const destId = Number(dest.id);
      const existing = feedersByDestId.get(destId) || [];
      if (existing.length >= 2) continue;

      const a = prev[i * 2];
      const b = prev[i * 2 + 1];
      if (a) pushFeeder(destId, a._key, toInt(a.position) || i * 2);
      if (b) pushFeeder(destId, b._key, toInt(b.position) || i * 2 + 1);
    }
  }

  // Normalize to two slots
  const result = new Map();
  for (const [destId, list] of feedersByDestId.entries()) {
    result.set(destId, {
      source_a_ref: list[0]?.key || null,
      source_b_ref: list[1]?.key || null,
    });
  }
  return result;
}

function teamLabel(row, side) {
  if (!row) return null;
  if (side === "a") {
    const name = row.blue_team_name || row.blue_team_shortname;
    if (name) return name;
    if (row.blue_team_id) return `Team #${row.blue_team_id}`;
    return null;
  }
  const name = row.red_team_name || row.red_team_shortname;
  if (name) return name;
  if (row.red_team_id) return `Team #${row.red_team_id}`;
  return null;
}

function buildMatchCard(node, feeders, displayNoByKey) {
  const destId = Number(node.id);
  const key = node._key;
  const feeder = feeders.get(destId) || { source_a_ref: null, source_b_ref: null };

  const teamAId = toInt(node.blue_team_id);
  const teamBId = toInt(node.red_team_id);
  let teamAName = teamLabel(node, "a");
  let teamBName = teamLabel(node, "b");

  const formatWaiting = (sourceRef) => {
    if (!sourceRef) return "TBD";
    const disp = displayNoByKey.get(sourceRef);
    if (disp) return `Waiting: Winner of Match ${disp}`;
    return `Waiting: Winner of ${sourceRef}`;
  };

  if (!teamAId && !teamAName) {
    teamAName = formatWaiting(feeder.source_a_ref);
  }
  if (!teamBId && !teamBName) {
    teamBName = formatWaiting(feeder.source_b_ref);
  }

  const finished =
    isTruthyFlag(node.series_completed) ||
    isFinishedStatus(node.match_status) ||
    Boolean(node.series_winner_team_id);

  const displayNo =
    toInt(node.match_no) ||
    toInt(node.position) ||
    toInt(node._displayNo) ||
    destId;

  return {
    bracket_match_ref: key,
    bracket_match_no: displayNo,
    display_match_no: displayNo,
    team_a_id: teamAId,
    team_b_id: teamBId,
    team_a_name: teamAName,
    team_b_name: teamBName,
    seed_a: node.seed_a ?? null,
    seed_b: node.seed_b ?? null,
    team_a_source_ref: feeder.source_a_ref,
    team_b_source_ref: feeder.source_b_ref,
    // Connectors in BracketTreePreview use these exact keys
    source_a_ref: feeder.source_a_ref,
    source_b_ref: feeder.source_b_ref,
    blue_score: node.blue_score != null ? node.blue_score : null,
    red_score: node.red_score != null ? node.red_score : null,
    series_winner_team_id: node.series_winner_team_id ?? null,
    is_finished: finished,
    match_status: node.match_status || null,
    match_id: node.match_db_id || node.match_id || null,
    mode: node.series_format || node.match_mode || null,
    should_display: true,
    label: node.label || null,
  };
}

/**
 * Attach match + team fields onto nodes using multiple join strategies.
 */
async function hydrateNodesWithMatches(connection, nodes) {
  // Primary join already done; fill gaps via public_match_id / match_id
  for (const n of nodes) {
    if (n.match_db_id) continue;
    const candidates = [n.match_id, n.public_match_id].map(toInt).filter(Boolean);
    for (const cid of candidates) {
      try {
        const [mrows] = await connection.query(
          `SELECT m.id AS match_db_id,
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
           FROM matches m
           LEFT JOIN teams bt ON bt.id = m.blue_team_id
           LEFT JOIN teams rt ON rt.id = m.red_team_id
           WHERE m.id = ? OR m.public_match_id = ?
           LIMIT 1`,
          [cid, cid]
        );
        if (mrows[0]) {
          Object.assign(n, mrows[0]);
          break;
        }
      } catch (_) {
        /* ignore */
      }
    }
  }
  return nodes;
}

/**
 * GET /api/brackets/:id/preview
 */
router.get("/:id/preview", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const bracket = await loadBracket(connection, req.params.id);
    if (!bracket) {
      return res.status(404).json({ success: false, message: "Bracket not found" });
    }

    const bracketId = Number(bracket.id);
    const { tournamentName, modeName } = await loadTournamentMeta(
      connection,
      bracket.tournament_id,
      bracket.tournament_mode_id
    );

    // —— Rounds ——
    let roundsRows = [];
    const roundQueries = [
      `SELECT * FROM bracket_rounds WHERE bracket_id = ? ORDER BY round_number ASC, sort_order ASC, id ASC`,
      `SELECT * FROM bracket_rounds WHERE bracket_id = ? ORDER BY round_no ASC, id ASC`,
      `SELECT * FROM bracket_rounds WHERE bracket_id = ? ORDER BY id ASC`,
    ];
    for (const sql of roundQueries) {
      try {
        const [rows] = await connection.query(sql, [bracketId]);
        roundsRows = rows;
        break;
      } catch (_) {
        /* try next */
      }
    }

    // —— Nodes (+ matches/teams) ——
    let nodes = [];
    const nodeQueries = [
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
       LEFT JOIN matches m
         ON m.id = bn.match_id
         OR (bn.public_match_id IS NOT NULL AND m.public_match_id = bn.public_match_id)
         OR (bn.public_match_id IS NOT NULL AND m.id = bn.public_match_id)
       LEFT JOIN teams bt ON bt.id = m.blue_team_id
       LEFT JOIN teams rt ON rt.id = m.red_team_id
       WHERE bn.bracket_id = ?
       ORDER BY bn.id ASC`,
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
      `SELECT * FROM bracket_nodes WHERE bracket_id = ? ORDER BY id ASC`,
    ];
    for (const sql of nodeQueries) {
      try {
        const [rows] = await connection.query(sql, [bracketId]);
        nodes = rows;
        break;
      } catch (_) {
        /* try next */
      }
    }

    await hydrateNodesWithMatches(connection, nodes);

    // Group by round
    const roundsMeta =
      roundsRows.length > 0
        ? roundsRows
        : [{ id: 0, name: "Bracket", round_number: 1, round_no: 1 }];

    const nodesByRoundId = new Map();
    for (const n of nodes) {
      const rid = n.round_id != null ? Number(n.round_id) : 0;
      if (!nodesByRoundId.has(rid)) nodesByRoundId.set(rid, []);
      nodesByRoundId.get(rid).push(n);
    }

    // Prepare ordered main rounds + third place
    const preparedMain = [];
    let thirdPlaceNodes = [];

    for (const r of roundsMeta) {
      const rid = r.id != null ? Number(r.id) : 0;
      const roundNodes = sortNodes(nodesByRoundId.get(rid) || []);
      if (!roundNodes.length && rid !== 0) continue;

      const roundNo =
        toInt(r.round_number) ||
        toInt(r.round_no) ||
        toInt(r.sort_order) ||
        preparedMain.length + 1;

      if (isThirdPlaceRound(r)) {
        thirdPlaceNodes = roundNodes.map((n, idx) => {
          n._key = nodeKeyOf(n, roundNo, idx);
          n._roundNo = roundNo;
          n._roundTitle = r.name || "Battle for Third";
          n._roundMode = r.default_series_format || null;
          return n;
        });
        continue;
      }

      const labeled = roundNodes.map((n, idx) => {
        n._key = nodeKeyOf(n, roundNo, idx);
        n._roundNo = roundNo;
        n._roundTitle = r.name || `Round ${roundNo}`;
        n._roundMode = r.default_series_format || null;
        return n;
      });

      preparedMain.push({
        round_no: roundNo,
        title: r.name || `Round ${roundNo}`,
        mode: r.default_series_format || null,
        nodes: labeled,
      });
    }

    // Orphans
    const orphan = sortNodes(nodesByRoundId.get(0) || []);
    if (orphan.length && roundsRows.length) {
      const roundNo = preparedMain.length + 1;
      preparedMain.push({
        round_no: roundNo,
        title: "Other Matches",
        mode: null,
        nodes: orphan.map((n, idx) => {
          n._key = nodeKeyOf(n, roundNo, idx);
          n._roundNo = roundNo;
          return n;
        }),
      });
    } else if (orphan.length && !roundsRows.length && preparedMain.length === 0) {
      preparedMain.push({
        round_no: 1,
        title: "Bracket",
        mode: null,
        nodes: orphan.map((n, idx) => {
          n._key = nodeKeyOf(n, 1, idx);
          n._roundNo = 1;
          return n;
        }),
      });
    }

    // Sort main rounds by round_no
    preparedMain.sort((a, b) => a.round_no - b.round_no);

    // Assign sequential display numbers (for Winner of Match N labels)
    let displayCounter = 0;
    const displayNoByKey = new Map();
    for (const round of preparedMain) {
      for (const n of round.nodes) {
        displayCounter += 1;
        const dn = toInt(n.match_no) || displayCounter;
        n._displayNo = dn;
        displayNoByKey.set(n._key, dn);
      }
    }
    for (const n of thirdPlaceNodes) {
      displayCounter += 1;
      const dn = toInt(n.match_no) || displayCounter;
      n._displayNo = dn;
      displayNoByKey.set(n._key, dn);
    }

    const allLabeledNodes = [
      ...preparedMain.flatMap((r) => r.nodes),
      ...thirdPlaceNodes,
    ];
    const mainRoundNodes = preparedMain.map((r) => r.nodes);
    const feeders = resolveFeeders(mainRoundNodes, allLabeledNodes);

    // Build Controller-compatible preview structure
    const previewRounds = preparedMain.map((r) => {
      const matches = r.nodes.map((n) => buildMatchCard(n, feeders, displayNoByKey));
      const modeFromMatch =
        matches.find((m) => m.mode)?.mode ||
        r.nodes.find((n) => n.series_format || n.match_mode)?.series_format ||
        r.nodes.find((n) => n.match_mode)?.match_mode ||
        r.mode ||
        "—";
      return {
        round_no: r.round_no,
        title: r.title,
        mode: modeFromMatch,
        matches,
      };
    });

    let thirdPlaceMatch = null;
    if (thirdPlaceNodes.length) {
      const n = thirdPlaceNodes[0];
      // Third place feeders: usually losers of semis — if no explicit links, leave TBD
      // or use last main round as loser sources (best-effort)
      if (!feeders.has(Number(n.id)) && preparedMain.length >= 2) {
        const semis = preparedMain[preparedMain.length - 2]?.nodes || [];
        if (semis.length >= 2) {
          feeders.set(Number(n.id), {
            source_a_ref: semis[0]._key,
            source_b_ref: semis[1]._key,
          });
        }
      }
      const card = buildMatchCard(n, feeders, displayNoByKey);
      // Third place waiting uses Loser of when no teams yet
      if (
        !card.team_a_id &&
        typeof card.team_a_name === "string" &&
        card.team_a_name.startsWith("Waiting: Winner of")
      ) {
        card.team_a_name = card.team_a_name.replace("Winner of", "Loser of");
      }
      if (
        !card.team_b_id &&
        typeof card.team_b_name === "string" &&
        card.team_b_name.startsWith("Waiting: Winner of")
      ) {
        card.team_b_name = card.team_b_name.replace("Winner of", "Loser of");
      }
      thirdPlaceMatch = {
        ...card,
        mode: n._roundMode || card.mode || "—",
        is_third_place: true,
      };
    }

    // Stats
    let participantCount = 0;
    try {
      const [seedRows] = await connection.query(
        `SELECT COUNT(*) AS c FROM bracket_seeds WHERE bracket_id = ?`,
        [bracketId]
      );
      participantCount = Number(seedRows[0]?.c || seedRows[0]?.C || 0);
    } catch (_) {
      const ids = new Set();
      for (const n of allLabeledNodes) {
        if (n.blue_team_id) ids.add(Number(n.blue_team_id));
        if (n.red_team_id) ids.add(Number(n.red_team_id));
      }
      participantCount = ids.size;
    }

    const firstCount = previewRounds[0]?.matches?.length || 0;
    const bracketSize =
      firstCount > 0 ? Math.pow(2, Math.ceil(Math.log2(Math.max(firstCount, 1)))) : null;

    // Count byes (BYE labels or single-team finished first round)
    let byes = 0;
    for (const m of previewRounds[0]?.matches || []) {
      if (
        String(m.team_a_name).toUpperCase() === "BYE" ||
        String(m.team_b_name).toUpperCase() === "BYE"
      ) {
        byes += 1;
      }
    }

    const structure = {
      bracket_size: bracketSize,
      participant_count: participantCount || null,
      byes: byes || null,
      rounds: previewRounds,
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
      // debug helpers for troubleshooting (harmless for UI)
      meta: {
        rounds_loaded: roundsRows.length,
        nodes_loaded: nodes.length,
        feeders: feeders.size,
      },
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
 * GET /api/brackets — list for picker links
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
    if (/doesn't exist|does not exist/i.test(error.message || "")) {
      return res.json({ success: true, brackets: [] });
    }
    console.error("Failed to list brackets", error);
    res.status(500).json({ message: "Failed to list brackets" });
  }
});

module.exports = router;
