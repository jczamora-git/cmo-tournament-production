const express = require("express");
const db = require("../db");
const requireSyncToken = require("../middleware/requireSyncToken");
const { ensureSyncSchema } = require("../services/ensureSyncSchema");

const router = express.Router();

router.use(requireSyncToken);

// Controller game lifecycle statuses (+ legacy values for compatibility)
const GAME_STATUSES = ["setup", "drafting", "live", "finished", "cancelled", "queued", "active"];
const MATCH_STATUSES = [
  "queued",
  "active",
  "live",
  "finished",
  "cancelled",
  "setup",
  "drafting",
  "upcoming",
  "scheduled",
  "done",
  "completed",
];

function parsePositiveInt(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function parseNonNegInt(val, fallback = 0) {
  if (val === undefined || val === null || val === "") return fallback;
  const num = Number(val);
  return Number.isInteger(num) && num >= 0 ? num : null;
}

function toBool(val) {
  if (val === true || val === 1 || val === "1" || val === "true") return true;
  if (val === false || val === 0 || val === "0" || val === "false" || val === null || val === undefined) {
    return false;
  }
  return Boolean(val);
}

function normalizeStatus(status) {
  if (status === undefined || status === null || status === "") return null;
  return String(status).trim().toLowerCase();
}

function emptySyncStats(received = 0) {
  return {
    success: true,
    received,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };
}

function getInsertId(result, meta) {
  return (meta && meta.insertId) || (result && result[0] && result[0].id) || null;
}

async function findMatchIdByPublicId(connection, publicMatchId) {
  if (!publicMatchId) return null;
  const [rows] = await connection.query(
    `SELECT id FROM matches WHERE public_match_id = ? LIMIT 1`,
    [publicMatchId]
  );
  return rows[0]?.id || null;
}

function buildBrStandingsUpsertSql() {
  if (db.client === "postgres") {
    return `
      INSERT INTO br_group_standings (
        tournament_id, tournament_mode_id, group_name, team_id,
        kills, placement_points, kill_points, total_points, final_rank,
        rounds_played, is_eliminated, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON CONFLICT (tournament_id, tournament_mode_id, group_name, team_id)
      DO UPDATE SET
        kills = EXCLUDED.kills,
        placement_points = EXCLUDED.placement_points,
        kill_points = EXCLUDED.kill_points,
        total_points = EXCLUDED.total_points,
        final_rank = EXCLUDED.final_rank,
        rounds_played = EXCLUDED.rounds_played,
        is_eliminated = EXCLUDED.is_eliminated,
        updated_at = NOW()
    `;
  }

  return `
    INSERT INTO br_group_standings (
      tournament_id, tournament_mode_id, group_name, team_id,
      kills, placement_points, kill_points, total_points, final_rank,
      rounds_played, is_eliminated, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      kills = VALUES(kills),
      placement_points = VALUES(placement_points),
      kill_points = VALUES(kill_points),
      total_points = VALUES(total_points),
      final_rank = VALUES(final_rank),
      rounds_played = VALUES(rounds_played),
      is_eliminated = VALUES(is_eliminated),
      updated_at = NOW()
  `;
}

// 5. GET /api/sync/tournaments
router.get("/tournaments", async (req, res) => {
  try {
    let sql = `SELECT id, name, slug, game_type, season, description, status, banner_url, logo_url, cover_image_url, logo_image_url, start_date, end_date, is_active, created_at, updated_at FROM tournaments`;
    const params = [];

    const tId = parsePositiveInt(req.query.tournament_id);
    if (tId) {
      sql += ` WHERE id = ?`;
      params.push(tId);
    }

    sql += ` ORDER BY CASE WHEN start_date IS NULL THEN 1 ELSE 0 END ASC, start_date DESC, id DESC`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[sync-api] /tournaments error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 6. GET /api/sync/tournament-modes
router.get("/tournament-modes", async (req, res) => {
  try {
    let sql = `SELECT id, tournament_id, code, name, competition_type, team_upload_enabled, is_active, sort_order, created_at, updated_at FROM tournament_modes WHERE 1=1`;
    const params = [];

    const tId = parsePositiveInt(req.query.tournament_id);
    const mId = parsePositiveInt(req.query.tournament_mode_id);

    if (tId) {
      sql += ` AND tournament_id = ?`;
      params.push(tId);
    }
    if (mId) {
      sql += ` AND id = ?`;
      params.push(mId);
    }

    sql += ` ORDER BY sort_order ASC, id ASC`;

    const [rows] = await db.query(sql, params);
    
    // Validate mismatch context
    if (tId && mId && rows.length === 0) {
      // Check if mode exists but belongs to a different tournament
      const [check] = await db.query(`SELECT id FROM tournament_modes WHERE id = ?`, [mId]);
      if (check.length > 0) {
        return res.status(400).json({ success: false, code: "CONTEXT_MISMATCH", message: "Mode does not belong to the given tournament" });
      }
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[sync-api] /tournament-modes error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 7. GET /api/sync/teams
router.get("/teams", async (req, res) => {
  try {
    let sql = `SELECT id, name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id, created_at, updated_at FROM teams WHERE 1=1`;
    const params = [];

    const tId = parsePositiveInt(req.query.tournament_id);
    const mId = parsePositiveInt(req.query.tournament_mode_id);

    if (tId) {
      sql += ` AND tournament_id = ?`;
      params.push(tId);
    }
    if (mId) {
      sql += ` AND tournament_mode_id = ?`;
      params.push(mId);
      
      // If mode supplied without tournament, require tournament context or validate it
      if (!tId) {
        return res.status(400).json({ success: false, code: "MISSING_CONTEXT", message: "tournament_id is required when tournament_mode_id is provided" });
      }
    }

    const [rows] = await db.query(sql, params);

    if (tId && mId && rows.length === 0) {
      const [check] = await db.query(`SELECT id FROM tournament_modes WHERE id = ? AND tournament_id != ?`, [mId, tId]);
      if (check.length > 0) {
        return res.status(400).json({ success: false, code: "CONTEXT_MISMATCH", message: "Mode does not belong to the given tournament" });
      }
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[sync-api] /teams error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 8. GET /api/sync/players
router.get("/players", async (req, res) => {
  try {
    let sql = `SELECT p.id, p.team_id, p.ign, p.role, p.photo, p.is_active, p.created_at, p.updated_at 
               FROM players p
               JOIN teams t ON p.team_id = t.id
               WHERE 1=1`;
    const params = [];

    const tId = parsePositiveInt(req.query.tournament_id);
    const mId = parsePositiveInt(req.query.tournament_mode_id);
    const teamId = parsePositiveInt(req.query.team_id);

    if (tId) {
      sql += ` AND t.tournament_id = ?`;
      params.push(tId);
    }
    if (mId) {
      sql += ` AND t.tournament_mode_id = ?`;
      params.push(mId);
      if (!tId) {
        return res.status(400).json({ success: false, code: "MISSING_CONTEXT", message: "tournament_id is required when tournament_mode_id is provided" });
      }
    }
    if (teamId) {
      sql += ` AND p.team_id = ?`;
      params.push(teamId);
    }

    const [rows] = await db.query(sql, params);

    if (tId && mId && rows.length === 0) {
      const [check] = await db.query(`SELECT id FROM tournament_modes WHERE id = ? AND tournament_id != ?`, [mId, tId]);
      if (check.length > 0) {
        return res.status(400).json({ success: false, code: "CONTEXT_MISMATCH", message: "Mode does not belong to the given tournament" });
      }
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[sync-api] /players error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 9. POST /api/sync/matches
// Accepts public_match_id for idempotent upsert from Controller.
router.post("/matches", async (req, res) => {
  const {
    tournament_id,
    tournament_mode_id,
    match_no,
    title,
    mode,
    blue_team_id,
    red_team_id,
    blue_score,
    red_score,
    status,
    series_completed,
    series_winner_team_id,
    series_completed_at,
    queue_order,
    public_match_id,
    match_public_id,
  } = req.body || {};

  const stats = emptySyncStats(1);
  const tId = parsePositiveInt(tournament_id);
  const mId = parsePositiveInt(tournament_mode_id);
  const publicMatchId = parsePositiveInt(public_match_id || match_public_id);

  if (!tId || !mId) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Valid tournament_id and tournament_mode_id are required",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: "Valid tournament_id and tournament_mode_id are required" }],
    });
  }

  const connection = await db.getConnection();
  try {
    await ensureSyncSchema(connection);

    const [modeRows] = await connection.query(
      `SELECT competition_type FROM tournament_modes WHERE id = ? AND tournament_id = ?`,
      [mId, tId]
    );
    if (modeRows.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        code: "CONTEXT_MISMATCH",
        message: "Tournament mode does not match tournament",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: "Tournament mode does not match tournament" }],
      });
    }
    const compType = modeRows[0].competition_type;

    let bId = parsePositiveInt(blue_team_id);
    let rId = parsePositiveInt(red_team_id);

    if (compType === "head_to_head") {
      if (!bId || !rId) {
        connection.release();
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Both blue_team_id and red_team_id are required for head_to_head",
          received: 1,
          created: 0,
          updated: 0,
          failed: 1,
          errors: [{ message: "Both blue_team_id and red_team_id are required for head_to_head" }],
        });
      }
      if (bId === rId) {
        connection.release();
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Teams must be different",
          received: 1,
          created: 0,
          updated: 0,
          failed: 1,
          errors: [{ message: "Teams must be different" }],
        });
      }

      const [teams] = await connection.query(
        `SELECT id, tournament_id, tournament_mode_id FROM teams WHERE id IN (?, ?)`,
        [bId, rId]
      );
      if (teams.length !== 2) {
        connection.release();
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: "One or both teams do not exist",
          received: 1,
          created: 0,
          updated: 0,
          failed: 1,
          errors: [{ message: "One or both teams do not exist" }],
        });
      }
      for (const t of teams) {
        if (t.tournament_id !== tId || t.tournament_mode_id !== mId) {
          connection.release();
          return res.status(400).json({
            success: false,
            code: "VALIDATION_ERROR",
            message: "Teams do not belong to the requested tournament mode",
            received: 1,
            created: 0,
            updated: 0,
            failed: 1,
            errors: [{ message: "Teams do not belong to the requested tournament mode" }],
          });
        }
      }
    } else {
      bId = bId || null;
      rId = rId || null;
    }

    const normalizedStatus = normalizeStatus(status) || "queued";
    if (!MATCH_STATUSES.includes(normalizedStatus)) {
      connection.release();
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid status",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: `Invalid status: ${status}` }],
      });
    }

    const matchFields = {
      match_no: parsePositiveInt(match_no) || 1,
      blue_team_id: bId,
      red_team_id: rId,
      mode: mode || "BO3",
      title: title || "Match",
      queue_order: parsePositiveInt(queue_order) || 1,
      blue_score: parseNonNegInt(blue_score, 0) ?? 0,
      red_score: parseNonNegInt(red_score, 0) ?? 0,
      status: normalizedStatus,
      series_completed: series_completed === true || series_completed === 1 ? 1 : 0,
      series_winner_team_id: parsePositiveInt(series_winner_team_id) || null,
      series_completed_at: series_completed_at || null,
      tournament_id: tId,
      tournament_mode_id: mId,
      public_match_id: publicMatchId,
    };

    await connection.beginTransaction();

    let existingId = null;
    if (publicMatchId) {
      existingId = await findMatchIdByPublicId(connection, publicMatchId);
    }

    let matchId;
    if (existingId) {
      await connection.query(
        `UPDATE matches SET
          match_no = ?, blue_team_id = ?, red_team_id = ?, mode = ?, title = ?,
          queue_order = ?, blue_score = ?, red_score = ?, status = ?,
          series_completed = ?, series_winner_team_id = ?, series_completed_at = ?,
          tournament_id = ?, tournament_mode_id = ?, public_match_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          matchFields.match_no,
          matchFields.blue_team_id,
          matchFields.red_team_id,
          matchFields.mode,
          matchFields.title,
          matchFields.queue_order,
          matchFields.blue_score,
          matchFields.red_score,
          matchFields.status,
          matchFields.series_completed,
          matchFields.series_winner_team_id,
          matchFields.series_completed_at,
          matchFields.tournament_id,
          matchFields.tournament_mode_id,
          matchFields.public_match_id,
          existingId,
        ]
      );
      matchId = existingId;
      stats.updated = 1;
    } else {
      const insertSql = `
        INSERT INTO matches (
          match_no, blue_team_id, red_team_id, mode, title, queue_order,
          blue_score, red_score, status, series_completed, series_winner_team_id,
          series_completed_at, tournament_id, tournament_mode_id, public_match_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result, meta] = await connection.query(insertSql, [
        matchFields.match_no,
        matchFields.blue_team_id,
        matchFields.red_team_id,
        matchFields.mode,
        matchFields.title,
        matchFields.queue_order,
        matchFields.blue_score,
        matchFields.red_score,
        matchFields.status,
        matchFields.series_completed,
        matchFields.series_winner_team_id,
        matchFields.series_completed_at,
        matchFields.tournament_id,
        matchFields.tournament_mode_id,
        matchFields.public_match_id,
      ]);
      matchId = getInsertId(result, meta);
      stats.created = 1;
    }

    await connection.commit();
    connection.release();

    console.log(
      `[sync-api] match ${stats.updated ? "updated" : "created"} id=${matchId} public_match_id=${publicMatchId || "n/a"} tournament=${tId} mode=${mId}`
    );
    res.json({
      ...stats,
      id: matchId,
      public_match_id: publicMatchId || null,
      data: { id: matchId, public_match_id: publicMatchId || null },
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      /* ignore */
    }
    try {
      connection.release();
    } catch (_) {
      /* ignore */
    }
    console.error("[sync-api] /matches POST error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Database error",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: error.message }],
    });
  }
});

