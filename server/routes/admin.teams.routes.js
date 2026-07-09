const path = require("path");
const express = require("express");
const db = require("../db");
const requireAdmin = require("../middleware/requireAdmin");
const { storageDriver, uploadTeamLogo } = require("../middleware/upload");
const { uploadImage } = require("../services/storage");

const router = express.Router();

router.use(requireAdmin);

function getInsertedId(queryResult, client) {
  const [rowsOrResult, meta] = queryResult;

  if (client === "postgres") {
    return rowsOrResult?.[0]?.id ?? meta?.insertId ?? null;
  }

  return rowsOrResult?.insertId ?? null;
}

router.get("/", async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  try {
    const { tournament_id, tournament_mode_id } = req.query;

    let query = `
      SELECT 
        t.id, t.name, t.shortname, t.captain_name, t.contact, t.logo, 
        t.tournament_id, t.tournament_mode_id, t.created_at, t.updated_at,
        tn.name AS tournament_name,
        tm.name AS mode_name,
        tm.code AS mode_code
      FROM teams t
      LEFT JOIN tournaments tn ON t.tournament_id = tn.id
      LEFT JOIN tournament_modes tm ON t.tournament_mode_id = tm.id
    `;
    const conditions = [];
    const params = [];

    if (tournament_id) {
      conditions.push(db.client === "postgres" ? `t.tournament_id = $${params.length + 1}` : "t.tournament_id = ?");
      params.push(tournament_id);
    }
    if (tournament_mode_id) {
      conditions.push(db.client === "postgres" ? `t.tournament_mode_id = $${params.length + 1}` : "t.tournament_mode_id = ?");
      params.push(tournament_mode_id);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY t.name ASC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch teams", error);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
});

router.post("/", uploadTeamLogo.single("logo"), async (req, res) => {
  try {
    const { name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Team name is required" });
    }

    // Require tournament and mode for new teams
    if (!tournament_id || !tournament_mode_id) {
      return res.status(400).json({ message: "Tournament and mode are required for new teams." });
    }

    // Validate tournament exists
    const [tRows] = await db.query("SELECT id, is_active FROM tournaments WHERE id = ?", [tournament_id]);
    if (!tRows.length) {
      return res.status(400).json({ message: "Tournament not found." });
    }

    // Validate mode exists, belongs to tournament, and is active
    const [mRows] = await db.query("SELECT id, tournament_id, is_active FROM tournament_modes WHERE id = ?", [tournament_mode_id]);
    if (!mRows.length) {
      return res.status(400).json({ message: "Tournament mode not found." });
    }
    if (String(mRows[0].tournament_id) !== String(tournament_id)) {
      return res.status(400).json({ message: "Tournament mode does not belong to the selected tournament." });
    }
    if (!mRows[0].is_active) {
      return res.status(400).json({ message: "Tournament mode is not active." });
    }

    let logoPath = logo || null;

    if (req.file) {
      if (storageDriver === "local") {
        logoPath = `/uploads/teams/${req.file.filename}`;
      } else {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `team_logo_${Date.now()}${ext}`;
        const result = await uploadImage({
          file: req.file.buffer,
          folder: "teams",
          filename,
          mimetype: req.file.mimetype,
        });
        logoPath = result.url;
      }
    }

    const insertSql =
      db.client === "postgres"
        ? "INSERT INTO teams (name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id) VALUES (?,?,?,?,?,?,?) RETURNING id"
        : "INSERT INTO teams (name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id) VALUES (?,?,?,?,?,?,?)";
    
    const queryResult = await db.query(insertSql, [name, shortname || null, captain_name || null, contact || null, logoPath, tournament_id, tournament_mode_id]);
    const insertedId = getInsertedId(queryResult, db.client);

    if (!insertedId) {
      throw new Error(`Team insert did not return an ID for ${db.client}.`);
    }

    res.status(201).json({
      success: true,
      message: "Team created successfully.",
      team: {
        id: insertedId,
        name,
        shortname: shortname || null,
        logo: logoPath,
        tournament_id: Number(tournament_id),
        tournament_mode_id: Number(tournament_mode_id),
      }
    });
  } catch (error) {
    const isProduction = process.env.NODE_ENV === "production";
    console.error("Failed to create team", {
      client: db.client,
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      stack: error.stack
    });
    res.status(500).json({ 
      message: "Failed to create team",
      ...(!isProduction && {
        code: error.code || null,
        error: error.sqlMessage || error.message
      })
    });
  }
});

router.put("/:id", uploadTeamLogo.single("logo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id } = req.body;

    // Validate tournament/mode relationship if provided
    if (tournament_id && tournament_mode_id) {
      const [mRows] = await db.query("SELECT id, tournament_id, is_active FROM tournament_modes WHERE id = ?", [tournament_mode_id]);
      if (!mRows.length) {
        return res.status(400).json({ message: "Tournament mode not found." });
      }
      if (String(mRows[0].tournament_id) !== String(tournament_id)) {
        return res.status(400).json({ message: "Tournament mode does not belong to the selected tournament." });
      }
    }

    let nextLogo = null;
    const hasLogoField = Object.prototype.hasOwnProperty.call(req.body, "logo");

    if (req.file) {
      if (storageDriver === "local") {
        nextLogo = `/uploads/teams/${req.file.filename}`;
      } else {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `team_logo_${Date.now()}${ext}`;
        const result = await uploadImage({
          file: req.file.buffer,
          folder: "teams",
          filename,
          mimetype: req.file.mimetype,
        });
        nextLogo = result.url;
      }
    } else if (hasLogoField) {
      nextLogo = logo || null;
    } else {
      const [rows] = await db.query("SELECT logo FROM teams WHERE id = ?", [id]);
      nextLogo = rows[0]?.logo ?? null;
    }

    // Get existing team to preserve tournament/mode if not provided
    const [existingRows] = await db.query("SELECT tournament_id, tournament_mode_id FROM teams WHERE id = ?", [id]);
    const existing = existingRows[0] || {};

    const finalTournamentId = tournament_id !== undefined ? (tournament_id || null) : existing.tournament_id;
    const finalModeId = tournament_mode_id !== undefined ? (tournament_mode_id || null) : existing.tournament_mode_id;

    await db.query(
      "UPDATE teams SET name = ?, shortname = ?, captain_name = ?, contact = ?, logo = ?, tournament_id = ?, tournament_mode_id = ? WHERE id = ?",
      [name, shortname || null, captain_name || null, contact || null, nextLogo, finalTournamentId, finalModeId, id]
    );

    res.json({ id: Number(id), name, shortname: shortname || null, logo: nextLogo, tournament_id: finalTournamentId, tournament_mode_id: finalModeId });
  } catch (error) {
    console.error("Failed to update team", error);
    res.status(500).json({ message: "Failed to update team" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT id FROM teams WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Team not found" });
    }

    await db.query("DELETE FROM teams WHERE id = ?", [id]);
    res.json({ id: Number(id), deleted: true });
  } catch (error) {
    console.error("Failed to delete team", error);
    res.status(500).json({ message: "Failed to delete team" });
  }
});

router.post("/:id/normalize-logo", async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution = 512, margin = 90, background = "transparent" } = req.body;

    const [rows] = await db.query("SELECT * FROM teams WHERE id = ?", [id]);
    if (!rows.length) {
      return res.status(404).json({ message: "Team not found." });
    }
    
    const team = rows[0];
    if (!team.logo) {
      return res.status(400).json({ message: "Team does not have a logo to normalize." });
    }

    const { localUploadsDir, uploadImage, storageDriver } = require("../services/storage");
    const sharp = require("sharp");
    const fs = require("fs");

    // Resolve URL/path to buffer
    let imageBuffer;
    const logoUrl = team.logo;

    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const fetchResponse = await fetch(logoUrl);
      if (!fetchResponse.ok) {
        return res.status(400).json({ message: "Failed to download current team logo from storage." });
      }
      imageBuffer = Buffer.from(await fetchResponse.arrayBuffer());
    } else {
      // Relative path: e.g. /uploads/teams/filename.png
      const filename = path.basename(logoUrl);
      const localPath = path.join(localUploadsDir, "teams", filename);
      if (!fs.existsSync(localPath)) {
        return res.status(400).json({ message: `Local logo file not found at path: ${localPath}` });
      }
      imageBuffer = fs.readFileSync(localPath);
    }

    // Process image using sharp
    const img = sharp(imageBuffer);
    const metadata = await img.metadata();
    const width = metadata.width;
    const height = metadata.height;

    // Calculate dimensions
    const maxBoundingSize = resolution * (margin / 100);
    const widthRatio = maxBoundingSize / width;
    const heightRatio = maxBoundingSize / height;
    const finalScale = Math.min(widthRatio, heightRatio);

    const resizeWidth = Math.round(width * finalScale);
    const resizeHeight = Math.round(height * finalScale);

    const padLeft = Math.floor((resolution - resizeWidth) / 2);
    const padTop = Math.floor((resolution - resizeHeight) / 2);
    const padRight = resolution - resizeWidth - padLeft;
    const padBottom = resolution - resizeHeight - padTop;

    // Background color parsing
    let bg = { r: 0, g: 0, b: 0, alpha: 0 };
    if (background === "match") {
      // Sample top-left corner pixel
      const corner = await sharp(imageBuffer).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
      const r = corner[0];
      const g = corner[1];
      const b = corner[2];
      const a = corner[3];
      if (a !== undefined && a < 10) {
        bg = { r: 0, g: 0, b: 0, alpha: 0 };
      } else {
        bg = { r, g, b, alpha: a !== undefined ? a / 255 : 1 };
      }
    } else if (background !== "transparent") {
      bg = background;
    }

    const resizedLogoBuffer = await sharp(imageBuffer)
      .resize(resizeWidth, resizeHeight)
      .toBuffer();

    const processedBuffer = await sharp(resizedLogoBuffer)
      .extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: bg
      })
      .png()
      .toBuffer();

    // Upload processed logo
    const ext = ".png";
    const filename = `team_logo_normalized_${Date.now()}${ext}`;
    let nextLogoPath;

    if (storageDriver === "local") {
      const destDir = path.join(localUploadsDir, "teams");
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, filename), processedBuffer);
      nextLogoPath = `/uploads/teams/${filename}`;
    } else {
      const result = await uploadImage({
        file: processedBuffer,
        folder: "teams",
        filename,
        mimetype: "image/png"
      });
      nextLogoPath = result.url;
    }

    // Update team in database
    await db.query("UPDATE teams SET logo = ? WHERE id = ?", [nextLogoPath, id]);

    res.json({
      success: true,
      logoUrl: nextLogoPath,
      message: "Logo normalized and updated successfully."
    });
  } catch (error) {
    console.error("Failed to normalize logo on backend", error);
    res.status(500).json({ message: "Failed to normalize logo: " + error.message });
  }
});

module.exports = router;
