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

/**
 * Resolve production match for Controller payloads.
 * Controller sends match_id = production match id (stored as public_match_id on controller).
 * After table clears, that value may still be the intended production id — try id first, then public_match_id.
 */
async function findMatchForSync(connection, matchRef) {
  const id = parsePositiveInt(matchRef);
  if (!id) return null;

  const [byId] = await connection.query(
    `SELECT id, blue_team_id, red_team_id, public_match_id FROM matches WHERE id = ? LIMIT 1`,
    [id]
  );
  if (byId[0]) return byId[0];

  const [byPublic] = await connection.query(
    `SELECT id, blue_team_id, red_team_id, public_match_id FROM matches WHERE public_match_id = ? LIMIT 1`,
    [id]
  );
  return byPublic[0] || null;
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
      // Controller stores response.id as public_match_id — also store on row for reverse lookup
      if (matchId && !matchFields.public_match_id) {
        await connection.query(`UPDATE matches SET public_match_id = ? WHERE id = ?`, [matchId, matchId]);
      }
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
// Controller uses :id = previously stored production match id (public_match_id on controller).
// After production matches are wiped, recreate the row with the same id so mapping stays valid.
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
  }

  const fields = {
    match_no: parsePositiveInt(body.match_no) || 1,
    blue_team_id: body.blue_team_id === undefined ? null : parsePositiveInt(body.blue_team_id) || null,
    red_team_id: body.red_team_id === undefined ? null : parsePositiveInt(body.red_team_id) || null,
    mode: body.mode || "BO3",
    title: body.title || "Match",
    queue_order: parsePositiveInt(body.queue_order) || 1,
    blue_score: parseNonNegInt(body.blue_score, 0) ?? 0,
    red_score: parseNonNegInt(body.red_score, 0) ?? 0,
    status: normalizeStatus(body.status) || "queued",
    series_completed: body.series_completed === true || body.series_completed === 1 ? 1 : 0,
    series_winner_team_id:
      body.series_winner_team_id === undefined
        ? null
        : parsePositiveInt(body.series_winner_team_id) || null,
    series_completed_at: body.series_completed_at || null,
    tournament_id: parsePositiveInt(body.tournament_id) || null,
    tournament_mode_id: parsePositiveInt(body.tournament_mode_id) || null,
    public_match_id:
      parsePositiveInt(body.public_match_id || body.match_public_id) || matchId,
  };

  try {
    await ensureSyncSchema();

    const [existing] = await db.query(`SELECT id FROM matches WHERE id = ? LIMIT 1`, [matchId]);

    if (existing.length > 0) {
      await db.query(
        `UPDATE matches SET
          match_no = ?, blue_team_id = ?, red_team_id = ?, mode = ?, title = ?,
          queue_order = ?, blue_score = ?, red_score = ?, status = ?,
          series_completed = ?, series_winner_team_id = ?, series_completed_at = ?,
          tournament_id = ?, tournament_mode_id = ?,
          public_match_id = COALESCE(?, public_match_id),
          updated_at = NOW()
         WHERE id = ?`,
        [
          fields.match_no,
          fields.blue_team_id,
          fields.red_team_id,
          fields.mode,
          fields.title,
          fields.queue_order,
          fields.blue_score,
          fields.red_score,
          fields.status,
          fields.series_completed,
          fields.series_winner_team_id,
          fields.series_completed_at,
          fields.tournament_id,
          fields.tournament_mode_id,
          fields.public_match_id,
          matchId,
        ]
      );
      console.log(`[sync-api] match updated id=${matchId}`);
      return res.json({
        success: true,
        received: 1,
        created: 0,
        updated: 1,
        failed: 0,
        errors: [],
        id: matchId,
        data: { id: matchId },
      });
    }

    // Recreate deleted match with the same production id (Controller mapping depends on it)
    await db.query(
      `INSERT INTO matches (
        id, match_no, blue_team_id, red_team_id, mode, title, queue_order,
        blue_score, red_score, status, series_completed, series_winner_team_id,
        series_completed_at, tournament_id, tournament_mode_id, public_match_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matchId,
        fields.match_no,
        fields.blue_team_id,
        fields.red_team_id,
        fields.mode,
        fields.title,
        fields.queue_order,
        fields.blue_score,
        fields.red_score,
        fields.status,
        fields.series_completed,
        fields.series_winner_team_id,
        fields.series_completed_at,
        fields.tournament_id,
        fields.tournament_mode_id,
        fields.public_match_id,
      ]
    );

    // Keep serial sequence ahead of explicit ids (Postgres)
    if (db.client === "postgres") {
      try {
        await db.query(
          `SELECT setval(pg_get_serial_sequence('matches', 'id'), GREATEST((SELECT MAX(id) FROM matches), ?))`,
          [matchId]
        );
      } catch (_) {
        /* ignore */
      }
    }

    console.log(`[sync-api] match recreated id=${matchId} (was missing after wipe)`);
    res.json({
      success: true,
      received: 1,
      created: 1,
      updated: 0,
      failed: 0,
      errors: [],
      id: matchId,
      recreated: true,
      data: { id: matchId },
    });
  } catch (error) {
    console.error("[sync-api] /matches/:id PUT error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: error.message || "Database error",
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

    // Controller sends match_id = production match id (same value stored as public_match_id on controller)
    let match = null;
    if (localMatchId) {
      match = await findMatchForSync(connection, localMatchId);
    }
    if (!match && publicMatchId) {
      match = await findMatchForSync(connection, publicMatchId);
    }
    if (!match && publicMatchId) {
      const byPublicOnly = await findMatchIdByPublicId(connection, publicMatchId);
      if (byPublicOnly) {
        match = await findMatchForSync(connection, byPublicOnly);
      }
    }

    if (!match) {
      connection.release();
      return res.status(404).json({
        success: false,
        code: "MATCH_NOT_SYNCED",
        message: `No production match found for match_id=${localMatchId || "n/a"} public_match_id=${publicMatchId || "n/a"}. Push matches first (or re-push after wiping matches).`,
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [
          {
            match_id: localMatchId,
            public_match_id: publicMatchId,
            message: "Match not found by id or public_match_id",
          },
        ],
      });
    }

    localMatchId = match.id;

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
// Controller uses :id = previously stored production game id (public_game_id on controller).
// After games/matches wipe, recreate instead of 404 (Controller treats 404 as "endpoint not found").
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
  const normalizedStatus = body.status !== undefined ? normalizeStatus(body.status) : null;

  if (body.status !== undefined && (!normalizedStatus || !GAME_STATUSES.includes(normalizedStatus))) {
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

  try {
    await ensureSyncSchema();

    // Prefer lookup by primary id, then by public_game_id
    let [existing] = await db.query(`SELECT id, match_id FROM games WHERE id = ? LIMIT 1`, [gameId]);
    if (!existing[0]) {
      const [byPublic] = await db.query(
        `SELECT id, match_id FROM games WHERE public_game_id = ? LIMIT 1`,
        [gameId]
      );
      existing = byPublic;
    }

    if (existing[0]) {
      const targetId = existing[0].id;
      const updates = [];
      const params = [];

      if (normalizedStatus) {
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
      // Keep public_game_id pointing at controller's known production id
      updates.push("public_game_id = COALESCE(public_game_id, ?)");
      params.push(gameId);

      if (body.match_id !== undefined || body.public_match_id !== undefined || body.match_public_id !== undefined) {
        const matchRef = body.match_id || body.public_match_id || body.match_public_id;
        const match = await findMatchForSync(db, matchRef);
        if (match) {
          updates.push("match_id = ?");
          params.push(match.id);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = NOW()");
        params.push(targetId);
        await db.query(`UPDATE games SET ${updates.join(", ")} WHERE id = ?`, params);
      }

      console.log(`[sync-api] game updated id=${targetId}`);
      return res.json({
        success: true,
        received: 1,
        created: 0,
        updated: 1,
        failed: 0,
        errors: [],
        id: targetId,
        data: { id: targetId },
      });
    }

    // Recreate missing game (table wipe / deleted row)
    const matchRef = body.match_id || body.public_match_id || body.match_public_id;
    const match = matchRef ? await findMatchForSync(db, matchRef) : null;
    if (!match) {
      // Soft 200-style recovery path is not possible without match; still avoid bare 404 wording
      return res.status(404).json({
        success: false,
        code: "MATCH_NOT_SYNCED",
        message: `Game ${gameId} not found and match_id=${matchRef || "missing"} is not on production. Push matches first, then games.`,
        received: 1,
        created: 0,
        updated: 0,
        failed: 1,
        errors: [{ message: "Cannot recreate game without a synced match" }],
      });
    }

    const gNo = parsePositiveInt(body.game_no) || 1;
    const status = normalizedStatus || "setup";
    const wId = parsePositiveInt(body.winner_team_id) || null;
    const finishedAt = body.finished_at || null;

    // Prefer explicit id so Controller public_game_id stays valid
    try {
      await db.query(
        `INSERT INTO games (id, match_id, game_no, winner_team_id, status, finished_at, public_game_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [gameId, match.id, gNo, wId, status, finishedAt, gameId]
      );
      if (db.client === "postgres") {
        try {
          await db.query(
            `SELECT setval(pg_get_serial_sequence('games', 'id'), GREATEST((SELECT MAX(id) FROM games), ?))`,
            [gameId]
          );
        } catch (_) {
          /* ignore */
        }
      }
      console.log(`[sync-api] game recreated id=${gameId} match=${match.id}`);
      return res.json({
        success: true,
        received: 1,
        created: 1,
        updated: 0,
        failed: 0,
        errors: [],
        id: gameId,
        recreated: true,
        data: { id: gameId },
      });
    } catch (insertErr) {
      // Fallback: upsert by match_id + game_no
      const result = await upsertGameForMatch(db, match.id, {
        game_no: gNo,
        status,
        winner_team_id: wId,
        finished_at: finishedAt,
        public_game_id: gameId,
      });
      if (result.error) throw new Error(result.error);
      console.log(`[sync-api] game upserted after recreate-fail id=${result.id} match=${match.id}`);
      return res.json({
        success: true,
        received: 1,
        created: result.created,
        updated: result.updated,
        failed: 0,
        errors: [],
        id: result.id,
        data: { id: result.id },
      });
    }
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
      message: error.message || "Database error",
      received: 1,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: error.message }],
    });
  }
});

