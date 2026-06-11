const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || process.env.DB_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQL_USER || process.env.DB_USER || "root",
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "jeizi_production",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = {
  client: "mysql",
  query(sql, params) {
    return pool.query(sql, params);
  },
  async getConnection() {
    return pool.getConnection();
  },
  async ping() {
    const connection = await pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  },
  end() {
    return pool.end();
  },
};
