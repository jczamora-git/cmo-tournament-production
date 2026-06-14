const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM app_settings WHERE setting_key IN ('facebook_live_url', 'is_live_enabled')");
    
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

router.put("/", async (req, res) => {
  const { facebook_live_url, is_live_enabled } = req.body;
  
  try {
    if (db.client === "postgres") {
      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `, ['facebook_live_url', facebook_live_url || '']);
      
      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `, ['is_live_enabled', is_live_enabled ? 'true' : 'false']);
    } else {
      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, ['facebook_live_url', facebook_live_url || '']);
      
      await db.query(`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, ['is_live_enabled', is_live_enabled ? 'true' : 'false']);
    }

    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Failed to update live settings", error);
    res.status(500).json({ message: "Failed to update live settings" });
  }
});

module.exports = router;
