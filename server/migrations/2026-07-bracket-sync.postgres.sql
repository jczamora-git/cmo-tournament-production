-- Migration: Bracket sync + public ID mapping columns (PostgreSQL / live)

-- Map controller IDs onto production match/game rows
ALTER TABLE matches ADD COLUMN IF NOT EXISTS public_match_id INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS public_game_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_public_match_id
  ON matches (public_match_id)
  WHERE public_match_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_games_public_game_id
  ON games (public_game_id)
  WHERE public_game_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS brackets (
  id SERIAL PRIMARY KEY,
  public_bracket_id INTEGER UNIQUE,
  tournament_id INTEGER NOT NULL,
  tournament_mode_id INTEGER NOT NULL,
  name VARCHAR(255) DEFAULT 'Bracket',
  bracket_type VARCHAR(50) DEFAULT 'single_elimination',
  status VARCHAR(50) DEFAULT 'active',
  settings_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE brackets ADD COLUMN IF NOT EXISTS settings_json TEXT;

CREATE TABLE IF NOT EXISTS bracket_rounds (
  id SERIAL PRIMARY KEY,
  public_round_id INTEGER UNIQUE,
  bracket_id INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  public_bracket_id INTEGER,
  name VARCHAR(255),
  round_number INTEGER DEFAULT 1,
  round_no INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Live installs may already have the table without round_no (Controller-compatible column)
ALTER TABLE bracket_rounds ADD COLUMN IF NOT EXISTS round_no INTEGER;
ALTER TABLE bracket_rounds ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;
UPDATE bracket_rounds
SET round_number = COALESCE(round_number, round_no, 1),
    round_no = COALESCE(round_no, round_number, 1)
WHERE round_number IS NULL OR round_no IS NULL;

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
);

CREATE INDEX IF NOT EXISTS idx_bracket_rounds_bracket_id ON bracket_rounds (bracket_id);
CREATE INDEX IF NOT EXISTS idx_bracket_nodes_bracket_id ON bracket_nodes (bracket_id);
CREATE INDEX IF NOT EXISTS idx_bracket_nodes_public_match_id ON bracket_nodes (public_match_id);
