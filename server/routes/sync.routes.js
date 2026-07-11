const express = require("express");
const db = require("../db");
const requireSyncToken = require("../middleware/requireSyncToken");

const router = express.Router();

router.use(requireSyncToken);

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
    queue_order
  } = req.body;

  const tId = parsePositiveInt(tournament_id);
  const mId = parsePositiveInt(tournament_mode_id);

  if (!tId || !mId) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Valid tournament_id and tournament_mode_id are required" });
  }

  const connection = await db.getConnection();
  try {
    const [modeRows] = await connection.query(`SELECT competition_type FROM tournament_modes WHERE id = ? AND tournament_id = ?`, [mId, tId]);
    if (modeRows.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, code: "CONTEXT_MISMATCH", message: "Tournament mode does not match tournament" });
    }
    const compType = modeRows[0].competition_type;

    let bId = parsePositiveInt(blue_team_id);
    let rId = parsePositiveInt(red_team_id);

    if (compType === "head_to_head") {
      if (!bId || !rId) {
        connection.release();
        return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Both blue_team_id and red_team_id are required for head_to_head" });
      }
      if (bId === rId) {
        connection.release();
        return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Teams must be different" });
      }
      
      const [teams] = await connection.query(`SELECT id, tournament_id, tournament_mode_id FROM teams WHERE id IN (?, ?)`, [bId, rId]);
      if (teams.length !== 2) {
        connection.release();
        return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "One or both teams do not exist" });
      }
      for (const t of teams) {
        if (t.tournament_id !== tId || t.tournament_mode_id !== mId) {
          connection.release();
          return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Teams do not belong to the requested tournament mode" });
        }
      }
    } else {
      bId = bId || null;
      rId = rId || null;
    }

    const validStatuses = ["queued", "active", "live", "finished", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      connection.release();
      return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid status" });
    }

    await connection.beginTransaction();
    const insertSql = `
      INSERT INTO matches (match_no, blue_team_id, red_team_id, mode, title, queue_order, blue_score, red_score, status, series_completed, series_winner_team_id, series_completed_at, tournament_id, tournament_mode_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      parsePositiveInt(match_no) || 1,
      bId,
      rId,
      mode || "BO3",
      title || "Match",
      parsePositiveInt(queue_order) || 1,
      parsePositiveInt(blue_score) || 0,
      parsePositiveInt(red_score) || 0,
      status || "queued",
      series_completed === true ? 1 : 0,
      parsePositiveInt(series_winner_team_id) || null,
      series_completed_at || null,
      tId,
      mId
    ];

    // NOTE: pg node module supports RETURNING id natively in the query wrapper if we use Postgres, but the wrapper automatically handles insertId.
    const [result, meta] = await connection.query(insertSql, params);
    const newId = meta.insertId || (result[0] && result[0].id);

    await connection.commit();
    connection.release();

    console.log(`[sync-api] match created id=${newId} tournament=${tId} mode=${mId}`);
    res.json({ success: true, id: newId, data: { id: newId } });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("[sync-api] /matches POST error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 10. PUT /api/sync/matches/:id
router.put("/matches/:id", async (req, res) => {
  const matchId = parsePositiveInt(req.params.id);
  if (!matchId) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid match ID" });

  const body = req.body;
  const updates = [];
  const params = [];

  const allowList = [
    "match_no", "blue_team_id", "red_team_id", "mode", "title",
    "queue_order", "blue_score", "red_score", "status",
    "series_completed", "series_winner_team_id", "series_completed_at",
    "tournament_id", "tournament_mode_id"
  ];

  for (const field of allowList) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field] === null ? null : (field.includes("id") || field.includes("no") || field.includes("score") || field.includes("order") ? parsePositiveInt(body[field]) || (body[field] === 0 ? 0 : null) : body[field]));
    }
  }

  if (updates.length === 0) {
    return res.json({ success: true, id: matchId, data: { id: matchId } });
  }

  updates.push(`updated_at = NOW()`);
  params.push(matchId);

  const sql = `UPDATE matches SET ${updates.join(", ")} WHERE id = ?`;

  try {
    const [result, meta] = await db.query(sql, params);
    if (meta.affectedRows === 0) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Match not found" });
    }
    console.log(`[sync-api] match updated id=${matchId}`);
    res.json({ success: true, id: matchId, data: { id: matchId } });
  } catch (error) {
    console.error("[sync-api] /matches/:id PUT error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 11. POST /api/sync/games
router.post("/games", async (req, res) => {
  const { match_id, game_no, winner_team_id, status, finished_at } = req.body;

  const mId = parsePositiveInt(match_id);
  const gNo = parsePositiveInt(game_no);

  if (!mId || !gNo) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Valid match_id and game_no are required" });
  }

  const validStatuses = ["queued", "active", "live", "finished", "cancelled"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid status" });
  }

  const connection = await db.getConnection();
  try {
    const [matchRows] = await connection.query(`SELECT id, blue_team_id, red_team_id FROM matches WHERE id = ?`, [mId]);
    if (matchRows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Match not found" });
    }
    const match = matchRows[0];

    const wId = parsePositiveInt(winner_team_id);
    if (wId) {
      // For head-to-head, winner must be one of the teams
      if (match.blue_team_id && match.red_team_id) {
        if (wId !== match.blue_team_id && wId !== match.red_team_id) {
          connection.release();
          return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Winner must be one of the match teams" });
        }
      } else {
        // Just verify team exists
        const [teamRows] = await connection.query(`SELECT id FROM teams WHERE id = ?`, [wId]);
        if (teamRows.length === 0) {
          connection.release();
          return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Winner team does not exist" });
        }
      }
    }

    await connection.beginTransaction();
    const insertSql = `
      INSERT INTO games (match_id, game_no, winner_team_id, status, finished_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [
      mId,
      gNo,
      wId || null,
      status || "queued",
      finished_at || null
    ];

    let result, meta;
    try {
      [result, meta] = await connection.query(insertSql, params);
    } catch (dbErr) {
      if (dbErr.code === 'ER_DUP_ENTRY' || dbErr.message.includes('unique constraint') || dbErr.message.includes('Duplicate entry')) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ success: false, code: "DUPLICATE_GAME", message: "Game already exists for this match and number" });
      }
      throw dbErr;
    }

    const newId = meta.insertId || (result[0] && result[0].id);
    await connection.commit();
    connection.release();

    console.log(`[sync-api] game created id=${newId} match=${mId} no=${gNo}`);
    res.json({ success: true, id: newId, data: { id: newId } });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("[sync-api] /games POST error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
  }
});