/**
 * Upsert a single game for a resolved local match.
 * @returns {{ created: number, updated: number, id: number|null, error?: string }}
 */
async function upsertGameForMatch(connection, localMatchId, gamePayload = {}) {
  const gNo = parsePositiveInt(gamePayload.game_no ?? gamePayload.gameNo ?? gamePayload.number);
  if (!gNo) {
    return { created: 0, updated: 0, id: null, error: "game_no is required" };
  }

  const normalizedStatus = normalizeStatus(gamePayload.status) || "setup";
  if (!GAME_STATUSES.includes(normalizedStatus)) {
    return {
      created: 0,
      updated: 0,
      id: null,
      error: `Invalid status: ${gamePayload.status}. Allowed: ${GAME_STATUSES.join(", ")}`,
    };
  }

  const publicGameId = parsePositiveInt(
    gamePayload.public_game_id || gamePayload.game_public_id || gamePayload.publicGameId || gamePayload.id
  );
  const wId = parsePositiveInt(gamePayload.winner_team_id || gamePayload.winnerTeamId);
  const finishedAt = gamePayload.finished_at || gamePayload.finishedAt || null;

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

  if (existingId) {
    await connection.query(
      `UPDATE games SET
        match_id = ?, game_no = ?, winner_team_id = ?, status = ?,
        finished_at = ?, public_game_id = COALESCE(?, public_game_id), updated_at = NOW()
       WHERE id = ?`,
      [localMatchId, gNo, wId || null, normalizedStatus, finishedAt, publicGameId, existingId]
    );
    return { created: 0, updated: 1, id: existingId };
  }

  const [result, meta] = await connection.query(
    `INSERT INTO games (match_id, game_no, winner_team_id, status, finished_at, public_game_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [localMatchId, gNo, wId || null, normalizedStatus, finishedAt, publicGameId]
  );
  return { created: 1, updated: 0, id: getInsertId(result, meta) };
}

/**
 * Resolve local match id from path/body. Optionally re-create match if deleted.
 * Path id is treated as public_match_id first, then local id.
 */
async function resolveOrCreateMatchForGames(connection, pathId, body = {}) {
  const bodyPublicMatchId = parsePositiveInt(
    body.public_match_id || body.match_public_id || body.publicMatchId || body.match?.public_match_id
  );
  const bodyLocalMatchId = parsePositiveInt(body.match_id || body.matchId || body.match?.id);
  const pathAsInt = parsePositiveInt(pathId);

  // Prefer explicit public ids
  let publicMatchId = bodyPublicMatchId || pathAsInt;
  let localMatchId = bodyLocalMatchId;

  if (!localMatchId && publicMatchId) {
    localMatchId = await findMatchIdByPublicId(connection, publicMatchId);
  }

  // Path might be local id if not found as public
  if (!localMatchId && pathAsInt) {
    const [byLocal] = await connection.query(`SELECT id, public_match_id FROM matches WHERE id = ? LIMIT 1`, [
      pathAsInt,
    ]);
    if (byLocal[0]) {
      localMatchId = byLocal[0].id;
      if (!publicMatchId && byLocal[0].public_match_id) {
        publicMatchId = Number(byLocal[0].public_match_id);
      }
    }
  }

  // Re-create match shell if deleted but Controller still pushes games
  if (!localMatchId) {
    const matchSource = body.match && typeof body.match === "object" ? body.match : body;
    const tournamentId = parsePositiveInt(
      matchSource.tournament_id || matchSource.public_tournament_id || body.tournament_id
    );
    const tournamentModeId = parsePositiveInt(
      matchSource.tournament_mode_id || matchSource.public_tournament_mode_id || body.tournament_mode_id
    );

    // Minimal insert so games have a parent row
    const insertSql = `
      INSERT INTO matches (
        match_no, blue_team_id, red_team_id, mode, title, queue_order,
        blue_score, red_score, status, series_completed, series_winner_team_id,
        series_completed_at, tournament_id, tournament_mode_id, public_match_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      parsePositiveInt(matchSource.match_no || matchSource.matchNo) || 1,
      parsePositiveInt(matchSource.blue_team_id || matchSource.blueTeamId) || null,
      parsePositiveInt(matchSource.red_team_id || matchSource.redTeamId) || null,
      matchSource.mode || "BO3",
      matchSource.title || "Match",
      parsePositiveInt(matchSource.queue_order || matchSource.queueOrder) || 1,
      parseNonNegInt(matchSource.blue_score ?? matchSource.blueScore, 0) ?? 0,
      parseNonNegInt(matchSource.red_score ?? matchSource.redScore, 0) ?? 0,
      normalizeStatus(matchSource.status) || "queued",
      matchSource.series_completed === true || matchSource.series_completed === 1 ? 1 : 0,
      parsePositiveInt(matchSource.series_winner_team_id || matchSource.seriesWinnerTeamId) || null,
      matchSource.series_completed_at || matchSource.seriesCompletedAt || null,
      tournamentId,
      tournamentModeId,
      publicMatchId || pathAsInt || null,
    ];

    // tournament_id/mode can be null in schema — still create row so games attach
    const [result, meta] = await connection.query(insertSql, params);
    localMatchId = getInsertId(result, meta);
    publicMatchId = publicMatchId || pathAsInt || null;

    // If public_match_id not set on insert due to null, update
    if (publicMatchId && localMatchId) {
      await connection.query(`UPDATE matches SET public_match_id = COALESCE(public_match_id, ?) WHERE id = ?`, [
        publicMatchId,
        localMatchId,
      ]);
    }

    return { localMatchId, publicMatchId, createdMatch: true };
  }

  // Ensure public_match_id is stored when known
  if (localMatchId && publicMatchId) {
    await connection.query(
      `UPDATE matches SET public_match_id = COALESCE(public_match_id, ?), updated_at = NOW() WHERE id = ?`,
      [publicMatchId, localMatchId]
    );
  }

  return { localMatchId, publicMatchId, createdMatch: false };
}

/**
 * Handler: create/update match (if needed) + batch upsert games.
 * Used by Controller paths like POST /api/sync/push/matches/:id/with-games
 */
async function handleMatchWithGames(req, res) {
  const pathId = req.params.id;
  const body = req.body || {};
  const games = Array.isArray(body.games)
    ? body.games
    : Array.isArray(body.with_games)
      ? body.with_games
      : Array.isArray(body.items)
        ? body.items
        : body.game
          ? [body.game]
          : [];

  // Single-game body fallback
  if (!games.length && (body.game_no != null || body.gameNo != null)) {
    games.push(body);
  }

  const stats = emptySyncStats(games.length);
  stats.message = "Match with games sync";
  const gameResults = [];

  if (!games.length) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "No games array provided. Expected body.games = [{ game_no, status, ... }]",
      received: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ item: "games", error: "games array is required (or provide game_no for single game)" }],
    });
  }

  const connection = await db.getConnection();
  try {
    await ensureSyncSchema(connection);
    await connection.beginTransaction();

    const { localMatchId, publicMatchId, createdMatch } = await resolveOrCreateMatchForGames(
      connection,
      pathId,
      body
    );

    if (!localMatchId) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        code: "MATCH_NOT_FOUND",
        message: `Could not resolve match for id=${pathId}. Push matches first or include match fields so the match can be recreated.`,
        received: games.length,
        created: 0,
        updated: 0,
        failed: games.length,
        errors: [{ item: "match", error: `Match not found for path id ${pathId}` }],
      });
    }

    if (createdMatch) {
      stats.message = "Match recreated then games synced";
    }

    for (let i = 0; i < games.length; i++) {
      const g = games[i] || {};
      try {
        const result = await upsertGameForMatch(connection, localMatchId, g);
        if (result.error) {
          stats.failed += 1;
          stats.errors.push({
            item: `game[${i}]`,
            game_no: g.game_no ?? g.gameNo ?? null,
            error: result.error,
          });
        } else {
          stats.created += result.created;
          stats.updated += result.updated;
          gameResults.push({
            id: result.id,
            game_no: g.game_no ?? g.gameNo ?? null,
            action: result.created ? "created" : "updated",
          });
        }
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          item: `game[${i}]`,
          game_no: g.game_no ?? g.gameNo ?? null,
          error: err.message,
        });
      }
    }

    await connection.commit();
    connection.release();

    stats.success = stats.failed === 0;
    stats.match_id = localMatchId;
    stats.public_match_id = publicMatchId || null;
    stats.games = gameResults;
    stats.received = games.length;

    console.log(
      `[sync-api] with-games match=${localMatchId} public=${publicMatchId || pathId} received=${stats.received} created=${stats.created} updated=${stats.updated} failed=${stats.failed} recreatedMatch=${!!createdMatch}`
    );

    if (stats.created + stats.updated === 0 && stats.failed > 0) {
      return res.status(400).json({
        ...stats,
        success: false,
        code: "SYNC_FAILED",
        message: "All games failed to sync. See errors.",
      });
    }

    res.json(stats);
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
    console.error("[sync-api] with-games error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: error.message || "Database error",
      received: games.length,
      created: 0,
      updated: 0,
      failed: games.length || 1,
      errors: [{ item: "server", error: error.message }],
    });
  }
}

