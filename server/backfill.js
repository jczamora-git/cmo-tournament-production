require("dotenv").config();
const db = require("./db");

async function run() {
  try {
    console.log("Applying backfill for captain and contact from submissions...");
    
    const sql = `
      UPDATE teams t
      SET captain_name = s.captain_name,
          contact = s.contact
      FROM team_submissions s
      WHERE t.id = s.approved_team_id
        AND s.approved_team_id IS NOT NULL
        AND s.status = 'approved'
        AND (t.captain_name IS NULL OR t.contact IS NULL);
    `;

    // Postgres syntax. For mysql it would be:
    // UPDATE teams t JOIN team_submissions s ON t.id = s.approved_team_id SET t.captain_name = s.captain_name, t.contact = s.contact WHERE s.status = 'approved';

    const query = db.client === "postgres" ? sql : `
      UPDATE teams t 
      JOIN team_submissions s ON t.id = s.approved_team_id 
      SET t.captain_name = s.captain_name, t.contact = s.contact 
      WHERE s.status = 'approved' AND s.approved_team_id IS NOT NULL AND (t.captain_name IS NULL OR t.contact IS NULL);
    `;

    const [result] = await db.query(query);
    console.log("Backfill complete. Result:", result);

  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

run();
