require("dotenv").config();
const db = require("./db");

async function run() {
  try {
    await db.query(`INSERT IGNORE INTO tournaments (id, name, slug, game_type) VALUES (12, 'T12', 't12', 'fps')`);
    await db.query(`INSERT IGNORE INTO tournament_modes (id, tournament_id, code, name) VALUES (9, 12, 'm9', 'Mode 9')`);
    await db.query(`INSERT IGNORE INTO teams (id, name, tournament_id, tournament_mode_id) VALUES (9991, 'Prod Blue', 12, 9), (9992, 'Prod Red', 12, 9)`);
    console.log("Dummy prod data inserted.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

run();