// Controller-compatible aliases (games endpoint "not found" fix)
// Primary: POST /api/sync/push/matches/:id/with-games
router.post("/push/matches/:id/with-games", handleMatchWithGames);
router.put("/push/matches/:id/with-games", handleMatchWithGames);
router.post("/matches/:id/with-games", handleMatchWithGames);
router.put("/matches/:id/with-games", handleMatchWithGames);
router.post("/matches/:id/games", handleMatchWithGames);
router.put("/matches/:id/games", handleMatchWithGames);

// Batch games: POST /api/sync/push/games  and  POST /api/sync/games/batch
async function handleGamesBatch(req, res) {
  const body = req.body || {};
  const games = Array.isArray(body.games)
    ? body.games
    : Array.isArray(body.items)
      ? body.items
      : Array.isArray(body)
        ? body
        : body.game
          ? [body.game]
          : body.game_no != null || body.gameNo != null
            ? [body]
            : [];

  const stats = emptySyncStats(games.length);
  stats.message = "Games batch sync";

  if (!games.length) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "No games provided. Send { games: [...] } or a single game object.",
      received: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [{ item: "games", error: "empty" }],
    });
  }

  const connection = await db.getConnection();
  try {
    await ensureSyncSchema(connection);
    await connection.beginTransaction();

    for (let i = 0; i < games.length; i++) {
      const g = games[i] || {};
      try {
        const publicMatchId = parsePositiveInt(
          g.public_match_id || g.match_public_id || g.publicMatchId || body.public_match_id
        );
        let localMatchId = parsePositiveInt(g.match_id || g.matchId || body.match_id);

        if (!localMatchId && publicMatchId) {
          localMatchId = await findMatchIdByPublicId(connection, publicMatchId);
        }

        if (!localMatchId) {
          // Attempt recreate from game payload + body context
          const resolved = await resolveOrCreateMatchForGames(connection, publicMatchId, {
            ...body,
            ...g,
            public_match_id: publicMatchId,
          });
          localMatchId = resolved.localMatchId;
        }

        if (!localMatchId) {
          stats.failed += 1;
          stats.errors.push({
            item: `game[${i}]`,
            error: `Match not found (match_id/public_match_id missing or deleted). Sync matches first.`,
            public_match_id: publicMatchId || null,
          });
          continue;
        }

        const result = await upsertGameForMatch(connection, localMatchId, g);
        if (result.error) {
          stats.failed += 1;
          stats.errors.push({ item: `game[${i}]`, error: result.error });
        } else {
          stats.created += result.created;
          stats.updated += result.updated;
        }
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({ item: `game[${i}]`, error: err.message });
      }
    }

    await connection.commit();
    connection.release();

    stats.success = stats.failed === 0;
    console.log(
      `[sync-api] games-batch received=${stats.received} created=${stats.created} updated=${stats.updated} failed=${stats.failed}`
    );

    if (stats.created + stats.updated === 0 && stats.failed > 0) {
      return res.status(400).json({
        ...stats,
        success: false,
        code: "SYNC_FAILED",
        message: "All games failed to sync. See errors.",
      });
    }
    res.json(stats);
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
    console.error("[sync-api] games-batch error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: error.message || "Database error",
      received: games.length,
      created: 0,
      updated: 0,
      failed: games.length || 1,
      errors: [{ item: "server", error: error.message }],
    });
  }
}

router.post("/push/games", handleGamesBatch);
router.put("/push/games", handleGamesBatch);
router.post("/games/batch", handleGamesBatch);
router.put("/games/batch", handleGamesBatch);

// Discovery helper so Controller can detect available endpoints
router.get("/endpoints", (req, res) => {
  res.json({
    success: true,
    endpoints: [
      "GET /api/sync/tournaments",
      "GET /api/sync/tournament-modes",
      "GET /api/sync/teams",
      "GET /api/sync/players",
      "POST /api/sync/matches",
      "PUT /api/sync/matches/:id",
      "POST /api/sync/games",
      "PUT /api/sync/games/:id",
      "POST /api/sync/games/batch",
      "POST /api/sync/push/games",
      "POST /api/sync/push/matches/:id/with-games",
      "POST /api/sync/matches/:id/with-games",
      "POST /api/sync/matches/:id/games",
      "POST /api/sync/brackets",
      "POST /api/sync/standings/br",
      "GET /api/sync/standings/br",
    ],
  });
});

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === "object") return [value];
  return [];
}

/**
 * Normalize Controller bracket payload shapes:
 * - { brackets, bracket_rounds, bracket_nodes }
 * - { data: { ... } } / { payload: { ... } }
 * - nested rounds/nodes inside each bracket
 * - tournament IDs on root OR on first bracket item
 */
function normalizeBracketPayload(rawBody) {
  const root = rawBody && typeof rawBody === "object" ? rawBody : {};
  const nested =
    (root.data && typeof root.data === "object" && root.data) ||
    (root.payload && typeof root.payload === "object" && root.payload) ||
    (root.result && typeof root.result === "object" && root.result) ||
    root;

  let brackets = asArray(nested.brackets || nested.bracket);
  let rounds = asArray(nested.bracket_rounds || nested.rounds || nested.bracketRounds);
  let nodes = asArray(nested.bracket_nodes || nested.nodes || nested.bracketNodes);

  // Flatten nested structure: brackets[].rounds / brackets[].nodes
  if (brackets.length) {
    const extraRounds = [];
    const extraNodes = [];
    for (const b of brackets) {
      if (!b || typeof b !== "object") continue;
      const publicBracketId = b.public_bracket_id ?? b.publicBracketId ?? b.id;
      for (const r of asArray(b.rounds || b.bracket_rounds)) {
        extraRounds.push({
          ...r,
          public_bracket_id: r.public_bracket_id ?? r.publicBracketId ?? publicBracketId,
        });
      }
      for (const n of asArray(b.nodes || b.bracket_nodes)) {
        extraNodes.push({
          ...n,
          public_bracket_id: n.public_bracket_id ?? n.publicBracketId ?? publicBracketId,
        });
      }
    }
    if (!rounds.length && extraRounds.length) rounds = extraRounds;
    if (!nodes.length && extraNodes.length) nodes = extraNodes;
  }

  // First non-empty source for tournament context
  const contextSources = [nested, root, ...brackets, ...rounds, ...nodes];
  let tournamentId = null;
  let tournamentModeId = null;
  for (const src of contextSources) {
    if (!src || typeof src !== "object") continue;
    if (!tournamentId) {
      tournamentId = parsePositiveInt(
        src.tournament_id ??
          src.public_tournament_id ??
          src.tournamentId ??
          src.publicTournamentId
      );
    }
    if (!tournamentModeId) {
      tournamentModeId = parsePositiveInt(
        src.tournament_mode_id ??
          src.public_tournament_mode_id ??
          src.tournamentModeId ??
          src.publicTournamentModeId
      );
    }
    if (tournamentId && tournamentModeId) break;
  }

  return { brackets, rounds, nodes, tournamentId, tournamentModeId, nested };
}

/** Accept object/string/null settings_json from Controller. Store as TEXT JSON or null. */
function normalizeSettingsJson(value) {
  if (value === undefined) return undefined; // leave unchanged on update if omitted
  if (value === null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      // Validate JSON string; store canonical form
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      // Store raw string if not valid JSON (Controller quirk)
      return trimmed;
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return String(value);
}

function pickPublicId(...candidates) {
  for (const c of candidates) {
    const n = parsePositiveInt(c);
    if (n) return n;
  }
  return null;
}

/** Always returns a positive integer >= 1 (never null/NaN). */
function safePositiveInt(value, fallback = 1) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const f = Number(fallback);
  return Number.isFinite(f) && f > 0 ? Math.floor(f) : 1;
}

/**
 * Insert a bracket_rounds row, always populating round_no (NOT NULL on live PG).
 * Tries schema variants: round_no only, round_number only, or both.
 * Round numbers are inlined as sanitized integers so they can never bind as SQL NULL.
 */
