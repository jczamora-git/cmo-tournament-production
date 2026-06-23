const crypto = require("crypto");

function requireSyncToken(req, res, next) {
  const serverToken = process.env.PRODUCTION_SYNC_TOKEN;

  if (!serverToken) {
    return res.status(503).json({
      success: false,
      code: "CONFIG_ERROR",
      message: "Sync token is not configured on the server.",
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      code: "MISSING_AUTH",
      message: "Missing Authorization header.",
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      code: "MALFORMED_AUTH",
      message: "Malformed Authorization header.",
    });
  }

  const clientToken = parts[1];

  // Timing-safe comparison requires equal length buffers
  const serverBuffer = Buffer.from(serverToken);
  const clientBuffer = Buffer.from(clientToken);

  if (
    serverBuffer.length !== clientBuffer.length ||
    !crypto.timingSafeEqual(serverBuffer, clientBuffer)
  ) {
    return res.status(403).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Invalid sync token.",
    });
  }

  next();
}

module.exports = requireSyncToken;
