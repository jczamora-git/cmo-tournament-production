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

function buildCorsOptions() {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://www.jeiziproductions.dev",
    "https://jeiziproductions.dev",
    "https://admin.jeiziproductions.dev",
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

  // Public team submission (no auth required)
  app.use("/api/team-submissions", submissionsRoutes);

  // Admin auth routes
  app.use("/api/admin", adminAuthRoutes);

  // Admin protected routes
  app.use("/api/admin/teams", adminTeamsRoutes);
  app.use("/api/admin/matches", adminMatchesRoutes);
  app.use("/api/admin/team-submissions", adminSubmissionsRoutes);

  app.use((error, req, res, next) => {
    console.error("[api error]", error);
    res.status(500).json({
      message: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  });

  return app;
}

module.exports = { createApp };
