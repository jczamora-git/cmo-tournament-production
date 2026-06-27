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