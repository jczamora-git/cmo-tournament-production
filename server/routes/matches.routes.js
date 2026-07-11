const express = require("express");
const db = require("../db");

const router = express.Router();

const MATCHES_SELECT = `
  SELECT 
    m.*,
    blue_team.name AS blue_team_name,
    blue_team.shortname AS blue_team_shortname,
    blue_team.logo AS blue_team_logo,
    red_team.name AS red_team_name,
    red_team.shortname AS red_team_shortname,
    red_team.logo AS red_team_logo
  FROM matches m
  LEFT JOIN teams AS blue_team ON blue_team.id = m.blue_team_id
  LEFT JOIN teams AS red_team ON red_team.id = m.red_team_id
`;

// Public: read-only match endpoints
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `${MATCHES_SELECT} ORDER BY COALESCE(m.queue_order, 999999) ASC, m.id ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch matches", error);
    res.status(500).json({ message: "Failed to fetch matches" });
  }
});

function nestTeams(match) {
  const {
    blue_team_name,
    blue_team_shortname,
    blue_team_logo,
    red_team_name,
    red_team_shortname,
    red_team_logo,
  } = match;

  return {
    ...match,
    blue_team: match.blue_team_id
      ? {
          id: match.blue_team_id,
          name: blue_team_name,
          shortname: blue_team_shortname,
          logo: blue_team_logo,
        }
      : null,
    red_team: match.red_team_id
      ? {
          id: match.red_team_id,
          name: red_team_name,
          shortname: red_team_shortname,
          logo: red_team_logo,
        }
      : null,
  };
}

/** Public schedule: queued + live/active + upcoming (not finished). */
router.get("/upcoming", async (req, res) => {
  try {
    const [rows] = await db.query(
      `${MATCHES_SELECT}
       WHERE LOWER(COALESCE(m.status, 'queued')) NOT IN ('finished', 'done', 'completed', 'cancelled')
       ORDER BY
         CASE LOWER(COALESCE(m.status, 'queued'))
           WHEN 'live' THEN 0
           WHEN 'active' THEN 1
           WHEN 'drafting' THEN 2
           WHEN 'setup' THEN 3
           ELSE 4
         END ASC,
         COALESCE(m.queue_order, 999999) ASC,
         m.id ASC`
    );
    res.json(rows.map(nestTeams));
  } catch (error) {
    console.error("Failed to fetch upcoming matches", error);
    res.status(500).json({ message: "Failed to fetch upcoming matches" });
  }
});

/** Public match history with optional ?q= search. */
router.get("/history", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    let sql = `${MATCHES_SELECT}
       WHERE LOWER(COALESCE(m.status, '')) IN ('finished', 'done', 'completed')`;
    const params = [];

    if (q) {
      const like = `%${q}%`;
      sql += ` AND (
        m.title LIKE ?
        OR blue_team.name LIKE ? OR blue_team.shortname LIKE ?
        OR red_team.name LIKE ? OR red_team.shortname LIKE ?
        OR m.mode LIKE ? OR m.series_format LIKE ?
      )`;
      params.push(like, like, like, like, like, like, like);
    }

    sql += ` ORDER BY m.updated_at DESC, m.id DESC LIMIT 200`;
    const [rows] = await db.query(sql, params);
    res.json(rows.map(nestTeams));
  } catch (error) {
    console.error("Failed to fetch match history", error);
    res.status(500).json({ message: "Failed to fetch match history" });
  }
});

router.get("/bracket", async (req, res) => {
  try {
    const [rows] = await db.query(
      `${MATCHES_SELECT} ORDER BY COALESCE(m.queue_order, 999999) ASC, m.id ASC`
    );
    res.json(rows.map(nestTeams));
  } catch (error) {
    console.error("Failed to fetch bracket", error);
    res.status(500).json({ message: "Failed to fetch bracket" });
  }
});

module.exports = router;
