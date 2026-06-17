const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('team_upload_enabled', 'team_upload_closed_message', 'team_upload_deadline_text')"
    );

    // Set defaults
    const settings = {
      team_upload_enabled: true,
      team_upload_closed_message: "Team registration and logo upload are now closed.",
      team_upload_deadline_text: "",
    };

    rows.forEach((row) => {
      if (row.setting_key === "team_upload_enabled") {
        settings.team_upload_enabled = row.setting_value === "true";
      } else {
        settings[row.setting_key] = row.setting_value || "";
      }
    });

    res.json(settings);
  } catch (error) {
    console.error("Failed to fetch public settings", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

module.exports = router;
