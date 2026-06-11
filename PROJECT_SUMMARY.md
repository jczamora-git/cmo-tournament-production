# Jeizi Production Public

## Project Description

A simplified production/public system for MLBB tournament management and display. This project is based on the existing Jeizi overlay system but focused exclusively on public-facing tournament data management.

Reference repository: https://github.com/jczamora-git/jeizi-overlay-v2.git

This is NOT the full overlay control system. This is a cleaner public/production-facing project.

## Main Purpose

This system is intended for:

- Uploading and managing team details
- Viewing match data
- Displaying upcoming matches
- Viewing match schedules
- Reviewing match history
- Previewing the bracket

## Main Features

### Team Details Upload

- Add team name
- Add shortname/tag
- Add optional logo
- Store team information for use in matches and bracket views

### Match Viewing

- View all matches
- Show participating blue/red teams
- Show scores
- Show status
- Show match mode such as BO1/BO3

### Upcoming Matches

- Display queued or scheduled matches
- Sort by queue order or match number

### Schedule

- Show tournament match schedule
- Allow public users or admins to see match flow

### Match History

- Show finished matches
- Display winner, final score, and match result

### Bracket Preview

- Show tournament bracket structure
- Show match progression
- Preview winners and next match flow

## Tech Stack

Frontend:

- React
- Vite
- JavaScript
- CSS

Backend:

- Express.js
- REST API only
- Vercel serverless-compatible API

Database:

- Local development: MySQL
- Production: Supabase PostgreSQL
- Supabase transaction pooler for Vercel production

Deployment:

- Vercel for production frontend and API
- Supabase for production database

## Planned API Endpoints

- GET /api/health
- GET /api/teams
- POST /api/teams
- GET /api/matches
- GET /api/matches/upcoming
- GET /api/matches/schedule
- GET /api/matches/history
- GET /api/matches/bracket

## Database Overview

### teams table

Fields:

- id
- name
- shortname
- logo
- created_at
- updated_at

### matches table

Fields:

- id
- match_no
- blue_team_id
- red_team_id
- mode
- title
- blue_score
- red_score
- status
- caster_ids
- queue_order
- series_completed
- series_winner_team_id
- series_completed_at
- created_at
- updated_at

## Environment Setup

Local development should use:

```
DB_CLIENT=mysql
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=
MYSQL_PORT=3306
VITE_API_BASE_URL=http://localhost:3000
```

Production should use:

```
DB_CLIENT=postgres
DATABASE_URL=Supabase transaction pooler URL
FRONTEND_URL=Production Vercel domain
VITE_API_BASE_URL=Production Vercel domain
DEBUG_API_ERRORS=false
```

Important: Do not include real passwords or real Supabase credentials in any committed files.

## Special Notes

- Direct Supabase database connection may not work properly on Vercel because of IPv6 compatibility.
- Use Supabase transaction pooler for Vercel serverless functions.
- File upload on Vercel should not rely on permanent local disk storage.
- Socket.IO is not required for this public version.
- This project should prioritize stable REST API and clean public data viewing.

## Development Direction

This project should stay simple and production-friendly. The goal is not to rebuild the full overlay controller, but to create a clean public system for tournament data viewing and team information management.