async function insertBracketRoundRow(connection, {
  publicRoundId,
  bracketId,
  publicBracketId,
  name,
  roundNumber,
  sortOrder,
}) {
  const rn = safePositiveInt(roundNumber, 1);
  const so = safePositiveInt(sortOrder, rn);
  const nm = name != null && String(name).trim() ? String(name).trim() : `Round ${rn}`;

  const attempts = [
    // Both columns (preferred)
    {
      sql: `INSERT INTO bracket_rounds (
              public_round_id, bracket_id, public_bracket_id, name,
              round_no, round_number, sort_order
            ) VALUES (?, ?, ?, ?, ${rn}, ${rn}, ${so})`,
      params: [publicRoundId, bracketId, publicBracketId, nm],
    },
    // Controller-style: round_no only
    {
      sql: `INSERT INTO bracket_rounds (
              public_round_id, bracket_id, public_bracket_id, name, round_no, sort_order
            ) VALUES (?, ?, ?, ?, ${rn}, ${so})`,
      params: [publicRoundId, bracketId, publicBracketId, nm],
    },
    // ensureSyncSchema style: round_number only
    {
      sql: `INSERT INTO bracket_rounds (
              public_round_id, bracket_id, public_bracket_id, name, round_number, sort_order
            ) VALUES (?, ?, ?, ?, ${rn}, ${so})`,
      params: [publicRoundId, bracketId, publicBracketId, nm],
    },
    // Minimal
    {
      sql: `INSERT INTO bracket_rounds (bracket_id, name, round_no) VALUES (?, ?, ${rn})`,
      params: [bracketId, nm],
    },
    {
      sql: `INSERT INTO bracket_rounds (bracket_id, name, round_number) VALUES (?, ?, ${rn})`,
      params: [bracketId, nm],
    },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      return await connection.query(attempt.sql, attempt.params);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Failed to insert bracket_round with round_no=${rn}`);
}

async function updateBracketRoundRow(connection, {
  existingId,
  bracketId,
  publicBracketId,
  publicRoundId,
  name,
  roundNumber,
  sortOrder,
}) {
  const rn = safePositiveInt(roundNumber, 1);
  const so = safePositiveInt(sortOrder, rn);
  const nm = name != null && String(name).trim() ? String(name).trim() : `Round ${rn}`;

  const attempts = [
    {
      sql: `UPDATE bracket_rounds SET
              bracket_id = ?, public_bracket_id = ?,
              public_round_id = COALESCE(public_round_id, ?),
              name = ?, round_no = ${rn}, round_number = ${rn}, sort_order = ${so},
              updated_at = NOW()
            WHERE id = ?`,
      params: [bracketId, publicBracketId, publicRoundId || existingId, nm, existingId],
    },
    {
      sql: `UPDATE bracket_rounds SET
              bracket_id = ?, public_bracket_id = ?,
              public_round_id = COALESCE(public_round_id, ?),
              name = ?, round_no = ${rn}, sort_order = ${so}, updated_at = NOW()
            WHERE id = ?`,
      params: [bracketId, publicBracketId, publicRoundId || existingId, nm, existingId],
    },
    {
      sql: `UPDATE bracket_rounds SET
              bracket_id = ?, public_bracket_id = ?,
              public_round_id = COALESCE(public_round_id, ?),
              name = ?, round_number = ${rn}, sort_order = ${so}, updated_at = NOW()
            WHERE id = ?`,
      params: [bracketId, publicBracketId, publicRoundId || existingId, nm, existingId],
    },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      return await connection.query(attempt.sql, attempt.params);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Failed to update bracket_round id=${existingId}`);
}

