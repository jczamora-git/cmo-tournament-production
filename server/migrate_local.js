require("dotenv").config();
const db = require("./db");

async function run() {
  try {
    console.log("Applying schema migrations to local MySQL...");

    // 1. Add columns to matches
    try {
      await db.query(`ALTER TABLE matches ADD COLUMN series_completed BOOLEAN DEFAULT false;`);
      console.log("Added series_completed to matches");
    } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.log(e.message); }

    try {
      await db.query(`ALTER TABLE matches ADD COLUMN series_winner_team_id INT DEFAULT NULL;`);
      console.log("Added series_winner_team_id to matches");
    } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.log(e.message); }

    try {
      await db.query(`ALTER TABLE matches ADD COLUMN series_completed_at TIMESTAMP NULL DEFAULT NULL;`);
      console.log("Added series_completed_at to matches");
    } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.log(e.message); }

    try {
      await db.query(`ALTER TABLE matches ADD CONSTRAINT fk_series_winner FOREIGN KEY (series_winner_team_id) REFERENCES teams(id) ON DELETE SET NULL;`);
      console.log("Added foreign key constraint for series_winner_team_id");
    } catch(e) { if(e.code !== 'ER_DUP_KEYNAME') console.log(e.message); }

    // 2. Create players table
    await db.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        ign VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT NULL,
        photo VARCHAR(500) DEFAULT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      );
    `);
    console.log("Ensured players table exists");

    // 3. Create games table
    await db.query(`
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id INT NOT NULL,
        game_no INT NOT NULL,
        winner_team_id INT DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'queued',
        finished_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
        UNIQUE KEY uq_match_game (match_id, game_no)
      );
    `);
    console.log("Ensured games table exists");

    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    if (db.end) await db.end();
    process.exit(0);
  }
}

run();
