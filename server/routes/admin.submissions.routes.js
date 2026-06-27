const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const { tournament_id, tournament_mode_id, status: statusFilter } = req.query;

    let query = `
      SELECT ts.*,
        tn.name AS tournament_name,
        tn.game_type AS tournament_game_type,
        tm.name AS mode_name,
        tm.code AS mode_code
      FROM team_submissions ts
      LEFT JOIN tournaments tn ON ts.tournament_id = tn.id
      LEFT JOIN tournament_modes tm ON ts.tournament_mode_id = tm.id
    `;
    const conditions = [];
    const params = [];

    if (tournament_id) {
      conditions.push(db.client === "postgres" ? `ts.tournament_id = $${params.length + 1}` : "ts.tournament_id = ?");
      params.push(tournament_id);
    }
    if (tournament_mode_id) {
      conditions.push(db.client === "postgres" ? `ts.tournament_mode_id = $${params.length + 1}` : "ts.tournament_mode_id = ?");
      params.push(tournament_mode_id);
    }
    if (statusFilter) {
      conditions.push(db.client === "postgres" ? `ts.status = $${params.length + 1}` : "ts.status = ?");
      params.push(statusFilter);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY ts.created_at DESC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch submissions", error);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
});

router.put("/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { team_name, shortname, captain_name, contact, logo_url } = req.body;

  const conn = await db.getConnection();
  try {
    if (conn.beginTransaction) await conn.beginTransaction();

    // Load the pending submission
    const [rows] = await conn.query("SELECT * FROM team_submissions WHERE id = ?", [id]);
    if (!rows.length) {
      if (conn.rollback) await conn.rollback();
      return res.status(404).json({ message: "Submission not found" });
    }

    const submission = rows[0];

    // Idempotency: if already approved with a team, return existing
    if (submission.status === "approved" && submission.approved_team_id) {
      if (conn.rollback) await conn.rollback();
      return res.json({
        message: "Submission already approved",
        team_id: submission.approved_team_id,
        submission_id: Number(id),
      });
    }

    if (submission.status !== "pending") {
      if (conn.rollback) await conn.rollback();
      return res.status(400).json({ message: "Submission already processed" });
    }

    const finalName = team_name || submission.team_name;
    const finalShortname = shortname !== undefined ? shortname : submission.shortname;
    const finalCaptain = captain_name !== undefined ? captain_name : submission.captain_name;
    const finalContact = contact !== undefined ? contact : submission.contact;
    const finalLogo = logo_url !== undefined ? logo_url : submission.logo_url;
    const finalTournamentId = submission.tournament_id || null;
    const finalModeId = submission.tournament_mode_id || null;

    // Validate tournament/mode if present
    if (finalTournamentId && finalModeId) {
      const [mRows] = await conn.query("SELECT id, tournament_id FROM tournament_modes WHERE id = ?", [finalModeId]);
      if (mRows.length && String(mRows[0].tournament_id) !== String(finalTournamentId)) {
        if (conn.rollback) await conn.rollback();
        return res.status(400).json({ message: "Tournament mode does not belong to the submission's tournament." });
      }
    }

    // Insert into official teams table
    let teamId;
    if (db.client === "postgres") {
      const [teamRows] = await conn.query(
        "INSERT INTO teams (name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id) VALUES (?,?,?,?,?,?,?) RETURNING id",
        [finalName, finalShortname || null, finalCaptain || null, finalContact || null, finalLogo || null, finalTournamentId, finalModeId]
      );
      teamId = teamRows[0].id;
    } else {
      const [, result] = await conn.query(
        "INSERT INTO teams (name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id) VALUES (?,?,?,?,?,?,?)",
        [finalName, finalShortname || null, finalCaptain || null, finalContact || null, finalLogo || null, finalTournamentId, finalModeId]
      );
      teamId = result.insertId;
    }

    // Update submission status and link to approved team
    await conn.query(
      "UPDATE team_submissions SET status = ?, approved_team_id = ?, updated_at = NOW() WHERE id = ?",
      ["approved", teamId, id]
    );

    if (conn.commit) await conn.commit();

    res.json({
      message: "Submission approved",
      team_id: teamId,
      submission_id: Number(id),
    });
  } catch (error) {
    if (conn.rollback) await conn.rollback();
    console.error("Failed to approve submission", error);
    res.status(500).json({ message: "Failed to approve submission" });
  } finally {
    if (conn.release) conn.release();
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
