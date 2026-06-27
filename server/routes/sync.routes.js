const express = require("express");
const db = require("../db");
const requireSyncToken = require("../middleware/requireSyncToken");

const router = express.Router();

router.use(requireSyncToken);

function parsePositiveInt(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : null;
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

module.exports = router;
