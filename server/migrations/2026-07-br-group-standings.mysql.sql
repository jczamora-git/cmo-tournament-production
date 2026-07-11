-- Migration: BR Group Standings (MySQL)
-- Idempotent create for local/testing databases.

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
