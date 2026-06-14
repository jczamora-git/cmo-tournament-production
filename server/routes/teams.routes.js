const express = require("express");
const db = require("../db");

const router = express.Router();

// Public: read-only team list
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM teams ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch teams", error);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
});

module.exports = router;
