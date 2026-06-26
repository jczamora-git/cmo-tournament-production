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

router.get("/upcoming", async (req, res) => {
  try {
    const [rows] = await db.query(
      `${MATCHES_SELECT} WHERE LOWER(m.status) IN ('queued', 'upcoming', 'scheduled') ORDER BY COALESCE(m.queue_order, 999999) ASC, m.id ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch upcoming matches", error);
    res.status(500).json({ message: "Failed to fetch upcoming matches" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const [rows] = await db.query(
      `${MATCHES_SELECT} WHERE LOWER(m.status) IN ('finished', 'done', 'completed') ORDER BY m.updated_at DESC, m.id DESC`
    );
    res.json(rows);
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

    // Preserve the nested object contract for bracket endpoint
    const bracket = rows.map((match) => {
      const {
        blue_team_name, blue_team_shortname, blue_team_logo,
        red_team_name, red_team_shortname, red_team_logo,
        ...rest
      } = match;

      return {
        ...match, // keep flat fields for compatibility
        blue_team: match.blue_team_id ? {
          id: match.blue_team_id,
          name: blue_team_name,
          shortname: blue_team_shortname,
          logo: blue_team_logo,
        } : null,
        red_team: match.red_team_id ? {
          id: match.red_team_id,
          name: red_team_name,
          shortname: red_team_shortname,
          logo: red_team_logo,
        } : null,
      };
    });

    res.json(bracket);
  } catch (error) {
    console.error("Failed to fetch bracket", error);
    res.status(500).json({ message: "Failed to fetch bracket" });
  }
});

module.exports = router;
