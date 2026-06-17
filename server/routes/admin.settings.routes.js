const express = require("express");
const db = require("../db");

const router = express.Router();

// Middleware admin is already applied in createApp.js via app.use("/api/admin", ...) usually
// Or we apply it there, so here we assume req is admin authenticated.

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('team_upload_enabled', 'team_upload_closed_message', 'team_upload_deadline_text')"
    );

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
    console.error("Failed to fetch admin settings", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { team_upload_enabled, team_upload_closed_message, team_upload_deadline_text } = req.body;

    const query = db.client === "postgres" 
      ? "INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()"
      : "INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()";

    await db.query(query, ["team_upload_enabled", team_upload_enabled ? "true" : "false"]);
    await db.query(query, ["team_upload_closed_message", team_upload_closed_message || ""]);
    await db.query(query, ["team_upload_deadline_text", team_upload_deadline_text || ""]);

    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Failed to update admin settings", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

module.exports = router;
