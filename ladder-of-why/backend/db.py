"""SQLite persistence.

One file on disk (ladder.db by default), no ORM, no migrations to run: the
schema is created on import. A connection is opened per call, which is plenty
for a prototype and keeps the code thread-safe under uvicorn.
"""

from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.getenv("LADDER_DB", Path(__file__).resolve().parent.parent / "ladder.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id          TEXT PRIMARY KEY,
    xp          INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    player_id    TEXT NOT NULL REFERENCES players(id),
    scenario     TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    completed_at TEXT,
    avg_score    REAL,
    offline      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rungs (
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    idx         INTEGER NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    concept     TEXT NOT NULL,
    question    TEXT NOT NULL,
    good_answer TEXT,
    answer      TEXT,
    score       INTEGER,
    feedback    TEXT,
    PRIMARY KEY (session_id, idx)
);
CREATE TABLE IF NOT EXISTS badges (
    player_id  TEXT NOT NULL REFERENCES players(id),
    code       TEXT NOT NULL,
    earned_at  TEXT NOT NULL,
    PRIMARY KEY (player_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id, created_at DESC);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


# --------------------------------------------------------------------------
# players
# --------------------------------------------------------------------------

def ensure_player(player_id: str | None) -> str:
    """Return an existing player id, or create a fresh anonymous player."""
    with connect() as conn:
        if player_id:
            row = conn.execute("SELECT id FROM players WHERE id = ?", (player_id,)).fetchone()
            if row:
                return row["id"]
        pid = player_id or new_id()
        conn.execute(
            "INSERT OR IGNORE INTO players (id, xp, created_at) VALUES (?, 0, ?)", (pid, now())
        )
        return pid


def add_xp(player_id: str, amount: int) -> int:
    with connect() as conn:
        conn.execute("UPDATE players SET xp = xp + ? WHERE id = ?", (int(amount), player_id))
        row = conn.execute("SELECT xp FROM players WHERE id = ?", (player_id,)).fetchone()
        return row["xp"] if row else 0


def player_stats(player_id: str) -> dict:
    with connect() as conn:
        player = conn.execute("SELECT xp FROM players WHERE id = ?", (player_id,)).fetchone()
        agg = conn.execute(
            """SELECT COUNT(*) AS closed, MAX(avg_score) AS best, AVG(avg_score) AS mean
               FROM sessions WHERE player_id = ? AND completed_at IS NOT NULL""",
            (player_id,),
        ).fetchone()
        badge_rows = conn.execute(
            "SELECT code FROM badges WHERE player_id = ? ORDER BY earned_at", (player_id,)
        ).fetchall()
    return {
        "xp": player["xp"] if player else 0,
        "cases_closed": agg["closed"] or 0,
        "best_avg": round(agg["best"], 2) if agg["best"] is not None else None,
        "mean_avg": round(agg["mean"], 2) if agg["mean"] is not None else None,
        "badge_codes": [r["code"] for r in badge_rows],
    }


def award_badges(player_id: str, codes: list[str]) -> list[str]:
    """Insert badges the player does not already hold; return the newly added."""
    if not codes:
        return []
    with connect() as conn:
        held = {
            r["code"]
            for r in conn.execute(
                "SELECT code FROM badges WHERE player_id = ?", (player_id,)
            ).fetchall()
        }
        fresh = [c for c in codes if c not in held]
        conn.executemany(
            "INSERT OR IGNORE INTO badges (player_id, code, earned_at) VALUES (?, ?, ?)",
            [(player_id, c, now()) for c in fresh],
        )
    return fresh


# --------------------------------------------------------------------------
# sessions and rungs
# --------------------------------------------------------------------------

def create_session(player_id: str, scenario: str, rungs: list[dict], offline: bool) -> str:
    sid = new_id()
    with connect() as conn:
        conn.execute(
            "INSERT INTO sessions (id, player_id, scenario, created_at, offline) VALUES (?,?,?,?,?)",
            (sid, player_id, scenario, now(), 1 if offline else 0),
        )
        conn.executemany(
            """INSERT INTO rungs (session_id, idx, type, title, concept, question, good_answer)
               VALUES (?,?,?,?,?,?,?)""",
            [
                (
                    sid,
                    i,
                    r.get("type", ""),
                    r.get("title", f"Rung {i + 1}"),
                    r.get("concept", ""),
                    r["question"],
                    r.get("good_answer_looks_like", ""),
                )
                for i, r in enumerate(rungs)
            ],
        )
    return sid


def get_session(session_id: str) -> dict | None:
    with connect() as conn:
        session = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            return None
        rungs = conn.execute(
            "SELECT * FROM rungs WHERE session_id = ? ORDER BY idx", (session_id,)
        ).fetchall()
    return {
        "id": session["id"],
        "player_id": session["player_id"],
        "scenario": session["scenario"],
        "created_at": session["created_at"],
        "completed_at": session["completed_at"],
        "avg_score": session["avg_score"],
        "offline": bool(session["offline"]),
        "rungs": [dict(r) for r in rungs],
    }


def record_answer(session_id: str, idx: int, answer: str, score: int, feedback: str) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE rungs SET answer = ?, score = ?, feedback = ? WHERE session_id = ? AND idx = ?",
            (answer, int(score), feedback, session_id, idx),
        )


def complete_session(session_id: str, avg_score: float) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE sessions SET completed_at = ?, avg_score = ? WHERE id = ?",
            (now(), round(float(avg_score), 2), session_id),
        )


def history(player_id: str, limit: int = 20) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """SELECT s.id, s.scenario, s.created_at, s.completed_at, s.avg_score, s.offline,
                      COUNT(r.idx) AS rungs,
                      SUM(CASE WHEN r.score IS NOT NULL THEN 1 ELSE 0 END) AS answered
               FROM sessions s LEFT JOIN rungs r ON r.session_id = s.id
               WHERE s.player_id = ?
               GROUP BY s.id
               ORDER BY s.created_at DESC
               LIMIT ?""",
            (player_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


init_db()
