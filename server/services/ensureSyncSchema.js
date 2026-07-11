const db = require("../db");

let ensured = false;
let ensuring = null;

/**
 * Ensure columns/tables needed for Controller → production sync exist.
 * Safe to call multiple times (cached after first success).
 */
async function ensureSyncSchema(connection = db) {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    if (db.client === "postgres") {
      await connection.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS public_match_id INTEGER`);
      await connection.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS public_game_id INTEGER`);
      await connection.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_public_match_id
        ON matches (public_match_id) WHERE public_match_id IS NOT NULL
      `);
      await connection.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_games_public_game_id
        ON games (public_game_id) WHERE public_game_id IS NOT NULL
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS brackets (
          id SERIAL PRIMARY KEY,
          public_bracket_id INTEGER UNIQUE,
          tournament_id INTEGER NOT NULL,
          tournament_mode_id INTEGER NOT NULL,
          name VARCHAR(255) DEFAULT 'Bracket',
          bracket_type VARCHAR(50) DEFAULT 'single_elimination',
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS bracket_rounds (
          id SERIAL PRIMARY KEY,
          public_round_id INTEGER UNIQUE,
          bracket_id INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
          public_bracket_id INTEGER,
          name VARCHAR(255),
          round_number INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS bracket_nodes (
          id SERIAL PRIMARY KEY,
          public_node_id INTEGER UNIQUE,
          bracket_id INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
          round_id INTEGER REFERENCES bracket_rounds(id) ON DELETE SET NULL,
          public_bracket_id INTEGER,
          public_round_id INTEGER,
          public_match_id INTEGER,
          match_id INTEGER,
          position INTEGER DEFAULT 0,
          blue_team_id INTEGER,
          red_team_id INTEGER,
          winner_team_id INTEGER,
          next_public_node_id INTEGER,
          next_node_id INTEGER,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // MySQL: best-effort column adds
      try {
        await connection.query(
          `ALTER TABLE matches ADD COLUMN public_match_id INT NULL, ADD UNIQUE KEY uq_matches_public_match_id (public_match_id)`
        );
      } catch (_) {
        /* exists */
      }
      try {
        await connection.query(
          `ALTER TABLE games ADD COLUMN public_game_id INT NULL, ADD UNIQUE KEY uq_games_public_game_id (public_game_id)`
        );
      } catch (_) {
        /* exists */
      }

      await connection.query(`
        CREATE TABLE IF NOT EXISTS brackets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          public_bracket_id INT NULL,
          tournament_id INT NOT NULL,
          tournament_mode_id INT NOT NULL,
          name VARCHAR(255) DEFAULT 'Bracket',
          bracket_type VARCHAR(50) DEFAULT 'single_elimination',
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_brackets_public_id (public_bracket_id)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS bracket_rounds (
          id INT AUTO_INCREMENT PRIMARY KEY,
          public_round_id INT NULL,
          bracket_id INT NOT NULL,
          public_bracket_id INT NULL,
          name VARCHAR(255) DEFAULT NULL,
          round_number INT DEFAULT 1,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_bracket_rounds_public_id (public_round_id),
          KEY idx_bracket_rounds_bracket_id (bracket_id)
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS bracket_nodes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          public_node_id INT NULL,
          bracket_id INT NOT NULL,
          round_id INT NULL,
          public_bracket_id INT NULL,
          public_round_id INT NULL,
          public_match_id INT NULL,
          match_id INT NULL,
          position INT DEFAULT 0,
          blue_team_id INT NULL,
          red_team_id INT NULL,
          winner_team_id INT NULL,
          next_public_node_id INT NULL,
          next_node_id INT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_bracket_nodes_public_id (public_node_id),
          KEY idx_bracket_nodes_bracket_id (bracket_id),
          KEY idx_bracket_nodes_public_match_id (public_match_id)
        )
      `);
    }

    ensured = true;
  })();

  try {
    await ensuring;
  } finally {
    ensuring = null;
  }
}

module.exports = { ensureSyncSchema };