/** Non-empty string key for same-request Controller local id maps (allows string keys). */
function pickControllerKey(...candidates) {
  for (const c of candidates) {
    if (c === undefined || c === null || c === "") continue;
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return String(c);
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

// 12b. POST /api/sync/brackets
// Supports first-time create (public_* ids null) and subsequent update by public_* ids.
router.post("/brackets", async (req, res) => {
  const body = req.body || {};

  // Debug log (safe summary) to diagnose Controller payload mismatches
  try {
    const keys = body && typeof body === "object" ? Object.keys(body) : [];
    const sampleBracket = Array.isArray(body.brackets)
      ? body.brackets[0]
      : body.bracket || body?.data?.brackets?.[0] || null;
    console.log("[sync-api] /brackets received keys:", keys.join(", ") || "(none)");
    console.log(
      "[sync-api] /brackets payload summary:",
      JSON.stringify({
        has_brackets: Array.isArray(body.brackets) || !!body.bracket || !!body?.data?.brackets,
        has_rounds: Array.isArray(body.bracket_rounds) || Array.isArray(body.rounds) || !!body?.data?.bracket_rounds,
        has_nodes: Array.isArray(body.bracket_nodes) || Array.isArray(body.nodes) || !!body?.data?.bracket_nodes,
        tournament_id: body.tournament_id ?? body.public_tournament_id ?? body?.data?.tournament_id ?? null,
        tournament_mode_id:
          body.tournament_mode_id ?? body.public_tournament_mode_id ?? body?.data?.tournament_mode_id ?? null,
        brackets_len: Array.isArray(body.brackets) ? body.brackets.length : body.bracket ? 1 : 0,
        rounds_len: Array.isArray(body.bracket_rounds)
          ? body.bracket_rounds.length
          : Array.isArray(body.rounds)
            ? body.rounds.length
            : 0,
        nodes_len: Array.isArray(body.bracket_nodes)
          ? body.bracket_nodes.length
          : Array.isArray(body.nodes)
            ? body.nodes.length
            : 0,
        sample_bracket_keys: sampleBracket && typeof sampleBracket === "object" ? Object.keys(sampleBracket) : [],
        sample_bracket: sampleBracket
          ? {
              id: sampleBracket.id ?? null,
              public_bracket_id: sampleBracket.public_bracket_id ?? sampleBracket.publicBracketId ?? null,
              name: sampleBracket.name ?? sampleBracket.title ?? null,
              tournament_id: sampleBracket.tournament_id ?? sampleBracket.public_tournament_id ?? null,
              tournament_mode_id:
                sampleBracket.tournament_mode_id ?? sampleBracket.public_tournament_mode_id ?? null,
              has_settings_json: sampleBracket.settings_json !== undefined || sampleBracket.settings !== undefined,
            }
          : null,
      })
    );
  } catch (_) {
    /* ignore logging errors */
  }

  const {
    brackets,
    rounds,
    nodes,
    tournamentId: rootTournamentId,
    tournamentModeId: rootModeId,
  } = normalizeBracketPayload(body);

  const received = brackets.length + rounds.length + nodes.length;
  const stats = emptySyncStats(received);
  const warnings = [];

  if (received === 0) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message:
        "No bracket data found. Expected arrays: brackets, bracket_rounds, bracket_nodes (or nested data/payload).",
      received: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [
        {
          code: "EMPTY_PAYLOAD",
          message: "Payload contained no brackets, bracket_rounds, or bracket_nodes",
          received_keys: body && typeof body === "object" ? Object.keys(body) : [],
        },
      ],
    });
  }

  // Tournament context is preferred at root but may live only on bracket rows.
  // Per-item values override root when present.
  let defaultTournamentId = rootTournamentId;
  let defaultModeId = rootModeId;

  if (!defaultTournamentId || !defaultModeId) {
    // Soft-fail path: still try to process items that carry their own IDs
    warnings.push({
      code: "MISSING_ROOT_CONTEXT",
      message:
        "Root tournament_id/tournament_mode_id missing; will use per-item values when available",
    });
  }

  const connection = await db.getConnection();
  /**
   * Maps Controller-side keys → production primary keys for THIS request.
   * Keys may be: public_* id, Controller local id, or client_key strings.
   */
  const bracketIdByKey = new Map();
  const roundIdByKey = new Map();
  const nodeIdByKey = new Map();
  /** (productionBracketId, round_number) → production round id */
  const roundIdByBracketAndNumber = new Map();

  let latestBracketId = null;
  let latestPublicBracketId = null;
  const mappings = { brackets: [], rounds: [], nodes: [] };

  const roundMapKey = (bracketId, roundNumber) => `${bracketId}:${roundNumber}`;

  function rememberBracketKeys(productionId, publicId, item) {
    const keys = [
      publicId,
      productionId,
      item?.public_bracket_id,
      item?.publicBracketId,
      item?.controller_bracket_id,
      item?.local_id,
      item?.localId,
      item?.client_key,
      item?.clientKey,
      item?.id, // Controller local id on first push
      item?.bracket_id,
    ];
    for (const k of keys) {
      const key = pickControllerKey(k);
      if (key) bracketIdByKey.set(key, productionId);
    }
  }

  function rememberRoundKeys(productionId, publicId, item, bracketId, roundNumber) {
    const keys = [
      publicId,
      productionId,
      item?.public_round_id,
      item?.publicRoundId,
      item?.controller_round_id,
      item?.local_id,
      item?.id,
    ];
    for (const k of keys) {
      const key = pickControllerKey(k);
      if (key) roundIdByKey.set(key, productionId);
    }
    if (bracketId && roundNumber) {
      roundIdByBracketAndNumber.set(roundMapKey(bracketId, roundNumber), productionId);
    }
  }

  function rememberNodeKeys(productionId, publicId, item) {
    const keys = [
      publicId,
      productionId,
      item?.public_node_id,
      item?.publicNodeId,
      item?.controller_node_id,
      item?.local_id,
      item?.id,
      item?.node_key,
      item?.nodeKey,
    ];
    for (const k of keys) {
      const key = pickControllerKey(k);
      if (key) nodeIdByKey.set(key, productionId);
    }
  }

  try {
    await ensureSyncSchema(connection);

    if (defaultTournamentId && defaultModeId) {
      const [modeRows] = await connection.query(
        `SELECT id FROM tournament_modes WHERE id = ? AND tournament_id = ?`,
        [defaultModeId, defaultTournamentId]
      );
      if (modeRows.length === 0) {
        warnings.push({
          code: "MODE_CONTEXT_SOFT",
          message: `tournament_mode_id ${defaultModeId} not verified against tournament ${defaultTournamentId}; continuing`,
        });
      }
    }

    // IMPORTANT (Postgres): do NOT wrap bracket + rounds + nodes in one transaction.
    // Schema-fallback inserts (round_no vs round_number) may fail once; inside a single
    // transaction that aborts all following commands with:
    // "current transaction is aborted, commands ignored until end of transaction block"
    // Each record is processed independently; errors are collected per item.

    /**
     * Create or update one bracket row. Used for payload brackets[] and auto-create.
     */
    async function upsertOneBracket(item, { isAutoCreate = false } = {}) {
      const tournamentId =
        parsePositiveInt(item.tournament_id ?? item.public_tournament_id ?? item.tournamentId) ||
        defaultTournamentId;
      const tournamentModeId =
        parsePositiveInt(
          item.tournament_mode_id ?? item.public_tournament_mode_id ?? item.tournamentModeId
        ) || defaultModeId;

      if (!tournamentId || !tournamentModeId) {
        throw new Error(
          "Missing tournament_id and/or tournament_mode_id for bracket creation (provide at root or on the bracket item)"
        );
      }
      if (!defaultTournamentId) defaultTournamentId = tournamentId;
      if (!defaultModeId) defaultModeId = tournamentModeId;

      // Production public id (known only after first successful sync back to Controller)
      let publicBracketId = pickPublicId(item.public_bracket_id, item.publicBracketId);

      // Controller local identity for same-request child linking (first-time create)
      const controllerLocalKey = pickControllerKey(
        item.controller_bracket_id,
        item.local_id,
        item.localId,
        item.client_key,
        item.clientKey,
        item.id // Controller local PK on first push when public_bracket_id is null
      );

      const name =
        (item.name != null && String(item.name).trim()) ||
        (item.title != null && String(item.title).trim()) ||
        (isAutoCreate ? "Bracket" : "Bracket");
      const bracketType =
        item.bracket_type || item.bracketType || item.type || "single_elimination";
      const status = normalizeStatus(item.status) || "active";
      const settingsJson = normalizeSettingsJson(
        item.settings_json !== undefined
          ? item.settings_json
          : item.settingsJson !== undefined
            ? item.settingsJson
            : item.settings
      );

      let existingId = null;

      // Update path: known public_bracket_id
      if (publicBracketId) {
        const [found] = await connection.query(
          `SELECT id FROM brackets WHERE public_bracket_id = ? OR id = ? LIMIT 1`,
          [publicBracketId, publicBracketId]
        );
        if (found[0]) existingId = found[0].id;
      }

      // Idempotent first-time: reuse only when auto-creating parent for rounds/nodes,
      // or when payload has a single bracket with null public_bracket_id.
      if (
        !existingId &&
        !publicBracketId &&
        tournamentId &&
        tournamentModeId &&
        (isAutoCreate || brackets.length <= 1)
      ) {
        const [foundMode] = await connection.query(
          `SELECT id, public_bracket_id FROM brackets
           WHERE tournament_id = ? AND tournament_mode_id = ?
           ORDER BY id DESC LIMIT 1`,
          [tournamentId, tournamentModeId]
        );
        if (foundMode[0]) {
          existingId = foundMode[0].id;
          if (foundMode[0].public_bracket_id) {
            publicBracketId = Number(foundMode[0].public_bracket_id);
          }
        }
      }

      let productionId = null;
      let wasCreated = false;

      if (existingId) {
        productionId = existingId;
        await connection.query(
          `UPDATE brackets SET
            tournament_id = ?, tournament_mode_id = ?, name = ?, bracket_type = ?,
            status = ?,
            public_bracket_id = COALESCE(public_bracket_id, ?),
            settings_json = COALESCE(?, settings_json),
            updated_at = NOW()
           WHERE id = ?`,
          [
            tournamentId,
            tournamentModeId,
            name,
            bracketType,
            status,
            publicBracketId || existingId,
            settingsJson === undefined ? null : settingsJson,
            existingId,
          ]
        );
        if (settingsJson === null) {
          await connection.query(`UPDATE brackets SET settings_json = NULL WHERE id = ?`, [existingId]);
        }
        // Ensure public_bracket_id is set for Controller mapping
        const [row] = await connection.query(
          `SELECT public_bracket_id FROM brackets WHERE id = ?`,
          [productionId]
        );
        if (!row[0]?.public_bracket_id) {
          await connection.query(`UPDATE brackets SET public_bracket_id = ? WHERE id = ?`, [
            productionId,
            productionId,
          ]);
          publicBracketId = productionId;
        } else {
          publicBracketId = Number(row[0].public_bracket_id);
        }
        stats.updated += 1;
      } else {
        // First-time creation — public_bracket_id may be null
        const [result, meta] = await connection.query(
          `INSERT INTO brackets (
            public_bracket_id, tournament_id, tournament_mode_id, name, bracket_type, status, settings_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            publicBracketId, // may be null
            tournamentId,
            tournamentModeId,
            name,
            bracketType,
            status,
            settingsJson === undefined ? null : settingsJson,
          ]
        );
        productionId = getInsertId(result, meta);
        if (!productionId) {
          throw new Error("Bracket insert succeeded but no id was returned");
        }
        // Assign public_bracket_id = production id when Controller sent null
        if (!publicBracketId) {
          await connection.query(`UPDATE brackets SET public_bracket_id = ? WHERE id = ?`, [
            productionId,
            productionId,
          ]);
          publicBracketId = productionId;
        }
        wasCreated = true;
        stats.created += 1;
      }

      latestBracketId = productionId;
      latestPublicBracketId = publicBracketId || productionId;
      rememberBracketKeys(productionId, publicBracketId || productionId, item);
      if (controllerLocalKey) bracketIdByKey.set(controllerLocalKey, productionId);

      mappings.brackets.push({
        public_bracket_id: publicBracketId || productionId,
        id: productionId,
        controller_key: controllerLocalKey,
        created: wasCreated,
      });

      return { productionId, publicBracketId: publicBracketId || productionId, wasCreated };
    }

    // 1) Brackets first
    for (const item of brackets) {
      try {
        if (!item || typeof item !== "object") {
          throw new Error("Invalid bracket item (expected object)");
        }
        await upsertOneBracket(item);
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          entity: "bracket",
          item: "bracket",
          public_bracket_id: item?.public_bracket_id ?? item?.id ?? null,
          error: err.message,
          message: err.message,
        });
      }
    }

    // If Controller only sent rounds/nodes (or brackets failed), auto-create a parent bracket
    if (!latestBracketId && (rounds.length > 0 || nodes.length > 0)) {
      try {
        if (!defaultTournamentId || !defaultModeId) {
          throw new Error(
            "Cannot auto-create parent bracket: tournament_id and tournament_mode_id are required at payload root for first-time sync"
          );
        }
        const auto = await upsertOneBracket(
          {
            tournament_id: defaultTournamentId,
            tournament_mode_id: defaultModeId,
            name: "Bracket",
          },
          { isAutoCreate: true }
        );
        warnings.push({
          code: "AUTO_CREATED_BRACKET",
          message: `Auto-created parent bracket id=${auto.productionId} public_bracket_id=${auto.publicBracketId} for rounds/nodes (brackets[] empty or failed)`,
        });
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          entity: "bracket",
          item: "bracket",
          error: err.message,
          message: err.message,
        });
      }
    }

    async function resolveBracketIdForChild(item, entityLabel) {
      // Prefer explicit production/public ids, then Controller local bracket_id / id references
      const keyCandidates = [
        item.public_bracket_id,
        item.publicBracketId,
        item.bracket_public_id,
        item.controller_bracket_id,
        item.local_bracket_id,
        item.bracket_id,
        item.bracketId,
        item.client_bracket_key,
      ];

      let bracketId = null;
      let matchedKey = null;
      for (const c of keyCandidates) {
        const key = pickControllerKey(c);
        if (key && bracketIdByKey.has(key)) {
          bracketId = bracketIdByKey.get(key);
          matchedKey = key;
          break;
        }
      }

      // DB lookup by public_bracket_id / id
      if (!bracketId) {
        const pub = pickPublicId(...keyCandidates);
        if (pub) {
          const [found] = await connection.query(
            `SELECT id, public_bracket_id FROM brackets WHERE public_bracket_id = ? OR id = ? LIMIT 1`,
            [pub, pub]
          );
          if (found[0]) {
            bracketId = found[0].id;
            bracketIdByKey.set(String(pub), bracketId);
            matchedKey = String(pub);
          }
        }
      }

      // Same-request parent (first-time: public_bracket_id was null on children)
      if (!bracketId && latestBracketId) {
        bracketId = latestBracketId;
        warnings.push({
          code: "RESOLVED_LATEST_BRACKET",
          message: `${entityLabel}: linked to parent bracket id=${bracketId} created in this request (child public_bracket_id was null)`,
        });
      }

      // Last resort: newest bracket for tournament mode
      if (!bracketId && defaultTournamentId && defaultModeId) {
        const [found] = await connection.query(
          `SELECT id, public_bracket_id FROM brackets
           WHERE tournament_id = ? AND tournament_mode_id = ?
           ORDER BY id DESC LIMIT 1`,
          [defaultTournamentId, defaultModeId]
        );
        if (found[0]) {
          bracketId = found[0].id;
          latestBracketId = bracketId;
          latestPublicBracketId = found[0].public_bracket_id || bracketId;
        }
      }

      if (!bracketId) {
        throw new Error(
          `${entityLabel}: Cannot resolve parent bracket. ` +
            `public_bracket_id is missing/null and no bracket exists for this tournament mode. ` +
            `Include brackets[] with tournament_id + tournament_mode_id on first-time sync, or provide public_bracket_id for updates.`
        );
      }

      // Resolve public id for mapping response
      let publicBracketId = latestPublicBracketId || bracketId;
      const [brow] = await connection.query(
        `SELECT public_bracket_id FROM brackets WHERE id = ? LIMIT 1`,
        [bracketId]
      );
      if (brow[0]?.public_bracket_id) {
        publicBracketId = Number(brow[0].public_bracket_id);
        latestPublicBracketId = publicBracketId;
      }

      return { bracketId, publicBracketId, matchedKey };
    }

    // 2) Rounds — public_round_id optional on first sync
    for (const item of rounds) {
      try {
        if (!item || typeof item !== "object") {
          throw new Error("Invalid bracket_round item (expected object)");
        }

        let publicRoundId = pickPublicId(item.public_round_id, item.publicRoundId);
        const controllerRoundKey = pickControllerKey(
          item.controller_round_id,
          item.local_id,
          item.id
        );
        const { bracketId, publicBracketId } = await resolveBracketIdForChild(item, "bracket_round");

        const name =
          item.name != null
            ? String(item.name)
            : item.title != null
              ? String(item.title)
              : null;
        // Accept Controller `round_no` and Production `round_number` — never null
        const roundNumber = safePositiveInt(
          item.round_no ??
            item.round_number ??
            item.roundNumber ??
            item.round ??
            item.order ??
            item.sort_order ??
            item.sortOrder,
          1
        );
        const sortOrder = safePositiveInt(
          item.sort_order ?? item.sortOrder ?? item.round_no ?? item.round_number,
          roundNumber
        );

        let existingId = null;
        if (publicRoundId) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_rounds WHERE public_round_id = ? OR id = ? LIMIT 1`,
            [publicRoundId, publicRoundId]
          );
          if (found[0]) existingId = found[0].id;
        }
        if (!existingId) {
          // Support schemas with either round_number or round_no
          let foundByNo = [];
          try {
            const [rows] = await connection.query(
              `SELECT id FROM bracket_rounds
               WHERE bracket_id = ? AND (round_number = ? OR round_no = ?)
               LIMIT 1`,
              [bracketId, roundNumber, roundNumber]
            );
            foundByNo = rows;
          } catch (_) {
            try {
              const [rows] = await connection.query(
                `SELECT id FROM bracket_rounds WHERE bracket_id = ? AND round_number = ? LIMIT 1`,
                [bracketId, roundNumber]
              );
              foundByNo = rows;
            } catch (__) {
              try {
                const [rows] = await connection.query(
                  `SELECT id FROM bracket_rounds WHERE bracket_id = ? AND round_no = ? LIMIT 1`,
                  [bracketId, roundNumber]
                );
                foundByNo = rows;
              } catch (___) {
                foundByNo = [];
              }
            }
          }
          if (foundByNo[0]) existingId = foundByNo[0].id;
        }

        let productionRoundId = null;
        let wasCreated = false;

        if (existingId) {
          productionRoundId = existingId;
          await updateBracketRoundRow(connection, {
            existingId,
            bracketId,
            publicBracketId,
            publicRoundId,
            name,
            roundNumber,
            sortOrder,
          });
          if (!publicRoundId) {
            const [row] = await connection.query(
              `SELECT public_round_id FROM bracket_rounds WHERE id = ?`,
              [productionRoundId]
            );
            if (!row[0]?.public_round_id) {
              await connection.query(
                `UPDATE bracket_rounds SET public_round_id = ? WHERE id = ?`,
                [productionRoundId, productionRoundId]
              );
              publicRoundId = productionRoundId;
            } else {
              publicRoundId = Number(row[0].public_round_id);
            }
          }
          stats.updated += 1;
        } else {
          const [result, meta] = await insertBracketRoundRow(connection, {
            publicRoundId,
            bracketId,
            publicBracketId,
            name,
            roundNumber,
            sortOrder,
          });
          productionRoundId = getInsertId(result, meta);
          if (!productionRoundId) {
            throw new Error(
              `bracket_round insert did not return id (round_no=${roundNumber}, bracket_id=${bracketId})`
            );
          }
          if (!publicRoundId && productionRoundId) {
            await connection.query(
              `UPDATE bracket_rounds SET public_round_id = ? WHERE id = ?`,
              [productionRoundId, productionRoundId]
            );
            publicRoundId = productionRoundId;
          }
          wasCreated = true;
          stats.created += 1;
        }

        rememberRoundKeys(productionRoundId, publicRoundId || productionRoundId, item, bracketId, roundNumber);
        if (controllerRoundKey) roundIdByKey.set(controllerRoundKey, productionRoundId);

        mappings.rounds.push({
          public_bracket_id: publicBracketId,
          public_round_id: publicRoundId || productionRoundId,
          id: productionRoundId,
          round_no: roundNumber,
          controller_key: controllerRoundKey,
          created: wasCreated,
        });
      } catch (err) {
        stats.failed += 1;
        const failedRoundNo = safePositiveInt(
          item?.round_no ?? item?.round_number ?? item?.roundNumber ?? item?.order,
          0
        );
        stats.errors.push({
          entity: "bracket_round",
          type: "bracket_round",
          item: "bracket_round",
          public_bracket_id: item?.public_bracket_id ?? null,
          public_round_id: item?.public_round_id ?? item?.id ?? null,
          round_no: failedRoundNo || null,
          error: err.message,
          message: err.message,
        });
        console.error(
          `[sync-api] bracket_round failed round_no=${failedRoundNo || "?"} :`,
          err.message
        );
      }
    }

    // 3) Nodes — public_node_id optional on first sync
    for (const item of nodes) {
      try {
        if (!item || typeof item !== "object") {
          throw new Error("Invalid bracket_node item (expected object)");
        }

        let publicNodeId = pickPublicId(item.public_node_id, item.publicNodeId);
        const controllerNodeKey = pickControllerKey(
          item.controller_node_id,
          item.local_id,
          item.node_key,
          item.nodeKey,
          item.id
        );
        const { bracketId, publicBracketId } = await resolveBracketIdForChild(item, "bracket_node");

        let publicRoundId = pickPublicId(
          item.public_round_id,
          item.publicRoundId,
          item.round_public_id
        );
        const publicMatchId = pickPublicId(
          item.public_match_id,
          item.publicMatchId,
          item.match_public_id
        );
        const nextPublicNodeId = pickPublicId(
          item.next_public_node_id,
          item.nextPublicNodeId,
          item.next_node_public_id,
          item.winner_to_public_node_id
        );

        // Live PG requires bracket_nodes.round_id NOT NULL — never insert without a round.
        let roundId = null;
        for (const c of [
          publicRoundId,
          item.round_id,
          item.roundId,
          item.controller_round_id,
          item.public_round_id,
        ]) {
          const key = pickControllerKey(c);
          if (key && roundIdByKey.has(key)) {
            roundId = roundIdByKey.get(key);
            break;
          }
        }
        if (!roundId && publicRoundId) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_rounds WHERE public_round_id = ? OR id = ? LIMIT 1`,
            [publicRoundId, publicRoundId]
          );
          if (found[0]) {
            roundId = found[0].id;
            roundIdByKey.set(String(publicRoundId), roundId);
          }
        }

        // Controller may send round_no / round_number / round index on the node
        let roundNumber =
          parsePositiveInt(
            item.round_number ??
              item.round_no ??
              item.roundNumber ??
              item.round ??
              item.round_index ??
              item.roundIndex
          ) || null;

        if (!roundId && roundNumber) {
          roundId = roundIdByBracketAndNumber.get(roundMapKey(bracketId, roundNumber)) || null;
          if (!roundId) {
            // Support either round_number or round_no column on live schema
            try {
              const [found] = await connection.query(
                `SELECT id FROM bracket_rounds
                 WHERE bracket_id = ? AND (round_number = ? OR round_no = ?)
                 LIMIT 1`,
                [bracketId, roundNumber, roundNumber]
              );
              if (found[0]) roundId = found[0].id;
            } catch (_) {
              try {
                const [found] = await connection.query(
                  `SELECT id FROM bracket_rounds WHERE bracket_id = ? AND round_no = ? LIMIT 1`,
                  [bracketId, roundNumber]
                );
                if (found[0]) roundId = found[0].id;
              } catch (_) {
                try {
                  const [found] = await connection.query(
                    `SELECT id FROM bracket_rounds WHERE bracket_id = ? AND round_number = ? LIMIT 1`,
                    [bracketId, roundNumber]
                  );
                  if (found[0]) roundId = found[0].id;
                } catch (_) {
                  /* ignore */
                }
              }
            }
          }
        }

        // Last resort: newest round under this bracket
        if (!roundId) {
          try {
            const [anyRound] = await connection.query(
              `SELECT id, public_round_id FROM bracket_rounds
               WHERE bracket_id = ?
               ORDER BY COALESCE(round_no, round_number, id) ASC
               LIMIT 1`,
              [bracketId]
            );
            if (anyRound[0]) {
              roundId = anyRound[0].id;
              if (!publicRoundId && anyRound[0].public_round_id) {
                publicRoundId = Number(anyRound[0].public_round_id);
              }
              warnings.push({
                code: "NODE_USED_FIRST_ROUND",
                message: `Node linked to first available round id=${roundId} for bracket ${bracketId} (node had no round reference)`,
              });
            }
          } catch (_) {
            try {
              const [anyRound] = await connection.query(
                `SELECT id, public_round_id FROM bracket_rounds WHERE bracket_id = ? ORDER BY id ASC LIMIT 1`,
                [bracketId]
              );
              if (anyRound[0]) {
                roundId = anyRound[0].id;
                if (!publicRoundId && anyRound[0].public_round_id) {
                  publicRoundId = Number(anyRound[0].public_round_id);
                }
              }
            } catch (_) {
              /* ignore */
            }
          }
        }

        // Auto-create a round so NOT NULL round_id never fails node insert
        if (!roundId) {
          const autoRoundNo = roundNumber || 1;
          const [result, meta] = await insertBracketRoundRow(connection, {
            publicRoundId: publicRoundId || null,
            bracketId,
            publicBracketId,
            name: `Round ${autoRoundNo}`,
            roundNumber: autoRoundNo,
            sortOrder: autoRoundNo,
          });
          roundId = getInsertId(result, meta);
          if (!roundId) {
            throw new Error(
              `bracket_node: cannot resolve round_id and auto-create round failed for bracket_id=${bracketId}`
            );
          }
          if (!publicRoundId) {
            try {
              await connection.query(
                `UPDATE bracket_rounds SET public_round_id = COALESCE(public_round_id, ?) WHERE id = ?`,
                [roundId, roundId]
              );
              publicRoundId = roundId;
            } catch (_) {
              publicRoundId = roundId;
            }
          }
          roundNumber = autoRoundNo;
          rememberRoundKeys(roundId, publicRoundId || roundId, item, bracketId, autoRoundNo);
          roundIdByBracketAndNumber.set(roundMapKey(bracketId, autoRoundNo), roundId);
          stats.created += 1;
          warnings.push({
            code: "AUTO_CREATED_ROUND_FOR_NODE",
            message: `Auto-created bracket_round id=${roundId} round_no=${autoRoundNo} for node (round_id is NOT NULL on production)`,
          });
          mappings.rounds.push({
            public_bracket_id: publicBracketId,
            public_round_id: publicRoundId || roundId,
            id: roundId,
            round_no: autoRoundNo,
            created: true,
            auto_for_node: true,
          });
        }

        // Load public_round_id for response if we only have production round id
        if (roundId && !publicRoundId) {
          try {
            const [rrow] = await connection.query(
              `SELECT public_round_id FROM bracket_rounds WHERE id = ? LIMIT 1`,
              [roundId]
            );
            if (rrow[0]?.public_round_id) publicRoundId = Number(rrow[0].public_round_id);
            else publicRoundId = roundId;
          } catch (_) {
            publicRoundId = roundId;
          }
        }

        if (!roundId) {
          throw new Error(
            `bracket_node: round_id is required (NOT NULL) but could not be resolved. Provide public_round_id, round_id, or round_no on the node, or sync bracket_rounds first.`
          );
        }

        let matchId = parsePositiveInt(item.match_id || item.matchId) || null;
        if (!matchId && publicMatchId) {
          const m = await findMatchForSync(connection, publicMatchId);
          matchId = m?.id || null;
        }

        const position =
          parseNonNegInt(item.position ?? item.slot_index ?? item.slotIndex ?? item.order, 0) ?? 0;
        // Live PG bracket_nodes is structural only — no status/team columns on some installs.
        // Do NOT write: status, blue_team_id, red_team_id, winner_team_id.
        const nodeKey = item.node_key || item.nodeKey || null;
        const label = item.label != null ? String(item.label) : null;

        let existingId = null;
        if (publicNodeId) {
          const [found] = await connection.query(
            `SELECT id FROM bracket_nodes WHERE public_node_id = ? OR id = ? LIMIT 1`,
            [publicNodeId, publicNodeId]
          );
          if (found[0]) existingId = found[0].id;
        }
        if (!existingId && nodeKey) {
          try {
            const [foundKey] = await connection.query(
              `SELECT id FROM bracket_nodes WHERE bracket_id = ? AND node_key = ? LIMIT 1`,
              [bracketId, nodeKey]
            );
            if (foundKey[0]) existingId = foundKey[0].id;
          } catch (_) {
            /* optional column */
          }
        }
        // Position within bracket+round for first-time create
        if (!existingId && roundId != null) {
          try {
            const [foundPos] = await connection.query(
              `SELECT id FROM bracket_nodes WHERE bracket_id = ? AND round_id = ? AND position = ? LIMIT 1`,
              [bracketId, roundId, position]
            );
            if (foundPos[0]) existingId = foundPos[0].id;
          } catch (_) {
            /* position column may differ */
          }
        }

        let productionNodeId = null;
        let wasCreated = false;

        /**
         * Schema-tolerant write: try richest structural column set first, then leaner.
         * Never reference status / blue_team_id / red_team_id / winner_team_id.
         */
        async function writeBracketNode({ isUpdate, id }) {
          const updateAttempts = [
            {
              sql: `UPDATE bracket_nodes SET
                      bracket_id = ?, round_id = ?, public_bracket_id = ?, public_round_id = ?,
                      public_node_id = COALESCE(public_node_id, ?), public_match_id = ?, match_id = ?,
                      position = ?, next_public_node_id = ?, updated_at = NOW()
                    WHERE id = ?`,
              params: [
                bracketId,
                roundId,
                publicBracketId,
                publicRoundId,
                publicNodeId || id,
                publicMatchId,
                matchId,
                position,
                nextPublicNodeId,
                id,
              ],
            },
            {
              sql: `UPDATE bracket_nodes SET
                      bracket_id = ?, round_id = ?, public_bracket_id = ?, public_round_id = ?,
                      public_match_id = ?, match_id = ?, position = ?, updated_at = NOW()
                    WHERE id = ?`,
              params: [
                bracketId,
                roundId,
                publicBracketId,
                publicRoundId,
                publicMatchId,
                matchId,
                position,
                id,
              ],
            },
            {
              sql: `UPDATE bracket_nodes SET
                      bracket_id = ?, round_id = ?, public_bracket_id = ?,
                      match_id = ?, position = ?
                    WHERE id = ?`,
              params: [bracketId, roundId, publicBracketId, matchId, position, id],
            },
            {
              sql: `UPDATE bracket_nodes SET bracket_id = ?, round_id = ?, match_id = ? WHERE id = ?`,
              params: [bracketId, roundId, matchId, id],
            },
          ];

          const insertAttempts = [
            {
              sql: `INSERT INTO bracket_nodes (
                      public_node_id, bracket_id, round_id, public_bracket_id, public_round_id,
                      public_match_id, match_id, position, next_public_node_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              params: [
                publicNodeId,
                bracketId,
                roundId,
                publicBracketId,
                publicRoundId,
                publicMatchId,
                matchId,
                position,
                nextPublicNodeId,
              ],
            },
            {
              sql: `INSERT INTO bracket_nodes (
                      public_node_id, bracket_id, round_id, public_bracket_id, public_round_id,
                      public_match_id, match_id, position
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              params: [
                publicNodeId,
                bracketId,
                roundId,
                publicBracketId,
                publicRoundId,
                publicMatchId,
                matchId,
                position,
              ],
            },
            {
              sql: `INSERT INTO bracket_nodes (
                      bracket_id, round_id, public_bracket_id, public_match_id, match_id, position
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
              params: [bracketId, roundId, publicBracketId, publicMatchId, matchId, position],
            },
            {
              sql: `INSERT INTO bracket_nodes (
                      bracket_id, round_id, public_bracket_id, match_id, position
                    ) VALUES (?, ?, ?, ?, ?)`,
              params: [bracketId, roundId, publicBracketId, matchId, position],
            },
            {
              sql: `INSERT INTO bracket_nodes (bracket_id, round_id, match_id, position)
                    VALUES (?, ?, ?, ?)`,
              params: [bracketId, roundId, matchId, position],
            },
            {
              sql: `INSERT INTO bracket_nodes (bracket_id, round_id, match_id) VALUES (?, ?, ?)`,
              params: [bracketId, roundId, matchId],
            },
            // Never insert without round_id — live PG enforces NOT NULL
            {
              sql: `INSERT INTO bracket_nodes (bracket_id, round_id, position) VALUES (?, ?, ?)`,
              params: [bracketId, roundId, position],
            },
            {
              sql: `INSERT INTO bracket_nodes (bracket_id, round_id) VALUES (?, ?)`,
              params: [bracketId, roundId],
            },
          ];

          const attempts = isUpdate ? updateAttempts : insertAttempts;
          let lastErr = null;
          for (const attempt of attempts) {
            try {
              return await connection.query(attempt.sql, attempt.params);
            } catch (e) {
              lastErr = e;
            }
          }
          throw lastErr || new Error("bracket_node write failed for all schema variants");
        }

        if (existingId) {
          productionNodeId = existingId;
          await writeBracketNode({ isUpdate: true, id: existingId });

          if (!publicNodeId) {
            try {
              const [nrow] = await connection.query(
                `SELECT public_node_id FROM bracket_nodes WHERE id = ?`,
                [productionNodeId]
              );
              if (!nrow[0]?.public_node_id) {
                await connection.query(`UPDATE bracket_nodes SET public_node_id = ? WHERE id = ?`, [
                  productionNodeId,
                  productionNodeId,
                ]);
                publicNodeId = productionNodeId;
              } else {
                publicNodeId = Number(nrow[0].public_node_id);
              }
            } catch (_) {
              publicNodeId = productionNodeId;
            }
          }
          stats.updated += 1;
        } else {
          const [result, meta] = await writeBracketNode({ isUpdate: false });
          productionNodeId = getInsertId(result, meta);
          if (!productionNodeId) {
            throw new Error("bracket_node insert did not return id");
          }
          if (!publicNodeId && productionNodeId) {
            try {
              await connection.query(`UPDATE bracket_nodes SET public_node_id = ? WHERE id = ?`, [
                productionNodeId,
                productionNodeId,
              ]);
              publicNodeId = productionNodeId;
            } catch (_) {
              publicNodeId = productionNodeId;
            }
          }
          wasCreated = true;
          stats.created += 1;
        }

        // Optional enrichment columns (ignore if missing on live schema)
        if (nodeKey || label) {
          try {
            await connection.query(
              `UPDATE bracket_nodes SET
                 node_key = COALESCE(?, node_key),
                 label = COALESCE(?, label)
               WHERE id = ?`,
              [nodeKey, label, productionNodeId]
            );
          } catch (_) {
            try {
              if (nodeKey) {
                await connection.query(
                  `UPDATE bracket_nodes SET node_key = COALESCE(?, node_key) WHERE id = ?`,
                  [nodeKey, productionNodeId]
                );
              }
            } catch (__) {
              /* optional columns */
            }
          }
        }

        rememberNodeKeys(productionNodeId, publicNodeId || productionNodeId, item);
        if (controllerNodeKey) nodeIdByKey.set(controllerNodeKey, productionNodeId);

        mappings.nodes.push({
          public_bracket_id: publicBracketId,
          public_round_id: publicRoundId || roundId,
          public_node_id: publicNodeId || productionNodeId,
          id: productionNodeId,
          node_key: nodeKey,
          controller_key: controllerNodeKey,
          created: wasCreated,
        });
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          entity: "bracket_node",
          item: "bracket_node",
          public_bracket_id: item?.public_bracket_id ?? null,
          public_node_id: item?.public_node_id ?? item?.id ?? null,
          error: err.message,
          message: err.message,
        });
      }
    }

    // Resolve next_node_id from next_public_node_id / controller keys (best-effort, non-fatal)
    if (nodeIdByKey.size > 0) {
      const seenLocal = new Set();
      for (const localNodeId of nodeIdByKey.values()) {
        try {
          if (seenLocal.has(localNodeId)) continue;
          seenLocal.add(localNodeId);

          const [rows] = await connection.query(
            `SELECT next_public_node_id FROM bracket_nodes WHERE id = ?`,
            [localNodeId]
          );
          const nextRef = rows[0]?.next_public_node_id;
          if (nextRef == null || nextRef === "") continue;

          let nextLocal =
            nodeIdByKey.get(String(nextRef)) ||
            nodeIdByKey.get(String(Number(nextRef))) ||
            null;
          if (!nextLocal) {
            const n = parsePositiveInt(nextRef);
            if (n) {
              const [found] = await connection.query(
                `SELECT id FROM bracket_nodes WHERE public_node_id = ? OR id = ? LIMIT 1`,
                [n, n]
              );
              nextLocal = found[0]?.id || null;
            }
          }

          if (nextLocal) {
            await connection.query(
              `UPDATE bracket_nodes SET next_node_id = ?, updated_at = NOW() WHERE id = ?`,
              [nextLocal, localNodeId]
            );
          }
        } catch (linkErr) {
          console.error(`[sync-api] next_node link failed for node ${localNodeId}:`, linkErr.message);
          warnings.push({
            code: "NEXT_NODE_LINK_FAILED",
            message: `Could not link next_node for node id=${localNodeId}: ${linkErr.message}`,
          });
        }
      }
    }

    connection.release();

    stats.success = stats.failed === 0;
    const primaryPublicBracketId =
      latestPublicBracketId ||
      mappings.brackets[0]?.public_bracket_id ||
      latestBracketId ||
      null;
    const primaryProductionId = latestBracketId || mappings.brackets[0]?.id || null;

    const formattedErrors = (stats.errors || []).map((e) => ({
      type: e.entity || e.item || e.type || "unknown",
      item: e.entity || e.item || "unknown",
      public_bracket_id: e.public_bracket_id ?? null,
      public_round_id: e.public_round_id ?? null,
      public_node_id: e.public_node_id ?? null,
      round_no: e.round_no ?? e.round_number ?? null,
      error: e.message || e.error || "unknown",
    }));

    const response = {
      ...stats,
      warnings,
      tournament_id: defaultTournamentId || null,
      tournament_mode_id: defaultModeId || null,
      // Controller-friendly IDs (first-time create must return these)
      id: primaryProductionId,
      public_id: primaryPublicBracketId || primaryProductionId,
      public_bracket_id: primaryPublicBracketId || primaryProductionId,
      data: {
        id: primaryProductionId,
        public_bracket_id: primaryPublicBracketId || primaryProductionId,
        public_id: primaryPublicBracketId || primaryProductionId,
        mappings,
        created: stats.created,
        updated: stats.updated,
        failed: stats.failed,
        errors: formattedErrors,
        warnings,
      },
      mappings,
      errors: formattedErrors,
    };

    console.log(
      `[sync-api] brackets sync received=${stats.received} created=${stats.created} updated=${stats.updated} failed=${stats.failed} public_bracket_id=${response.public_bracket_id}`
    );

    // Partial success → 200 (parent may succeed while some children fail)
    if (stats.created + stats.updated === 0 && stats.failed > 0) {
      const detail = formattedErrors
        .slice(0, 5)
        .map((e) => {
          const who = e.type || "item";
          const idPart = e.round_no || e.public_round_id || e.public_node_id || e.public_bracket_id || "";
          return `${who}${idPart ? `(${idPart})` : ""}: ${e.error}`;
        })
        .join(" | ");

      return res.status(400).json({
        ...response,
        success: false,
        code: "SYNC_FAILED",
        message: detail
          ? `Bracket sync failed for all items. ${detail}`
          : "Bracket sync failed for all items. See errors for details.",
      });
    }

    const partial = stats.failed > 0;
    res.status(200).json({
      ...response,
      success: !partial || stats.created + stats.updated > 0,
      message: partial
        ? `Some child records failed (${stats.failed}). Bracket public_bracket_id=${response.public_bracket_id}`
        : "Bracket sync completed",
    });
  } catch (error) {
    try {
      connection.release();
    } catch (_) {
      /* ignore */
    }
    console.error("[sync-api] /brackets POST error:", error.message, error.stack);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: error.message || "Database error",
      received,
      created: stats.created || 0,
      updated: stats.updated || 0,
      failed: (stats.failed || 0) + 1,
      errors: [
        ...(stats.errors || []).map((e) => ({
          type: e.entity || e.item || "unknown",
          error: e.message || e.error || "unknown",
          round_no: e.round_no ?? null,
        })),
        { type: "server", error: error.message },
      ],
      warnings,
      public_bracket_id: latestPublicBracketId || latestBracketId || null,
      mappings,
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