// 10. PUT /api/sync/matches/:id
router.put("/matches/:id", async (req, res) => {
  const matchId = parsePositiveInt(req.params.id);
  if (!matchId) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid match ID",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: "Invalid match ID" }],
    });
  }

  const body = req.body || {};
  const updates = [];
  const params = [];

  if (body.status !== undefined) {
    const normalizedStatus = normalizeStatus(body.status);
    if (!normalizedStatus || !MATCH_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid status",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: `Invalid status: ${body.status}` }],
      });
    }
    updates.push("status = ?");
    params.push(normalizedStatus);
  }

  const allowList = [
    "match_no",
    "blue_team_id",
    "red_team_id",
    "mode",
    "title",
    "queue_order",
    "blue_score",
    "red_score",
    "series_completed",
    "series_winner_team_id",
    "series_completed_at",
    "tournament_id",
    "tournament_mode_id",
  ];

  for (const field of allowList) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === "title" || field === "mode" || field === "series_completed_at") {
        params.push(body[field]);
      } else if (field === "series_completed") {
        params.push(body[field] === true || body[field] === 1 ? 1 : 0);
      } else {
        params.push(
          body[field] === null
            ? null
            : parsePositiveInt(body[field]) || (body[field] === 0 ? 0 : null)
        );
      }
    }
  }

  const publicMatchId = parsePositiveInt(body.public_match_id || body.match_public_id);
  if (body.public_match_id !== undefined || body.match_public_id !== undefined) {
    updates.push("public_match_id = ?");
    params.push(publicMatchId);
  }

  if (updates.length === 0) {
    return res.json({
      success: true,
      received: 1,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      id: matchId,
      data: { id: matchId },
    });
  }

  updates.push("updated_at = NOW()");
  params.push(matchId);

  try {
    await ensureSyncSchema();
    const [, meta] = await db.query(`UPDATE matches SET ${updates.join(", ")} WHERE id = ?`, params);
    if (meta.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Match not found",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: "Match not found" }],
      });
    }
    console.log(`[sync-api] match updated id=${matchId}`);
    res.json({
      success: true,
      received: 1,
      created: 0,
      updated: 1,
      failed: 0,
      errors: [],
      id: matchId,
      data: { id: matchId },
    });
  } catch (error) {
    console.error("[sync-api] /matches/:id PUT error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Database error",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: error.message }],
    });
  }
});

