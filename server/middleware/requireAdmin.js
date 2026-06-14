function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({ message: "Admin token not configured" });
  }

  const token =
    req.headers["x-admin-token"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token || token !== adminToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

module.exports = requireAdmin;
