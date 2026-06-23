require("dotenv").config();
const db = require("./db");

async function run() {
  try {
    const dbName = process.env.DB_DATABASE || "jeizi_production";
    const sql = `
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
      FROM information_schema.columns 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('players', 'games', 'matches', 'teams', 'tournaments', 'tournament_modes')
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `;
    const [rows] = await db.query(sql, [dbName]);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

run();
