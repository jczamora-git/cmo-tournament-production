const dotenv = require("dotenv");

dotenv.config();

const client = String(process.env.DB_CLIENT || "mysql").toLowerCase() === "postgres"
  ? "postgres"
  : "mysql";

const adapter = client === "postgres" ? require("./postgres") : require("./mysql");

module.exports = adapter;
