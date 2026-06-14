const express = require("express");
const db = require("../db");

const router = express.Router();

// Public: read-only match endpoints
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM matches ORDER BY COALESCE(queue_order, 999999) ASC, id ASC"
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
      "SELECT * FROM matches WHERE LOWER(status) IN ('queued', 'upcoming', 'scheduled') ORDER BY COALESCE(queue_order, 999999) ASC, id ASC"
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
      "SELECT * FROM matches WHERE LOWER(status) IN ('finished', 'done', 'completed') ORDER BY updated_at DESC, id DESC"
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
      "SELECT * FROM matches ORDER BY COALESCE(queue_order, 999999) ASC, id ASC"
    );

    const [teams] = await db.query("SELECT id, name, shortname, logo FROM teams");
    const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

    const bracket = rows.map((match) => ({
      ...match,
      blue_team: teamMap[match.blue_team_id] || null,
      red_team: teamMap[match.red_team_id] || null,
    }));

    res.json(bracket);
  } catch (error) {
    console.error("Failed to fetch bracket", error);
    res.status(500).json({ message: "Failed to fetch bracket" });
  }
});

module.exports = router;
