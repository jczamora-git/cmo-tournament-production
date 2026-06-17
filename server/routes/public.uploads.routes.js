const express = require("express");
const multer = require("multer");
const { uploadTournamentImage } = require("../services/supabaseStorage");
const db = require("../db");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

const ALLOWED_MIMETYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function makeSafeName(originalname) {
  return originalname
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

router.post("/", upload.single("file"), async (req, res) => {
  console.log("[team-logo-upload] route reached", {
    contentType: req.headers["content-type"],
    origin: req.headers.origin,
  });
  try {
    const [settingRows] = await db.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'team_upload_enabled'"
    );
    if (settingRows.length > 0 && settingRows[0].setting_value === "false") {
      return res.status(403).json({ message: "Team logo upload is currently closed." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid logo file type. Please upload PNG, JPG, or WebP." });
    }

    const { createClient } = require("@supabase/supabase-js");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "jeizi-storage";

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ message: "Storage not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const safeName = makeSafeName(req.file.originalname);
    const date = new Date().toISOString().split("T")[0];
    const filePath = `team-submissions/${date}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error("Team logo upload failed", {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.details,
      });
      return res.status(500).json({ message: "Logo upload failed. Please try again." });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    res.json({ success: true, url: data.publicUrl, path: filePath });
  } catch (error) {
    console.error("Team logo upload error:", error);
    res.status(500).json({ message: "Logo upload failed. Please try again." });
  }
});

module.exports = router;
