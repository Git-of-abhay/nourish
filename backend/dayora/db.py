import sqlite3
from contextlib import contextmanager
from pathlib import Path


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL,
    obstacle TEXT NOT NULL,
    target_kcal INTEGER,
    reminder TEXT NOT NULL DEFAULT 'off',
    activity_level TEXT NOT NULL DEFAULT 'beginner',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kcal INTEGER NOT NULL,
    portion TEXT NOT NULL,
    source TEXT NOT NULL,
    logged_on TEXT NOT NULL,
    logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_meals_profile_time ON meals(profile_id, logged_at);
CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    logged_on TEXT NOT NULL,
    logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workouts_profile_time ON workouts(profile_id, logged_at);
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_profile_time ON reports(profile_id, created_at);
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_profile_time ON chat_messages(profile_id, created_at);
"""


class SQLiteStore:
    """Owns connections and SQL. Services never see sqlite3 directly."""

    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript(SCHEMA)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def insert_profile(self, data):
        with self.connect() as db:
            db.execute(
                "INSERT INTO profiles (id, token_hash, name, goal, obstacle, target_kcal, reminder, activity_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (data["id"], data["token_hash"], data["name"], data["goal"], data["obstacle"], data["target_kcal"], data["reminder"], data["activity_level"]),
            )

    def profile_by_token_hash(self, token_hash):
        with self.connect() as db:
            row = db.execute("SELECT id, name, goal, obstacle, target_kcal, reminder, activity_level, created_at FROM profiles WHERE token_hash = ?", (token_hash,)).fetchone()
            return dict(row) if row else None

    def update_profile(self, profile_id, data):
        with self.connect() as db:
            db.execute("UPDATE profiles SET name=?, goal=?, obstacle=?, target_kcal=?, reminder=?, activity_level=? WHERE id=?", (data["name"], data["goal"], data["obstacle"], data["target_kcal"], data["reminder"], data["activity_level"], profile_id))
            row = db.execute("SELECT id, name, goal, obstacle, target_kcal, reminder, activity_level, created_at FROM profiles WHERE id=?", (profile_id,)).fetchone()
            return dict(row)

    def insert_meal(self, data):
        with self.connect() as db:
            db.execute("INSERT INTO meals (id, profile_id, name, kcal, portion, source, logged_on) VALUES (?, ?, ?, ?, ?, ?, ?)", (data["id"], data["profile_id"], data["name"], data["kcal"], data["portion"], data["source"], data["logged_on"]))
        return self.meal_by_id(data["profile_id"], data["id"])

    def meal_by_id(self, profile_id, meal_id):
        with self.connect() as db:
            row = db.execute("SELECT id, name, kcal, portion, source, logged_on, logged_at FROM meals WHERE profile_id = ? AND id = ?", (profile_id, meal_id)).fetchone()
            return dict(row) if row else None

    def list_meals(self, profile_id, limit=100):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id, name, kcal, portion, source, logged_on, logged_at FROM meals WHERE profile_id = ? ORDER BY logged_at DESC, rowid DESC LIMIT ?", (profile_id, limit))]

    def delete_meal(self, profile_id, meal_id):
        with self.connect() as db:
            result = db.execute("DELETE FROM meals WHERE profile_id = ? AND id = ?", (profile_id, meal_id))
            return result.rowcount > 0

    def insert_workout(self, data):
        with self.connect() as db:
            db.execute("INSERT INTO workouts (id, profile_id, activity, minutes, logged_on) VALUES (?, ?, ?, ?, ?)", (data["id"], data["profile_id"], data["activity"], data["minutes"], data["logged_on"]))
        return self.workout_by_id(data["profile_id"], data["id"])

    def workout_by_id(self, profile_id, workout_id):
        with self.connect() as db:
            row = db.execute("SELECT id, activity, minutes, logged_on, logged_at FROM workouts WHERE profile_id = ? AND id = ?", (profile_id, workout_id)).fetchone()
            return dict(row) if row else None

    def list_workouts(self, profile_id, limit=100):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id, activity, minutes, logged_on, logged_at FROM workouts WHERE profile_id = ? ORDER BY logged_at DESC, rowid DESC LIMIT ?", (profile_id, limit))]

    def delete_workout(self, profile_id, workout_id):
        with self.connect() as db:
            result = db.execute("DELETE FROM workouts WHERE profile_id = ? AND id = ?", (profile_id, workout_id))
            return result.rowcount > 0

    def insert_report(self, data):
        with self.connect() as db:
            db.execute("INSERT INTO reports (id, profile_id, title, summary, metrics_json) VALUES (?, ?, ?, ?, ?)", (data["id"], data["profile_id"], data["title"], data["summary"], data["metrics_json"]))
        return self.report_by_id(data["profile_id"], data["id"])

    def report_by_id(self, profile_id, report_id):
        with self.connect() as db:
            row = db.execute("SELECT id, title, summary, metrics_json, created_at FROM reports WHERE profile_id = ? AND id = ?", (profile_id, report_id)).fetchone()
            return dict(row) if row else None

    def list_reports(self, profile_id):
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id, title, summary, metrics_json, created_at FROM reports WHERE profile_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30", (profile_id,))]

    def delete_report(self, profile_id, report_id):
        with self.connect() as db:
            result = db.execute("DELETE FROM reports WHERE profile_id=? AND id=?", (profile_id, report_id))
            return result.rowcount > 0

    def add_chat_message(self, message_id, profile_id, role, content):
        with self.connect() as db:
            db.execute("INSERT INTO chat_messages (id, profile_id, role, content) VALUES (?, ?, ?, ?)", (message_id, profile_id, role, content))

    def list_chat_messages(self, profile_id, limit=40):
        with self.connect() as db:
            rows = db.execute("SELECT id, role, content, created_at FROM (SELECT rowid, id, role, content, created_at FROM chat_messages WHERE profile_id=? ORDER BY rowid DESC LIMIT ?) ORDER BY rowid ASC", (profile_id, limit))
            return [dict(row) for row in rows]
