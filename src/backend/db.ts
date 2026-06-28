import Database from "better-sqlite3";

const db = new Database("./codearena.sqlite");

export async function dbRun(sql: string, params: any[] = []) {
  return db.prepare(sql).run(...params);
}

export async function dbGet(sql: string, params: any[] = []) {
  return db.prepare(sql).get(...params);
}

export async function dbAll(sql: string, params: any[] = []) {
  return db.prepare(sql).all(...params);
}

export async function initDb() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      cf_handle TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      coin_balance INTEGER DEFAULT 500,
      matches_played INTEGER DEFAULT 0,
      matches_won INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      provider TEXT,
      display_name TEXT,
      profile_picture TEXT
    )
  `);

  try {
    await dbRun(`ALTER TABLE users ADD COLUMN provider TEXT`);
  } catch(e) {}
  try {
    await dbRun(`ALTER TABLE users ADD COLUMN display_name TEXT`);
  } catch(e) {}
  try {
    await dbRun(`ALTER TABLE users ADD COLUMN profile_picture TEXT`);
  } catch(e) {}

  await dbRun(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'waiting',
      grid_size INTEGER DEFAULT 5,
      duration_minutes INTEGER DEFAULT 60,
      wager_per_team INTEGER DEFAULT 0,
      prize_pool INTEGER DEFAULT 0,
      min_rating INTEGER DEFAULT 800,
      max_rating INTEGER DEFAULT 1600,
      show_ratings BOOLEAN DEFAULT 1,
      problems TEXT NOT NULL,
      winner_team_id TEXT,
      started_at DATETIME,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT 'teal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      cf_handle TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS solves (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
      team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
      problem_id TEXT NOT NULL,
      problem_index INTEGER NOT NULL,
      solved_by_handle TEXT NOT NULL,
      cf_submission_id INTEGER,
      solved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      match_id TEXT,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      game_mode TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await dbRun(`ALTER TABLE coin_transactions ADD COLUMN game_mode TEXT`);
  } catch (e) {}

  try {
    await dbRun(
      `ALTER TABLE team_members ADD COLUMN accepted BOOLEAN DEFAULT 0`,
    );
  } catch (e) {}

  try {
    await dbRun(
      `ALTER TABLE cs_team_members ADD COLUMN accepted BOOLEAN DEFAULT 0`,
    );
  } catch (e) {}

  try {
    await dbRun(`ALTER TABLE br_players ADD COLUMN accepted BOOLEAN DEFAULT 0`);
  } catch (e) {}

  // CS tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS cs_matches (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'waiting',
      duration_minutes INTEGER DEFAULT 60,
      wager_per_team INTEGER DEFAULT 0,
      prize_pool INTEGER DEFAULT 0,
      questions TEXT NOT NULL,
      winner_team_id TEXT,
      started_at DATETIME,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS cs_teams (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES cs_matches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      in_game_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS cs_team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      cf_handle TEXT NOT NULL,
      in_game_score INTEGER DEFAULT 0,
      is_mvp BOOLEAN DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS cs_solves (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES cs_matches(id) ON DELETE CASCADE,
      team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE,
      cf_handle TEXT NOT NULL,
      question_slot INTEGER NOT NULL,
      problem_id TEXT NOT NULL,
      points_earned INTEGER NOT NULL,
      solver_rank INTEGER NOT NULL,
      cf_submission_id INTEGER,
      solved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS cs_sweep_bonuses (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES cs_matches(id) ON DELETE CASCADE,
      team_id TEXT REFERENCES cs_teams(id) ON DELETE CASCADE,
      question_slot INTEGER NOT NULL,
      bonus_points INTEGER DEFAULT 500,
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // BR tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS br_matches (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'waiting',
      current_round INTEGER DEFAULT 1,
      questions TEXT NOT NULL,
      winner_user_id TEXT REFERENCES users(id),
      started_at DATETIME,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS br_players (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES br_matches(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      cf_handle TEXT NOT NULL,
      status TEXT DEFAULT 'alive',
      eliminated_in_round INTEGER,
      elimination_reason TEXT,
      total_solve_time_ms INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS br_solves (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES br_matches(id) ON DELETE CASCADE,
      player_id TEXT REFERENCES br_players(id) ON DELETE CASCADE,
      cf_handle TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      problem_id TEXT NOT NULL,
      solve_time_ms INTEGER NOT NULL,
      cf_submission_id INTEGER,
      solved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS br_eliminations (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES br_matches(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      player_id TEXT REFERENCES br_players(id),
      cf_handle TEXT NOT NULL,
      reason TEXT NOT NULL,
      eliminated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const addCreatorIdColumn = async (table: string) => {
    try {
      await dbRun(`ALTER TABLE ${table} ADD COLUMN creator_id TEXT`);
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) {
        console.error(`Error adding creator_id to ${table}:`, e);
      }
    }
  };

  const addReadyColumn = async (table: string) => {
    try {
      await dbRun(`ALTER TABLE ${table} ADD COLUMN is_ready BOOLEAN DEFAULT 0`);
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) {
        console.error(`Error adding is_ready to ${table}:`, e);
      }
    }
  };

  await addCreatorIdColumn("matches");
  await addCreatorIdColumn("cs_matches");
  await addCreatorIdColumn("br_matches");

  await addReadyColumn("team_members");
  await addReadyColumn("cs_team_members");
  await addReadyColumn("br_players");

  console.log("SQLite database initialized.");
}

export default db;