// 11. POST /api/sync/games
// Resolves match via match_id OR match_public_id/public_match_id.
// Accepts controller statuses: setup, drafting, live, finished, cancelled.
router.post("/games", async (req, res) => {
  const {
    match_id,
    match_public_id,
    public_match_id,
    game_no,
    winner_team_id,
    status,
    finished_at,
    public_game_id,
    game_public_id,
  } = req.body || {};

  const publicMatchId = parsePositiveInt(match_public_id || public_match_id);
  let localMatchId = parsePositiveInt(match_id);
  const gNo = parsePositiveInt(game_no);
  const publicGameId = parsePositiveInt(public_game_id || game_public_id);
  const normalizedStatus = normalizeStatus(status) || "setup";

  if ((!localMatchId && !publicMatchId) || !gNo) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Valid match_id (or match_public_id) and game_no are required",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: "Valid match_id (or match_public_id) and game_no are required" }],
    });
  }

  if (!GAME_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid status",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{
        message: `Invalid status: ${status}. Allowed: ${GAME_STATUSES.join(", ")}`,
      }],
    });
  }

  const connection = await db.getConnection();
  try {
    await ensureSyncSchema(connection);

    if (!localMatchId && publicMatchId) {
      localMatchId = await findMatchIdByPublicId(connection, publicMatchId);
      if (!localMatchId) {
        connection.release();
        return res.status(404).json({
          success: false,
          code: "MATCH_NOT_SYNCED",
          message: `No production match found for public_match_id ${publicMatchId}. Sync matches first.`,
          received: 1,
          created: 0,
          updated: 0,
          failed: 1,
          errors: [{ public_match_id: publicMatchId, message: "Match not found by public_match_id" }],
        });
      }
    }

    const [matchRows] = await connection.query(
      `SELECT id, blue_team_id, red_team_id, public_match_id FROM matches WHERE id = ?`,
      [localMatchId]
    );
    if (matchRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Match not found",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ match_id: localMatchId, message: "Match not found" }],
      });
    }
    const match = matchRows[0];

    // Optional: if caller also sent public_match_id, ensure it matches the row
    if (publicMatchId && match.public_match_id && Number(match.public_match_id) !== publicMatchId) {
      connection.release();
      return res.status(400).json({
        success: false,
        code: "CONTEXT_MISMATCH",
        message: "match_id does not match the given public_match_id",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: "match_id does not match the given public_match_id" }],
      });
    }

    const wId = parsePositiveInt(winner_team_id);
    if (wId) {
      if (match.blue_team_id && match.red_team_id) {
        if (wId !== match.blue_team_id && wId !== match.red_team_id) {
          connection.release();
          return res.status(400).json({
            success: false,
            code: "VALIDATION_ERROR",
            message: "Winner must be one of the match teams",
            received: 1,
            created: 0,
            updated: 0,
            failed: 1,
            errors: [{ message: "Winner must be one of the match teams" }],
          });
        }
      } else {
        const [teamRows] = await connection.query(`SELECT id FROM teams WHERE id = ?`, [wId]);
        if (teamRows.length === 0) {
          connection.release();
          return res.status(400).json({
            success: false,
            code: "VALIDATION_ERROR",
            message: "Winner team does not exist",
            received: 1,
            created: 0,
            updated: 0,
            failed: 1,
            errors: [{ message: "Winner team does not exist" }],
          });
        }
      }
    }

    await connection.beginTransaction();

    // Prefer existing row by public_game_id, else by (match_id, game_no)
    let existingId = null;
    if (publicGameId) {
      const [byPublic] = await connection.query(
        `SELECT id FROM games WHERE public_game_id = ? LIMIT 1`,
        [publicGameId]
      );
      if (byPublic[0]) existingId = byPublic[0].id;
    }
    if (!existingId) {
      const [byPair] = await connection.query(
        `SELECT id FROM games WHERE match_id = ? AND game_no = ? LIMIT 1`,
        [localMatchId, gNo]
      );
      if (byPair[0]) existingId = byPair[0].id;
    }

    let gameId;
    let created = 0;
    let updated = 0;

    if (existingId) {
      await connection.query(
        `UPDATE games SET
          match_id = ?, game_no = ?, winner_team_id = ?, status = ?,
          finished_at = ?, public_game_id = COALESCE(?, public_game_id), updated_at = NOW()
         WHERE id = ?`,
        [localMatchId, gNo, wId || null, normalizedStatus, finished_at || null, publicGameId, existingId]
      );
      gameId = existingId;
      updated = 1;
    } else {
      const insertSql = `
        INSERT INTO games (match_id, game_no, winner_team_id, status, finished_at, public_game_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const [result, meta] = await connection.query(insertSql, [
        localMatchId,
        gNo,
        wId || null,
        normalizedStatus,
        finished_at || null,
        publicGameId,
      ]);
      gameId = getInsertId(result, meta);
      created = 1;
    }

    await connection.commit();
    connection.release();

    console.log(
      `[sync-api] game ${updated ? "updated" : "created"} id=${gameId} match=${localMatchId} no=${gNo} status=${normalizedStatus}`
    );
    res.json({
      success: true,
      received: 1,
      created,
      updated,
      failed: 0,
      errors: [],
      id: gameId,
      match_id: localMatchId,
      public_match_id: publicMatchId || match.public_match_id || null,
      data: { id: gameId, match_id: localMatchId },
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      /* ignore */
    }
    try {
      connection.release();
    } catch (_) {
      /* ignore */
    }
    console.error("[sync-api] /games POST error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Database error",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: error.message }],
    });
  }
});

// 12. PUT /api/sync/games/:id
router.put("/games/:id", async (req, res) => {
  const gameId = parsePositiveInt(req.params.id);
  if (!gameId) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid game ID",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: "Invalid game ID" }],
    });
  }

  const body = req.body || {};
  const updates = [];
  const params = [];

  if (body.status !== undefined) {
    const normalizedStatus = normalizeStatus(body.status);
    if (!normalizedStatus || !GAME_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid status",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: `Invalid status: ${body.status}. Allowed: ${GAME_STATUSES.join(", ")}` }],
      });
    }
    updates.push("status = ?");
    params.push(normalizedStatus);
  }

  if (body.game_no !== undefined) {
    updates.push("game_no = ?");
    params.push(parsePositiveInt(body.game_no) || null);
  }
  if (body.winner_team_id !== undefined) {
    updates.push("winner_team_id = ?");
    params.push(parsePositiveInt(body.winner_team_id) || null);
  }
  if (body.finished_at !== undefined) {
    updates.push("finished_at = ?");
    params.push(body.finished_at);
  }
  if (body.public_game_id !== undefined || body.game_public_id !== undefined) {
    updates.push("public_game_id = ?");
    params.push(parsePositiveInt(body.public_game_id || body.game_public_id) || null);
  }

  if (updates.length === 0) {
    return res.json({
      success: true,
      received: 1,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      id: gameId,
      data: { id: gameId },
    });
  }

  updates.push("updated_at = NOW()");
  params.push(gameId);

  try {
    await ensureSyncSchema();
    const [, meta] = await db.query(`UPDATE games SET ${updates.join(", ")} WHERE id = ?`, params);
    if (meta.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Game not found",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: "Game not found" }],
      });
    }
    console.log(`[sync-api] game updated id=${gameId}`);
    res.json({
      success: true,
      received: 1,
      created: 0,
      updated: 1,
      failed: 0,
      errors: [],
      id: gameId,
      data: { id: gameId },
    });
  } catch (error) {
    if (
      error.code === "ER_DUP_ENTRY" ||
      (error.message && (error.message.includes("unique constraint") || error.message.includes("Duplicate entry")))
    ) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_GAME",
        message: "Game already exists for this match and number",
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: "Duplicate game" }],
      });
    }
    console.error("[sync-api] /games/:id PUT error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Database error",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: error.message }],
    });
  }
});

// 12b. POST /api/sync/brackets
// Upserts brackets + rounds + nodes using public_* IDs from Controller.
router.post("/brackets", async (req, res) => {
  const body = req.body || {};
  const tournamentId = parsePositiveInt(body.tournament_id);
  const tournamentModeId = parsePositiveInt(body.tournament_mode_id);

  const brackets = Array.isArray(body.brackets) ? body.brackets : body.bracket ? [body.bracket] : [];
  const rounds = Array.isArray(body.bracket_rounds) ? body.bracket_rounds : Array.isArray(body.rounds) ? body.rounds : [];
  const nodes = Array.isArray(body.bracket_nodes) ? body.bracket_nodes : Array.isArray(body.nodes) ? body.nodes : [];

  const received = brackets.length + rounds.length + nodes.length;
  const stats = emptySyncStats(received);

  if (!tournamentId || !tournamentModeId) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Valid tournament_id and tournament_mode_id are required",
      received,
      created: 0,
      updated: 0,
      failed: received || 1,
      errors: [{ message: "Valid tournament_id and tournament_mode_id are required" }],
    });
  }

  if (received === 0) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Provide brackets, bracket_rounds, and/or bracket_nodes arrays",
      received: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ message: "Empty payload" }],
    });
  }

  const connection = await db.getConnection();
  // Maps public IDs → local IDs for linking
  const bracketIdByPublic = new Map();
  const roundIdByPublic = new Map();
  const nodeIdByPublic = new Map();

  try {
    await ensureSyncSchema(connection);

    const [modeRows] = await connection.query(
      `SELECT id FROM tournament_modes WHERE id = ? AND tournament_id = ?`,
      [tournamentModeId, tournamentId]
    );
    if (modeRows.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        code: "CONTEXT_MISMATCH",
        message: "tournament_mode_id does not belong to tournament_id",
        received,
        created: 0,
        updated: 0,
        failed: received,
        errors: [{ message: "tournament_mode_id does not belong to tournament_id" }],
      });
    }

    await connection.beginTransaction();

    // 1) Brackets
    for (const item of brackets) {
      try {
        const publicBracketId = parsePositiveInt(item.public_bracket_id || item.id);
        const name = (item.name && String(item.name).trim()) || "Bracket";
        const bracketType = item.bracket_type || item.type || "single_elimination";
        const status = normalizeStatus(item.status) || "active";

        let existingId = null;
        if (publicBracketId) {
          const [found] = await connection.query(
            `SELECT id FROM brackets WHERE public_bracket_id = ? LIMIT 1`,
            [publicBracketId]
          );
          if (found[0]) existingId = found[0].id;
        }

        if (existingId) {
          await connection.query(
            `UPDATE brackets SET
              tournament_id = ?, tournament_mode_id = ?, name = ?, bracket_type = ?,
              status = ?, public_bracket_id = ?, updated_at = NOW()
             WHERE id = ?`,
            [tournamentId, tournamentModeId, name, bracketType, status, publicBracketId, existingId]
          );
          stats.updated += 1;
          if (publicBracketId) bracketIdByPublic.set(publicBracketId, existingId);
        } else {
          const [result, meta] = await connection.query(
            `INSERT INTO brackets (
              public_bracket_id, tournament_id, tournament_mode_id, name, bracket_type, status
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [publicBracketId, tournamentId, tournamentModeId, name, bracketType, status]
          );
          const newId = getInsertId(result, meta);
          stats.created += 1;
          if (publicBracketId) bracketIdByPublic.set(publicBracketId, newId);
        }
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          entity: "bracket",
          public_bracket_id: item.public_bracket_id || item.id || null,
          message: err.message,
        });
      }
    }

    // 2) Rounds
    for (const item of rounds) {
      try {
        const publicRoundId = parsePositiveInt(item.public_round_id || item.id);
        const publicBracketId = parsePositiveInt(item.public_bracket_id || item.bracket_public_id);
        let bracketId =
          parsePositiveInt(item.bracket_id) ||
          (publicBracketId ? bracketIdByPublic.get(publicBracketId) : null);

        if (!bracketId && publicBracketId) {
          const [found] = await connection.query(
            `SELECT id FROM brackets WHERE public_bracket_id = ? LIMIT 1`,
            [publicBracketId]
          );
          if (found[0]) {
            bracketId = found[0].id;
            bracketIdByPublic.set(publicBracketId, bracketId);
          }
        }

        if (!bracketId) {
          throw new Error("bracket_id / public_bracket_id not found for round");
        }

        const name = item.name != null ? String(item.name) : null;
        const roundNumber = parsePositiveInt(item.round_number || item.round_no) || 1;
        const sortOrder = parseNonNegInt(item.sort_order, roundNumber) ?? roundNumber;

        let existingId = null;
        if (publicRoundId) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_rounds WHERE public_round_id = ? LIMIT 1`,
            [publicRoundId]
          );
          if (found[0]) existingId = found[0].id;
        }

        if (existingId) {
          await connection.query(
            `UPDATE bracket_rounds SET
              bracket_id = ?, public_bracket_id = ?, public_round_id = ?,
              name = ?, round_number = ?, sort_order = ?, updated_at = NOW()
             WHERE id = ?`,
            [bracketId, publicBracketId, publicRoundId, name, roundNumber, sortOrder, existingId]
          );
          stats.updated += 1;
          if (publicRoundId) roundIdByPublic.set(publicRoundId, existingId);
        } else {
          const [result, meta] = await connection.query(
            `INSERT INTO bracket_rounds (
              public_round_id, bracket_id, public_bracket_id, name, round_number, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [publicRoundId, bracketId, publicBracketId, name, roundNumber, sortOrder]
          );
          const newId = getInsertId(result, meta);
          stats.created += 1;
          if (publicRoundId) roundIdByPublic.set(publicRoundId, newId);
        }
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          entity: "bracket_round",
          public_round_id: item.public_round_id || item.id || null,
          message: err.message,
        });
      }
    }

    // 3) Nodes
    for (const item of nodes) {
      try {
        const publicNodeId = parsePositiveInt(item.public_node_id || item.id);
        const publicBracketId = parsePositiveInt(item.public_bracket_id || item.bracket_public_id);
        const publicRoundId = parsePositiveInt(item.public_round_id || item.round_public_id);
        const publicMatchId = parsePositiveInt(item.public_match_id || item.match_public_id);
        const nextPublicNodeId = parsePositiveInt(item.next_public_node_id || item.next_node_public_id);

        let bracketId =
          parsePositiveInt(item.bracket_id) ||
          (publicBracketId ? bracketIdByPublic.get(publicBracketId) : null);
        if (!bracketId && publicBracketId) {
          const [found] = await connection.query(
            `SELECT id FROM brackets WHERE public_bracket_id = ? LIMIT 1`,
            [publicBracketId]
          );
          if (found[0]) {
            bracketId = found[0].id;
            bracketIdByPublic.set(publicBracketId, bracketId);
          }
        }
        if (!bracketId) {
          throw new Error("bracket_id / public_bracket_id not found for node");
        }

        let roundId =
          parsePositiveInt(item.round_id) ||
          (publicRoundId ? roundIdByPublic.get(publicRoundId) : null);
        if (!roundId && publicRoundId) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_rounds WHERE public_round_id = ? LIMIT 1`,
            [publicRoundId]
          );
          if (found[0]) {
            roundId = found[0].id;
            roundIdByPublic.set(publicRoundId, roundId);
          }
        }

        let matchId = parsePositiveInt(item.match_id) || null;
        if (!matchId && publicMatchId) {
          matchId = await findMatchIdByPublicId(connection, publicMatchId);
        }

        const position = parseNonNegInt(item.position ?? item.slot_index, 0) ?? 0;
        const blueTeamId = parsePositiveInt(
          item.blue_team_id || item.slot_a_team_id || item.team_a_id
        );
        const redTeamId = parsePositiveInt(
          item.red_team_id || item.slot_b_team_id || item.team_b_id
        );
        const winnerTeamId = parsePositiveInt(item.winner_team_id);
        const status = normalizeStatus(item.status) || "pending";

        let existingId = null;
        if (publicNodeId) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_nodes WHERE public_node_id = ? LIMIT 1`,
            [publicNodeId]
          );
          if (found[0]) existingId = found[0].id;
        }

        if (existingId) {
          await connection.query(
            `UPDATE bracket_nodes SET
              bracket_id = ?, round_id = ?, public_bracket_id = ?, public_round_id = ?,
              public_node_id = ?, public_match_id = ?, match_id = ?, position = ?,
              blue_team_id = ?, red_team_id = ?, winner_team_id = ?,
              next_public_node_id = ?, status = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              bracketId,
              roundId,
              publicBracketId,
              publicRoundId,
              publicNodeId,
              publicMatchId,
              matchId,
              position,
              blueTeamId,
              redTeamId,
              winnerTeamId,
              nextPublicNodeId,
              status,
              existingId,
            ]
          );
          stats.updated += 1;
          if (publicNodeId) nodeIdByPublic.set(publicNodeId, existingId);
        } else {
          const [result, meta] = await connection.query(
            `INSERT INTO bracket_nodes (
              public_node_id, bracket_id, round_id, public_bracket_id, public_round_id,
              public_match_id, match_id, position, blue_team_id, red_team_id,
              winner_team_id, next_public_node_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              publicNodeId,
              bracketId,
              roundId,
              publicBracketId,
              publicRoundId,
              publicMatchId,
              matchId,
              position,
              blueTeamId,
              redTeamId,
              winnerTeamId,
              nextPublicNodeId,
              status,
            ]
          );
          const newId = getInsertId(result, meta);
          stats.created += 1;
          if (publicNodeId) nodeIdByPublic.set(publicNodeId, newId);
        }
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          entity: "bracket_node",
          public_node_id: item.public_node_id || item.id || null,
          message: err.message,
        });
      }
    }

    // Resolve next_node_id from next_public_node_id where possible
    if (nodeIdByPublic.size > 0) {
      for (const [, localNodeId] of nodeIdByPublic.entries()) {
        const [rows] = await connection.query(
          `SELECT next_public_node_id FROM bracket_nodes WHERE id = ?`,
          [localNodeId]
        );
        const nextPublic = rows[0]?.next_public_node_id
          ? Number(rows[0].next_public_node_id)
          : null;
        if (!nextPublic) continue;

        let nextLocal = nodeIdByPublic.get(nextPublic) || null;
        if (!nextLocal) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_nodes WHERE public_node_id = ? LIMIT 1`,
            [nextPublic]
          );
          nextLocal = found[0]?.id || null;
        }

        if (nextLocal) {
          await connection.query(
            `UPDATE bracket_nodes SET next_node_id = ?, updated_at = NOW() WHERE id = ?`,
            [nextLocal, localNodeId]
          );
        }
      }
    }

    await connection.commit();
    connection.release();

    stats.success = stats.failed === 0;
    console.log(
      `[sync-api] brackets sync received=${stats.received} created=${stats.created} updated=${stats.updated} failed=${stats.failed}`
    );
    res.status(stats.failed && stats.created + stats.updated === 0 ? 400 : 200).json(stats);
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      /* ignore */
    }
    try {
      connection.release();
    } catch (_) {
      /* ignore */
    }
    console.error("[sync-api] /brackets POST error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Database error",
      received,
      created: 0,
      updated: 0,
      failed: received || 1,
      errors: [{ message: error.message }],
    });
  }
});

// 13. POST /api/sync/standings/br
// Controller pushes BR group standings (production public IDs already mapped).
router.post("/standings/br", async (req, res) => {
  const { tournament_id, tournament_mode_id, groups } = req.body || {};

  const tId = parsePositiveInt(tournament_id);
  const mId = parsePositiveInt(tournament_mode_id);

  if (!tId || !mId) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Valid tournament_id and tournament_mode_id are required",
    });
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "groups must be a non-empty array",
    });
  }

  // Flatten + validate payload before DB writes
  const rows = [];
  for (const group of groups) {
    const groupName = group && typeof group.group_name === "string" ? group.group_name.trim() : "";
    if (!groupName) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Each group requires a non-empty group_name",
      });
    }

    const standings = group.standings;
    if (!Array.isArray(standings)) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: `Group "${groupName}" must include a standings array`,
      });
    }

    for (const s of standings) {
      const teamId = parsePositiveInt(s && s.team_id);
      if (!teamId) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: `Invalid team_id in group "${groupName}"`,
        });
      }

      const kills = parseNonNegInt(s.kills, 0);
      const placementPoints = parseNonNegInt(s.placement_points, 0);
      const killPoints = parseNonNegInt(s.kill_points, 0);
      const totalPoints = parseNonNegInt(s.total_points, 0);
      const roundsPlayed = parseNonNegInt(s.rounds_played, 0);

      if (
        kills === null ||
        placementPoints === null ||
        killPoints === null ||
        totalPoints === null ||
        roundsPlayed === null
      ) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: `Invalid numeric fields for team_id ${teamId} in group "${groupName}"`,
        });
      }

      let finalRank = null;
      if (s.final_rank !== undefined && s.final_rank !== null && s.final_rank !== "") {
        const asNum = Number(s.final_rank);
        if (!Number.isInteger(asNum) || asNum < 1) {
          return res.status(400).json({
            success: false,
            code: "VALIDATION_ERROR",
            message: `Invalid final_rank for team_id ${teamId} in group "${groupName}"`,
          });
        }
        finalRank = asNum;
      }

      rows.push({
        tournament_id: tId,
        tournament_mode_id: mId,
        group_name: groupName,
        team_id: teamId,
        kills,
        placement_points: placementPoints,
        kill_points: killPoints,
        total_points: totalPoints,
        final_rank: finalRank,
        rounds_played: roundsPlayed,
        is_eliminated: toBool(s.is_eliminated),
      });
    }
  }

  const connection = await db.getConnection();
  try {
    // Validate tournament exists
    const [tournamentRows] = await connection.query(`SELECT id FROM tournaments WHERE id = ?`, [tId]);
    if (tournamentRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: `tournament_id ${tId} does not exist`,
      });
    }

    // Validate tournament_mode exists and belongs to the tournament
    const [modeRows] = await connection.query(
      `SELECT id FROM tournament_modes WHERE id = ? AND tournament_id = ?`,
      [mId, tId]
    );
    if (modeRows.length === 0) {
      const [modeExists] = await connection.query(`SELECT id, tournament_id FROM tournament_modes WHERE id = ?`, [mId]);
      connection.release();
      if (modeExists.length === 0) {
        return res.status(404).json({
          success: false,
          code: "NOT_FOUND",
          message: `tournament_mode_id ${mId} does not exist`,
        });
      }
      return res.status(400).json({
        success: false,
        code: "CONTEXT_MISMATCH",
        message: "tournament_mode_id does not belong to the given tournament_id",
      });
    }

    await connection.beginTransaction();
    const upsertSql = buildBrStandingsUpsertSql();
    let processed = 0;

    for (const row of rows) {
      const eliminatedParam = db.client === "postgres" ? row.is_eliminated : row.is_eliminated ? 1 : 0;
      await connection.query(upsertSql, [
        row.tournament_id,
        row.tournament_mode_id,
        row.group_name,
        row.team_id,
        row.kills,
        row.placement_points,
        row.kill_points,
        row.total_points,
        row.final_rank,
        row.rounds_played,
        eliminatedParam,
      ]);
      processed += 1;
    }

    await connection.commit();
    connection.release();

    console.log(`[sync-api] standings/br processed=${processed} tournament=${tId} mode=${mId}`);
    res.json({
      success: true,
      message: "BR group standings synced",
      processed,
      upserted: processed,
      tournament_id: tId,
      tournament_mode_id: mId,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      /* ignore */
    }
    try {
      connection.release();
    } catch (_) {
      /* ignore */
    }
    console.error("[sync-api] /standings/br POST error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 14. GET /api/sync/standings/br?tournament_id=xx&tournament_mode_id=xx
// Fetch BR group standings (grouped, sorted by total_points DESC).
router.get("/standings/br", async (req, res) => {
  const tId = parsePositiveInt(req.query.tournament_id);
  const mId = parsePositiveInt(req.query.tournament_mode_id);

  if (!tId || !mId) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Valid tournament_id and tournament_mode_id query params are required",
    });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        s.id,
        s.tournament_id,
        s.tournament_mode_id,
        s.group_name,
        s.team_id,
        s.kills,
        s.placement_points,
        s.kill_points,
        s.total_points,
        s.final_rank,
        s.rounds_played,
        s.is_eliminated,
        s.eliminated_at,
        s.updated_at,
        t.name AS team_name,
        t.shortname AS team_shortname,
        t.logo AS team_logo
      FROM br_group_standings s
      LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.tournament_id = ? AND s.tournament_mode_id = ?
      ORDER BY s.group_name ASC, s.total_points DESC, s.kills DESC, s.final_rank ASC, s.team_id ASC
      `,
      [tId, mId]
    );

    const groupMap = new Map();
    for (const row of rows) {
      const key = row.group_name;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          group_name: key,
          standings: [],
        });
      }

      groupMap.get(key).standings.push({
        id: row.id,
        team_id: row.team_id,
        team_name: row.team_name || null,
        team_shortname: row.team_shortname || null,
        team_logo: row.team_logo || null,
        kills: row.kills ?? 0,
        placement_points: row.placement_points ?? 0,
        kill_points: row.kill_points ?? 0,
        total_points: row.total_points ?? 0,
        final_rank: row.final_rank,
        rounds_played: row.rounds_played ?? 0,
        is_eliminated: toBool(row.is_eliminated),
        eliminated_at: row.eliminated_at || null,
        updated_at: row.updated_at || null,
      });
    }

    res.json({
      success: true,
      tournament_id: tId,
      tournament_mode_id: mId,
      processed: rows.length,
      groups: Array.from(groupMap.values()),
    });
  } catch (error) {
    console.error("[sync-api] /standings/br GET error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

module.exports = router;
