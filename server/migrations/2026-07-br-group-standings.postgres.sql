-- Migration: BR Group Standings (PostgreSQL / live)
-- Idempotent create for production Supabase.

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
