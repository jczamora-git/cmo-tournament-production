const express = require("express");
const cors = require("cors");
const path = require("path");

const teamsRoutes = require("./routes/teams.routes");
const matchesRoutes = require("./routes/matches.routes");
const submissionsRoutes = require("./routes/submissions.routes");
const adminAuthRoutes = require("./routes/admin.auth.routes");
const adminTeamsRoutes = require("./routes/admin.teams.routes");
const adminMatchesRoutes = require("./routes/admin.matches.routes");
const adminSubmissionsRoutes = require("./routes/admin.submissions.routes");
const liveSettingsRoutes = require("./routes/live.routes");
const adminLiveSettingsRoutes = require("./routes/admin.live.routes");
const tournamentsRoutes = require("./routes/tournaments.routes");
const videosRoutes = require("./routes/videos.routes");
const adminTournamentsRoutes = require("./routes/admin.tournaments.routes");
const adminVideosRoutes = require("./routes/admin.videos.routes");
const adminUploadsRoutes = require("./routes/admin.uploads.routes");
const publicUploadsRoutes = require("./routes/public.uploads.routes");
const publicSettingsRoutes = require("./routes/public.settings.routes");
const adminSettingsRoutes = require("./routes/admin.settings.routes");

function buildCorsOptions() {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://www.jeiziproductions.dev",
    "https://jeiziproductions.dev",
    "https://admin.jeiziproductions.dev",
    "https://www.jeiziproductions.app",
    "https://jeiziproductions.app",
    "https://jeiziproduction.vercel.app",
    "https://adminjeizi.vercel.app",
    "https://jeizi-overlay-v2.vercel.app",
    "https://www.cmotournaments.live",
    "https://cmotournaments.live",
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
  ].filter(Boolean);

  // Deduplicate
  const uniqueOrigins = [...new Set(allowedOrigins)];

  return {
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin || uniqueOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-token"],
    credentials: true,
  };
}

function createApp({ restrictedCors = false } = {}) {
  const app = express();

  const corsOptions = restrictedCors ? buildCorsOptions() : undefined;
  app.use(cors(corsOptions));

  // Explicitly handle OPTIONS preflight so it never falls through to error handlers
  app.options("*", cors(corsOptions));

  app.use(express.json());
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "jeizi-production-api",
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Public read-only routes
  app.use("/api/teams", teamsRoutes);
  app.use("/api/matches", matchesRoutes);
  app.use("/api/live-settings", liveSettingsRoutes);
  app.use("/api/tournaments", tournamentsRoutes);
  app.use("/api/videos", videosRoutes);

  // Public settings
  app.use("/api/public-settings", publicSettingsRoutes);

  // Public team submission (no auth required)
  app.use("/api/team-submissions", submissionsRoutes);

  // Public team logo upload (no auth required)
  app.use("/api/uploads/team-logo", publicUploadsRoutes);

  // Admin auth routes
  app.use("/api/admin", adminAuthRoutes);

  // Admin protected routes
  app.use("/api/admin/teams", adminTeamsRoutes);
  app.use("/api/admin/matches", adminMatchesRoutes);
  app.use("/api/admin/team-submissions", adminSubmissionsRoutes);
  app.use("/api/admin/live-settings", adminLiveSettingsRoutes);
  app.use("/api/admin/tournaments", adminTournamentsRoutes);
  app.use("/api/admin/videos", adminVideosRoutes);
  app.use("/api/admin/uploads/tournament-image", adminUploadsRoutes);
  app.use("/api/admin/registration-settings", adminSettingsRoutes);

  app.use((error, req, res, next) => {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "Logo file is too large. Please upload an image under 3MB.",
      });
    }
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({
        message: "Invalid logo file type. Please upload PNG, JPG, or WebP.",
      });
    }
    console.error("[api error]", error);
    res.status(500).json({
      message: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  });

  return app;
}

module.exports = { createApp };
