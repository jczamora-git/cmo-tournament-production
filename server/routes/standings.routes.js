const express = require("express");
const db = require("../db");

const router = express.Router();

function parsePositiveInt(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function toBool(val) {
  if (val === true || val === 1 || val === "1" || val === "true") return true;
  if (val === false || val === 0 || val === "0" || val === "false" || val === null || val === undefined) {
    return false;
  }
  return Boolean(val);
}

/**
 * GET /api/standings/br-group?tournament_id=12&tournament_mode_id=10
 * Public read for Standings pages — grouped by group_name, sorted by total_points DESC.
 *
 * Controller push uses POST /api/sync/standings/br (see sync.routes.js).
 */
router.get("/br-group", async (req, res) => {
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
    const [tournamentRows] = await db.query(
      `SELECT id, name, game_type, season, status FROM tournaments WHERE id = ?`,
      [tId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: `tournament_id ${tId} does not exist`,
      });
    }

    const [modeRows] = await db.query(
      `SELECT id, tournament_id, code, name, competition_type FROM tournament_modes WHERE id = ? AND tournament_id = ?`,
      [mId, tId]
    );
    if (modeRows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: `tournament_mode_id ${mId} not found for tournament_id ${tId}`,
      });
    }

    const tournament = tournamentRows[0];
    const mode = modeRows[0];

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
    let lastUpdated = null;

    for (const row of rows) {
      const key = row.group_name;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          group_name: key,
          standings: [],
        });
      }

      if (row.updated_at) {
        const ts = new Date(row.updated_at).getTime();
        if (!Number.isNaN(ts) && (lastUpdated === null || ts > lastUpdated)) {
          lastUpdated = ts;
        }
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
      tournament: {
        id: tournament.id,
        name: tournament.name,
        game_type: tournament.game_type,
        season: tournament.season || null,
        status: tournament.status || null,
      },
      mode: {
        id: mode.id,
        code: mode.code,
        name: mode.name,
        competition_type: mode.competition_type,
      },
      last_updated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      total_teams: rows.length,
      groups: Array.from(groupMap.values()),
    });
  } catch (error) {
    console.error("[standings] br-group GET error:", error.message);
    res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "Database error",
    });
  }
});

module.exports = router;
