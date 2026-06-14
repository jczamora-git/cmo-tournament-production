const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM team_submissions ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch submissions", error);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
});

router.put("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { team_name, shortname, captain_name, contact, logo_url } = req.body;

    const [rows] = await db.query("SELECT * FROM team_submissions WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const submission = rows[0];
    if (submission.status !== "pending") {
      return res.status(400).json({ message: "Submission already processed" });
    }

    const finalName = team_name || submission.team_name;
    const finalShortname = shortname !== undefined ? shortname : submission.shortname;
    const finalLogo = logo_url !== undefined ? logo_url : submission.logo_url;

    // Insert into official teams table
    const insertSql =
      db.client === "postgres"
        ? "INSERT INTO teams (name, shortname, logo) VALUES (?,?,?) RETURNING id"
        : "INSERT INTO teams (name, shortname, logo) VALUES (?,?,?)";
    const [, result] = await db.query(insertSql, [
      finalName,
      finalShortname || null,
      finalLogo || null,
    ]);

    // Update submission status
    await db.query(
      "UPDATE team_submissions SET status = ?, updated_at = NOW() WHERE id = ?",
      ["approved", id]
    );

    res.json({
      message: "Submission approved",
      team_id: result.insertId,
      submission_id: Number(id),
    });
  } catch (error) {
    console.error("Failed to approve submission", error);
    res.status(500).json({ message: "Failed to approve submission" });
  }
});

router.put("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query("SELECT * FROM team_submissions WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (rows[0].status !== "pending") {
      return res.status(400).json({ message: "Submission already processed" });
    }

    await db.query(
      "UPDATE team_submissions SET status = ?, updated_at = NOW() WHERE id = ?",
      ["rejected", id]
    );

    res.json({ message: "Submission rejected", submission_id: Number(id) });
  } catch (error) {
    console.error("Failed to reject submission", error);
    res.status(500).json({ message: "Failed to reject submission" });
  }
});

module.exports = router;
