CREATE DATABASE IF NOT EXISTS jeizi_production;
USE jeizi_production;

CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  game_type VARCHAR(50) NOT NULL,
  season VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'upcoming',
  banner_url VARCHAR(500) DEFAULT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  cover_image_url VARCHAR(1000) DEFAULT NULL,
  logo_image_url VARCHAR(1000) DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_modes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  competition_type VARCHAR(50) NOT NULL DEFAULT 'head_to_head',
  team_upload_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tournament_mode (tournament_id, code)
);

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  shortname VARCHAR(50) DEFAULT NULL,
  captain_name TEXT DEFAULT NULL,
  contact TEXT DEFAULT NULL,
  logo VARCHAR(500) DEFAULT NULL,
  tournament_id INT DEFAULT NULL,
  tournament_mode_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY (tournament_mode_id) REFERENCES tournament_modes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_no INT DEFAULT 1,
  blue_team_id INT DEFAULT NULL,
  red_team_id INT DEFAULT NULL,
  mode VARCHAR(10) DEFAULT 'BO3',
  title VARCHAR(255) DEFAULT 'Match',
  queue_order INT DEFAULT 1,
  blue_score INT DEFAULT 0,
  red_score INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'queued',
  series_completed SMALLINT DEFAULT 0,
  series_winner_team_id BIGINT DEFAULT NULL,
  series_completed_at TIMESTAMP NULL DEFAULT NULL,
  tournament_id INT DEFAULT NULL,
  tournament_mode_id INT DEFAULT NULL,
  public_match_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (blue_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (red_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (series_winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY (tournament_mode_id) REFERENCES tournament_modes(id) ON DELETE SET NULL,
  UNIQUE KEY uq_matches_public_match_id (public_match_id)
);

CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id BIGINT NOT NULL,
  ign VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT NULL,
  photo VARCHAR(500) DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id BIGINT NOT NULL,
  game_no INT NOT NULL,
  winner_team_id BIGINT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'queued',
  finished_at TIMESTAMP NULL DEFAULT NULL,
  public_game_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  UNIQUE KEY uq_match_game (match_id, game_no),
  UNIQUE KEY uq_games_public_game_id (public_game_id)
);

CREATE TABLE IF NOT EXISTS team_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  shortname VARCHAR(50) DEFAULT NULL,
  captain_name VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  tournament_id INT DEFAULT NULL,
  tournament_mode_id INT DEFAULT NULL,
  approved_team_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY (tournament_mode_id) REFERENCES tournament_modes(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_archives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'google_drive',
  source_url VARCHAR(1000) NOT NULL,
  embed_url VARCHAR(1000) DEFAULT NULL,
  thumbnail_url VARCHAR(1000) DEFAULT NULL,
  video_type VARCHAR(50) DEFAULT 'replay',
  recorded_at TIMESTAMP NULL DEFAULT NULL,
  sort_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS br_group_standings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  tournament_mode_id INT NOT NULL,
  group_name VARCHAR(50) NOT NULL,
  team_id INT NOT NULL,
  kills INT DEFAULT 0,
  placement_points INT DEFAULT 0,
  kill_points INT DEFAULT 0,
  total_points INT DEFAULT 0,
  final_rank INT DEFAULT NULL,
  rounds_played INT DEFAULT 0,
  is_eliminated BOOLEAN DEFAULT FALSE,
  eliminated_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_br_standing (tournament_id, tournament_mode_id, group_name, team_id)
);

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