// 12. PUT /api/sync/games/:id
router.put("/games/:id", async (req, res) => {
  const gameId = parsePositiveInt(req.params.id);
  if (!gameId) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid game ID" });

  const body = req.body;
  const updates = [];
  const params = [];

  // Match ID should generally not be changed, but allowList can support it if needed
  const allowList = ["game_no", "winner_team_id", "status", "finished_at"];

  for (const field of allowList) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === "winner_team_id" || field === "game_no") {
        params.push(parsePositiveInt(body[field]) || null);
      } else {
        params.push(body[field]);
      }
    }
  }

  if (updates.length === 0) {
    return res.json({ success: true, id: gameId, data: { id: gameId } });
  }

  updates.push(`updated_at = NOW()`);
  params.push(gameId);

  const sql = `UPDATE games SET ${updates.join(", ")} WHERE id = ?`;

  try {
    const [result, meta] = await db.query(sql, params);
    if (meta.affectedRows === 0) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Game not found" });
    }
    console.log(`[sync-api] game updated id=${gameId}`);
    res.json({ success: true, id: gameId, data: { id: gameId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('unique constraint') || error.message.includes('Duplicate entry')) {
      return res.status(409).json({ success: false, code: "DUPLICATE_GAME", message: "Game already exists for this match and number" });
    }
    console.error("[sync-api] /games/:id PUT error:", error.message);
    res.status(500).json({ success: false, code: "DATABASE_ERROR", message: "Database error" });
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
