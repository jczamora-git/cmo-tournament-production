const express = require("express");
const db = require("../db");

const router = express.Router();

// Public: submit a team (creates pending submission)
router.post("/", async (req, res) => {
  try {
    const [settingRows] = await db.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('team_upload_enabled', 'team_upload_closed_message')"
    );
    
    let isEnabled = true;
    let closedMessage = "Team registration and logo upload are now closed.";
    
    settingRows.forEach(row => {
      if (row.setting_key === "team_upload_enabled") {
        isEnabled = row.setting_value === "true";
      }
      if (row.setting_key === "team_upload_closed_message" && row.setting_value) {
        closedMessage = row.setting_value;
      }
    });

    if (!isEnabled) {
      return res.status(403).json({ message: closedMessage });
    }

    const { team_name, shortname, captain_name, contact, logo_url, notes } = req.body;

    if (!team_name || !team_name.trim()) {
      return res.status(400).json({ message: "Team name is required" });
    }
    if (!captain_name || !captain_name.trim()) {
      return res.status(400).json({ message: "Captain name is required" });
    }
    if (!contact || !contact.trim()) {
      return res.status(400).json({ message: "Contact is required" });
    }

    const insertSql =
      db.client === "postgres"
        ? "INSERT INTO team_submissions (team_name, shortname, captain_name, contact, logo_url, notes, status) VALUES (?,?,?,?,?,?,?) RETURNING id"
        : "INSERT INTO team_submissions (team_name, shortname, captain_name, contact, logo_url, notes, status) VALUES (?,?,?,?,?,?,?)";

    const [, result] = await db.query(insertSql, [
      team_name.trim(),
      shortname?.trim() || null,
      captain_name.trim(),
      contact.trim(),
      logo_url?.trim() || null,
      notes?.trim() || null,
      "pending",
    ]);

    res.status(201).json({
      id: result.insertId,
      message: "Team submitted successfully. Please wait for admin approval.",
    });
  } catch (error) {
    console.error("Failed to submit team", error);
    res.status(500).json({ message: "Failed to submit team" });
  }
});

module.exports = router;
