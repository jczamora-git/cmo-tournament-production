const express = require("express");

const router = express.Router();

router.post("/login", (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({ message: "Admin token not configured" });
  }

  const { token } = req.body;

  if (!token || token !== adminToken) {
    return res.status(401).json({ message: "Invalid admin token" });
  }

  res.json({ success: true, message: "Login successful" });
});

router.get("/verify", (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({ message: "Admin token not configured" });
  }

  const token =
    req.headers["x-admin-token"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token || token !== adminToken) {
    return res.status(401).json({ message: "Invalid token" });
  }

  res.json({ valid: true });
});

module.exports = router;
