require('dotenv').config();
const db = require('./server/db');

async function test() {
  try {
    let sql = `SELECT id, name, shortname, captain_name, contact, logo, tournament_id, tournament_mode_id, created_at, updated_at FROM teams WHERE 1=1 LIMIT 1`;
    console.log("Running query:", sql);
    const [rows] = await db.query(sql);
    console.log("Success! Rows:", rows);
  } catch(e) {
    console.error("Query failed:", e);
  } finally {
    process.exit(0);
  }
}
test();
