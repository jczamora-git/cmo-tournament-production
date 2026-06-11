const express = require("express");
const cors = require("cors");
const path = require("path");

const teamsRoutes = require("./routes/teams.routes");
const matchesRoutes = require("./routes/matches.routes");

function buildCorsOptions() {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  };
}

function createApp({ restrictedCors = false } = {}) {
  const app = express();

  app.use(cors(restrictedCors ? buildCorsOptions() : undefined));
  app.use(express.json());
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "jeizi-production-api",
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.use("/api/teams", teamsRoutes);
  app.use("/api/matches", matchesRoutes);

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
