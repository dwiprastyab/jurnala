CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL, pw_iter INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE login_attempts (email TEXT PRIMARY KEY, fails INTEGER NOT NULL, window_start TEXT NOT NULL);
CREATE TABLE habits (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, sort INTEGER NOT NULL, archived_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE checkins (habit_id INTEGER NOT NULL REFERENCES habits(id), user_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (habit_id, day));
CREATE TABLE entries (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, mood INTEGER, went_well TEXT, was_hard TEXT, tomorrow TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, day));
CREATE INDEX idx_habits_user ON habits(user_id);
CREATE INDEX idx_checkins_user_day ON checkins(user_id, day);
