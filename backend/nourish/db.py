from .database import Database

# Plain SQL that runs unchanged on SQLite and PostgreSQL. Dates and timestamps are ISO text.
SCHEMA = [
    """CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        goal TEXT NOT NULL,
        obstacle TEXT NOT NULL,
        target_kcal INTEGER,
        reminder TEXT NOT NULL DEFAULT 'off',
        activity_level TEXT NOT NULL DEFAULT 'beginner',
        created_at TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kcal INTEGER NOT NULL,
        portion TEXT NOT NULL,
        source TEXT NOT NULL,
        logged_on TEXT NOT NULL,
        logged_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_meals_profile_time ON meals(profile_id, logged_at)",
    """CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        activity TEXT NOT NULL,
        minutes INTEGER NOT NULL,
        logged_on TEXT NOT NULL,
        logged_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_workouts_profile_time ON workouts(profile_id, logged_at)",
    """CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_reports_profile_time ON reports(profile_id, created_at)",
    """CREATE TABLE IF NOT EXISTS report_metrics (
        report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        reference TEXT NOT NULL,
        ref_low DOUBLE PRECISION,
        ref_high DOUBLE PRECISION,
        measured_on TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_report_metrics_profile_key ON report_metrics(profile_id, key, measured_on)",
    """CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_chat_profile_time ON chat_messages(profile_id, created_at)",
]

PROFILE_COLUMNS = "id, name, goal, obstacle, target_kcal, reminder, activity_level, created_at"


class SqlStore:
    """Owns SQL. Services never see a connection, so the engine can change without touching them."""

    def __init__(self, db: Database, clock):
        self.db = db
        self.clock = clock
        db.apply_schema(SCHEMA)

    def _now(self) -> str:
        return self.clock().isoformat()

    # profiles
    def insert_profile(self, data):
        self.db.execute(
            "INSERT INTO profiles (id, token_hash, name, goal, obstacle, target_kcal, reminder, activity_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (data["id"], data["token_hash"], data["name"], data["goal"], data["obstacle"], data["target_kcal"], data["reminder"], data["activity_level"], self._now()),
        )

    def profile_by_token_hash(self, token_hash):
        rows = self.db.query(f"SELECT {PROFILE_COLUMNS} FROM profiles WHERE token_hash = ?", (token_hash,))
        return rows[0] if rows else None

    def update_profile(self, profile_id, data):
        self.db.execute(
            "UPDATE profiles SET name=?, goal=?, obstacle=?, target_kcal=?, reminder=?, activity_level=? WHERE id=?",
            (data["name"], data["goal"], data["obstacle"], data["target_kcal"], data["reminder"], data["activity_level"], profile_id),
        )
        return self.db.query(f"SELECT {PROFILE_COLUMNS} FROM profiles WHERE id=?", (profile_id,))[0]

    # meals
    def insert_meal(self, data):
        self.db.execute(
            "INSERT INTO meals (id, profile_id, name, kcal, portion, source, logged_on, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (data["id"], data["profile_id"], data["name"], data["kcal"], data["portion"], data["source"], data["logged_on"], self._now()),
        )
        return self.meal_by_id(data["profile_id"], data["id"])

    def meal_by_id(self, profile_id, meal_id):
        rows = self.db.query("SELECT id, name, kcal, portion, source, logged_on, logged_at FROM meals WHERE profile_id = ? AND id = ?", (profile_id, meal_id))
        return rows[0] if rows else None

    def list_meals(self, profile_id, limit=100):
        return self.db.query("SELECT id, name, kcal, portion, source, logged_on, logged_at FROM meals WHERE profile_id = ? ORDER BY logged_at DESC LIMIT ?", (profile_id, limit))

    def delete_meal(self, profile_id, meal_id):
        return self.db.execute("DELETE FROM meals WHERE profile_id = ? AND id = ?", (profile_id, meal_id)) > 0

    # workouts
    def insert_workout(self, data):
        self.db.execute(
            "INSERT INTO workouts (id, profile_id, activity, minutes, logged_on, logged_at) VALUES (?, ?, ?, ?, ?, ?)",
            (data["id"], data["profile_id"], data["activity"], data["minutes"], data["logged_on"], self._now()),
        )
        return self.workout_by_id(data["profile_id"], data["id"])

    def workout_by_id(self, profile_id, workout_id):
        rows = self.db.query("SELECT id, activity, minutes, logged_on, logged_at FROM workouts WHERE profile_id = ? AND id = ?", (profile_id, workout_id))
        return rows[0] if rows else None

    def list_workouts(self, profile_id, limit=100):
        return self.db.query("SELECT id, activity, minutes, logged_on, logged_at FROM workouts WHERE profile_id = ? ORDER BY logged_at DESC LIMIT ?", (profile_id, limit))

    def delete_workout(self, profile_id, workout_id):
        return self.db.execute("DELETE FROM workouts WHERE profile_id = ? AND id = ?", (profile_id, workout_id)) > 0

    # reports and tracked markers
    def insert_report(self, data, points=()):
        with self.db.transaction() as tx:
            tx.execute(
                "INSERT INTO reports (id, profile_id, title, summary, metrics_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (data["id"], data["profile_id"], data["title"], data["summary"], data["metrics_json"], self._now()),
            )
            for p in points:
                tx.execute(
                    "INSERT INTO report_metrics (report_id, profile_id, key, name, unit, value, reference, ref_low, ref_high, measured_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (data["id"], data["profile_id"], p["key"], p["name"], p["unit"], p["value"], p["reference"], p["ref_low"], p["ref_high"], p["measured_on"]),
                )
        return self.report_by_id(data["profile_id"], data["id"])

    def report_by_id(self, profile_id, report_id):
        rows = self.db.query("SELECT id, title, summary, metrics_json, created_at FROM reports WHERE profile_id = ? AND id = ?", (profile_id, report_id))
        return rows[0] if rows else None

    def list_reports(self, profile_id):
        return self.db.query("SELECT id, title, summary, metrics_json, created_at FROM reports WHERE profile_id = ? ORDER BY created_at DESC LIMIT 30", (profile_id,))

    def delete_report(self, profile_id, report_id):
        with self.db.transaction() as tx:
            tx.execute("DELETE FROM report_metrics WHERE profile_id = ? AND report_id = ?", (profile_id, report_id))
            return tx.execute("DELETE FROM reports WHERE profile_id = ? AND id = ?", (profile_id, report_id)) > 0

    def metric_history(self, profile_id):
        return self.db.query(
            "SELECT key, name, unit, value, reference, ref_low, ref_high, measured_on FROM report_metrics WHERE profile_id = ? ORDER BY measured_on, name",
            (profile_id,),
        )

    # chat
    def add_chat_message(self, message_id, profile_id, role, content):
        self.db.execute("INSERT INTO chat_messages (id, profile_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)", (message_id, profile_id, role, content, self._now()))

    def list_chat_messages(self, profile_id, limit=40):
        rows = self.db.query("SELECT id, role, content, created_at FROM chat_messages WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?", (profile_id, limit))
        return list(reversed(rows))

    # numbers for streaks and badges, computed in SQL so history is never loaded whole
    def activity_stats(self, profile_id):
        days = self.db.query(
            "SELECT DISTINCT logged_on AS day FROM (SELECT logged_on FROM meals WHERE profile_id = ? UNION SELECT logged_on FROM workouts WHERE profile_id = ?) d ORDER BY day",
            (profile_id, profile_id),
        )
        totals = self.db.query(
            "SELECT (SELECT COALESCE(SUM(minutes), 0) FROM workouts WHERE profile_id = ?) AS total_minutes, "
            "(SELECT COUNT(*) FROM meals WHERE profile_id = ?) AS meal_count, "
            "(SELECT COUNT(*) FROM meals WHERE profile_id = ? AND source = 'photo_estimate') AS photo_meals, "
            "(SELECT COUNT(*) FROM meals WHERE profile_id = ? AND source = 'voice_estimate') AS voice_meals, "
            "(SELECT COUNT(*) FROM reports WHERE profile_id = ?) AS report_count",
            (profile_id,) * 5,
        )[0]
        return {
            "active_dates": [row["day"] for row in days],
            "total_minutes": int(totals["total_minutes"]),
            "meal_count": int(totals["meal_count"]),
            "photo_meals": int(totals["photo_meals"]),
            "voice_meals": int(totals["voice_meals"]),
            "report_count": int(totals["report_count"]),
        }

    def workout_minutes_between(self, profile_id, start, end):
        rows = self.db.query("SELECT COALESCE(SUM(minutes), 0) AS minutes FROM workouts WHERE profile_id = ? AND logged_on >= ? AND logged_on <= ?", (profile_id, start, end))
        return int(rows[0]["minutes"])
