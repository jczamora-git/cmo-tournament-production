-- Migration: Bracket sync + public ID mapping columns (MySQL / local)

-- Add public ID columns (ignore if already present)
-- Run manually if needed:
-- ALTER TABLE matches ADD COLUMN public_match_id INT NULL UNIQUE;
-- ALTER TABLE games ADD COLUMN public_game_id INT NULL UNIQUE;

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'public_match_id'
    ),
    'SELECT 1',
    'ALTER TABLE matches ADD COLUMN public_match_id INT NULL, ADD UNIQUE KEY uq_matches_public_match_id (public_match_id)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'games' AND COLUMN_NAME = 'public_game_id'
    ),
    'SELECT 1',
    'ALTER TABLE games ADD COLUMN public_game_id INT NULL, ADD UNIQUE KEY uq_games_public_game_id (public_game_id)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
);

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
  KEY idx_bracket_rounds_bracket_id (bracket_id),
  CONSTRAINT fk_bracket_rounds_bracket FOREIGN KEY (bracket_id) REFERENCES brackets(id) ON DELETE CASCADE
);

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
  KEY idx_bracket_nodes_public_match_id (public_match_id),
  CONSTRAINT fk_bracket_nodes_bracket FOREIGN KEY (bracket_id) REFERENCES brackets(id) ON DELETE CASCADE,
  CONSTRAINT fk_bracket_nodes_round FOREIGN KEY (round_id) REFERENCES bracket_rounds(id) ON DELETE SET NULL
);
