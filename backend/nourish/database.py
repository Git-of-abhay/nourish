import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Protocol


class Database(Protocol):
    """The only thing the store needs: run SQL written with ? placeholders."""

    def execute(self, sql: str, params: Iterable = ()) -> int: ...
    def query(self, sql: str, params: Iterable = ()) -> list[dict]: ...
    def transaction(self): ...
    def apply_schema(self, statements: list[str]) -> None: ...
    def close(self) -> None: ...


def _plain(row: dict) -> dict:
    """Dates and timestamps leave the database as ISO strings on every engine."""
    return {k: (v.isoformat() if isinstance(v, (date, datetime)) else v) for k, v in row.items()}


class SQLiteDatabase:
    """Local development and tests."""

    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def _connect(self):
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

    def execute(self, sql, params=()):
        with self._connect() as db:
            return db.execute(sql, tuple(params)).rowcount

    def query(self, sql, params=()):
        with self._connect() as db:
            return [_plain(dict(row)) for row in db.execute(sql, tuple(params))]

    @contextmanager
    def transaction(self):
        with self._connect() as db:
            yield _Tx(lambda sql, params=(): db.execute(sql, tuple(params)).rowcount)

    def apply_schema(self, statements):
        for statement in statements:
            self.execute(statement)

    def close(self):
        pass


class PostgresDatabase:
    """Production: data survives restarts and redeploys."""

    def __init__(self, url: str):
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        self.pool = ConnectionPool(url, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)

    @staticmethod
    def _sql(sql: str) -> str:
        return sql.replace("?", "%s")

    def execute(self, sql, params=()):
        with self.pool.connection() as conn:
            return conn.execute(self._sql(sql), tuple(params)).rowcount

    def query(self, sql, params=()):
        with self.pool.connection() as conn:
            return [_plain(row) for row in conn.execute(self._sql(sql), tuple(params)).fetchall()]

    @contextmanager
    def transaction(self):
        with self.pool.connection() as conn:
            yield _Tx(lambda sql, params=(): conn.execute(self._sql(sql), tuple(params)).rowcount)

    def apply_schema(self, statements):
        # Several server workers boot at once; the lock makes them take turns instead of colliding.
        with self.pool.connection() as conn:
            conn.execute("SELECT pg_advisory_xact_lock(724001)")
            for statement in statements:
                conn.execute(statement)

    def close(self):
        self.pool.close()


class _Tx:
    def __init__(self, run):
        self.execute = run
