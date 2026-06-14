const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM app_settings WHERE setting_key IN ('facebook_live_url', 'is_live_enabled')");
    
    // Default values
    const settings = {
      facebook_live_url: "",
      is_live_enabled: false
    };

    rows.forEach(row => {
      if (row.setting_key === 'facebook_live_url') {
        settings.facebook_live_url = row.setting_value;
      }
      if (row.setting_key === 'is_live_enabled') {
        settings.is_live_enabled = row.setting_value === 'true' || row.setting_value === '1';
      }
    });

    res.json(settings);
  } catch (error) {
    console.error("Failed to fetch live settings", error);
    res.status(500).json({ message: "Failed to fetch live settings" });
  }
});

module.exports = router;
