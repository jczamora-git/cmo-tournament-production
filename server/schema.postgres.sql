CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  game_type TEXT NOT NULL,
  season TEXT,
  description TEXT,
  status TEXT DEFAULT 'upcoming',
  banner_url TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  logo_image_url TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_modes (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  competition_type VARCHAR(50) NOT NULL DEFAULT 'head_to_head',
  team_upload_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tournament_id, code)
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  shortname VARCHAR(50) DEFAULT NULL,
  captain_name TEXT DEFAULT NULL,
  contact TEXT DEFAULT NULL,
  logo VARCHAR(500) DEFAULT NULL,
  tournament_id INTEGER DEFAULT NULL REFERENCES tournaments(id) ON DELETE SET NULL,
  tournament_mode_id INTEGER DEFAULT NULL REFERENCES tournament_modes(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  match_no INT DEFAULT 1,
  blue_team_id INT DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
  red_team_id INT DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
  mode VARCHAR(10) DEFAULT 'BO3',
  title VARCHAR(255) DEFAULT 'Match',
  queue_order INT DEFAULT 1,
  blue_score INT DEFAULT 0,
  red_score INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'queued',
  series_completed SMALLINT DEFAULT 0,
  series_winner_team_id BIGINT DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
  series_completed_at TIMESTAMP DEFAULT NULL,
  tournament_id INTEGER DEFAULT NULL REFERENCES tournaments(id) ON DELETE SET NULL,
  tournament_mode_id INTEGER DEFAULT NULL REFERENCES tournament_modes(id) ON DELETE SET NULL,
  public_match_id INTEGER UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  ign VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT NULL,
  photo VARCHAR(500) DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  game_no INTEGER NOT NULL,
  winner_team_id BIGINT DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'queued',
  finished_at TIMESTAMP DEFAULT NULL,
  public_game_id INTEGER UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, game_no)
);

CREATE TABLE IF NOT EXISTS team_submissions (
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(255) NOT NULL,
  shortname VARCHAR(50) DEFAULT NULL,
  captain_name VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  tournament_id INTEGER DEFAULT NULL REFERENCES tournaments(id) ON DELETE SET NULL,
  tournament_mode_id INTEGER DEFAULT NULL REFERENCES tournament_modes(id) ON DELETE SET NULL,
  approved_team_id INTEGER DEFAULT NULL REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_archives (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'google_drive',
  source_url TEXT NOT NULL,
  embed_url TEXT,
  thumbnail_url TEXT,
  video_type TEXT DEFAULT 'replay',
  recorded_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS br_group_standings (
  id SERIAL PRIMARY KEY,
  tournament_id INT NOT NULL,
  tournament_mode_id INT NOT NULL,
  group_name VARCHAR(50) NOT NULL,
  team_id INT NOT NULL,
  kills INT DEFAULT 0,
  placement_points INT DEFAULT 0,
  kill_points INT DEFAULT 0,
  total_points INT DEFAULT 0,
  final_rank INT,
  rounds_played INT DEFAULT 0,
  is_eliminated BOOLEAN DEFAULT FALSE,
  eliminated_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_br_standing UNIQUE (tournament_id, tournament_mode_id, group_name, team_id)
);

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
);

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
);

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