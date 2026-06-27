require("dotenv").config();
const db = require("./db");

async function run() {
  try {
    console.log("Applying teams table migration...");
    
    try {
      await db.query(`ALTER TABLE teams ADD COLUMN captain_name TEXT;`);
      console.log("Added captain_name");
    } catch(e) { console.log(e.message); }

    try {
      await db.query(`ALTER TABLE teams ADD COLUMN contact TEXT;`);
      console.log("Added contact");
    } catch(e) { console.log(e.message); }

    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

run();
