const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(requireAdmin);

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

router.post("/", async (req, res) => {
  try {
    const { match_no, blue_team_id, red_team_id, mode, title, queue_order, status } = req.body;

    if (!blue_team_id || !red_team_id) {
      return res.status(400).json({ message: "Blue Team and Red Team are required" });
    }

    if (String(blue_team_id) === String(red_team_id)) {
      return res.status(400).json({ message: "Blue Team and Red Team must differ" });
    }

    let finalMatchNo = match_no;
    if (!finalMatchNo) {
      const [rows] = await db.query(
        "SELECT COALESCE(MAX(match_no), 0) + 1 AS next_match_no FROM matches"
      );
      finalMatchNo = rows[0]?.next_match_no || 1;
    }

    let finalQueueOrder = queue_order;
    if (!finalQueueOrder && finalQueueOrder !== 0) {
      const [rows] = await db.query(
        "SELECT COALESCE(MAX(queue_order), 0) + 1 AS next_queue_order FROM matches"
      );
      finalQueueOrder = rows[0]?.next_queue_order || 1;
    }

    const insertSql =
      db.client === "postgres"
        ? "INSERT INTO matches (match_no, blue_team_id, red_team_id, mode, title, queue_order, blue_score, red_score, status) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id"
        : "INSERT INTO matches (match_no, blue_team_id, red_team_id, mode, title, queue_order, blue_score, red_score, status) VALUES (?,?,?,?,?,?,?,?,?)";

    const [, result] = await db.query(insertSql, [
      finalMatchNo,
      blue_team_id,
      red_team_id,
      mode || "BO3",
      title || "Match",
      finalQueueOrder,
      0,
      0,
      status || "queued",
    ]);

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Failed to create match", error);
    res.status(500).json({ message: "Failed to create match" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { match_no, blue_team_id, red_team_id, mode, title, queue_order, blue_score, red_score, status } = req.body;

    const [rows] = await db.query("SELECT * FROM matches WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Match not found" });
    }

    const existing = rows[0];
    await db.query(
      "UPDATE matches SET match_no = ?, blue_team_id = ?, red_team_id = ?, mode = ?, title = ?, queue_order = ?, blue_score = ?, red_score = ?, status = ? WHERE id = ?",
      [
        match_no ?? existing.match_no,
        blue_team_id ?? existing.blue_team_id,
        red_team_id ?? existing.red_team_id,
        mode ?? existing.mode,
        title ?? existing.title,
        queue_order ?? existing.queue_order,
        blue_score ?? existing.blue_score,
        red_score ?? existing.red_score,
        status ?? existing.status,
        id,
      ]
    );

    res.json({ id: Number(id) });
  } catch (error) {
    console.error("Failed to update match", error);
    res.status(500).json({ message: "Failed to update match" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT id FROM matches WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Match not found" });
    }

    await db.query("DELETE FROM matches WHERE id = ?", [id]);
    res.json({ id: Number(id), deleted: true });
  } catch (error) {
    console.error("Failed to delete match", error);
    res.status(500).json({ message: "Failed to delete match" });
  }
});

module.exports = router;
