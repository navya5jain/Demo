"""SQLite layer: case data for the SQL Lab, plus the persistent leaderboard."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

DB_PATH = Path(__file__).with_name("haunted.db")
KEEP_CASES = 15  # only the most recent cases are kept in the database

SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    case_id TEXT PRIMARY KEY, title TEXT, difficulty TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS readings (
    case_id TEXT, timestamp TEXT, room TEXT,
    temperature REAL, emf REAL, noise_db REAL
);
CREATE TABLE IF NOT EXISTS guests (
    case_id TEXT, guest TEXT, room TEXT, check_in TEXT, check_out TEXT
);
CREATE TABLE IF NOT EXISTS reports (
    case_id TEXT, timestamp TEXT, room TEXT, keyword TEXT
);
CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detective TEXT, score INTEGER, accuracy INTEGER, seconds INTEGER,
    difficulty TEXT, case_title TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_readings_case ON readings(case_id);
"""


def _connect(path: Path | str | None = None) -> sqlite3.Connection:
    return sqlite3.connect(path or DB_PATH)


def init_db(path: Path | str | None = None) -> None:
    with _connect(path) as con:
        con.executescript(SCHEMA)


def load_case(case, path: Path | str | None = None) -> None:
    """Store a case's tables in SQLite so the player can query them with SQL."""
    init_db(path)
    with _connect(path) as con:
        for table in ("readings", "guests", "reports", "cases"):
            con.execute(f"DELETE FROM {table} WHERE case_id = ?", (case.case_id,))
        con.execute("INSERT INTO cases (case_id, title, difficulty) VALUES (?, ?, ?)",
                    (case.case_id, case.title, case.difficulty))

        def prep(df: pd.DataFrame) -> pd.DataFrame:
            out = df.copy()
            for col in out.columns:
                if pd.api.types.is_datetime64_any_dtype(out[col]):
                    out[col] = out[col].dt.strftime("%Y-%m-%d %H:%M:%S")
            out.insert(0, "case_id", case.case_id)
            return out

        prep(case.readings).to_sql("readings", con, if_exists="append", index=False)
        prep(case.guests).to_sql("guests", con, if_exists="append", index=False)
        prep(case.reports).to_sql("reports", con, if_exists="append", index=False)

        # housekeeping: keep only the newest cases
        old = [r[0] for r in con.execute(
            "SELECT case_id FROM cases ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ?",
            (KEEP_CASES,))]
        for cid in old:
            for table in ("readings", "guests", "reports", "cases"):
                con.execute(f"DELETE FROM {table} WHERE case_id = ?", (cid,))


# ---------------------------------------------------------------------------
# SQL Lab
# ---------------------------------------------------------------------------
PRESET_QUERIES = {
    "Coldest readings in the manor": """SELECT room, timestamp, temperature
FROM readings
WHERE case_id = :case
ORDER BY temperature ASC
LIMIT 10;""",
    "Average EMF by room during the witching hours (10 PM - 4 AM)": """SELECT room,
       ROUND(AVG(emf), 1) AS avg_emf,
       ROUND(AVG(temperature), 1) AS avg_temp
FROM readings
WHERE case_id = :case
  AND (CAST(strftime('%H', timestamp) AS INTEGER) >= 22
       OR CAST(strftime('%H', timestamp) AS INTEGER) <= 4)
GROUP BY room
ORDER BY avg_emf DESC;""",
    "Which hour of the day has the highest average EMF?": """SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
       ROUND(AVG(emf), 1) AS avg_emf,
       ROUND(AVG(temperature), 1) AS avg_temp
FROM readings
WHERE case_id = :case
GROUP BY hour
ORDER BY avg_emf DESC
LIMIT 5;""",
    "What are witnesses reporting, and where?": """SELECT room, keyword, COUNT(*) AS times_reported
FROM reports
WHERE case_id = :case
GROUP BY room, keyword
ORDER BY times_reported DESC
LIMIT 10;""",
    "Who was staying in each room?": """SELECT room, guest, check_in, check_out
FROM guests
WHERE case_id = :case
ORDER BY room, check_in;""",
}


def run_query(sql: str, case_id: str, path: Path | str | None = None) -> pd.DataFrame:
    """Run a read-only query.  Use `:case` in the SQL to filter on the current case."""
    text = sql.strip().rstrip(";").strip()
    if not text.lower().startswith(("select", "with")):
        raise ValueError("Only SELECT queries are allowed in the SQL Lab.")
    con = _connect(path)
    try:
        con.execute("PRAGMA query_only = ON")  # belt and braces: no writes at all
        return pd.read_sql_query(text, con, params={"case": case_id}).head(500)
    finally:
        con.close()


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------
def add_score(detective: str, score: int, accuracy: int, seconds: int,
              difficulty: str, case_title: str, path: Path | str | None = None) -> None:
    init_db(path)
    name = (detective or "Anonymous Ghost Hunter").strip()[:24] or "Anonymous Ghost Hunter"
    with _connect(path) as con:
        con.execute(
            "INSERT INTO leaderboard (detective, score, accuracy, seconds, difficulty, case_title) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (name, int(score), int(accuracy), int(seconds), difficulty, case_title),
        )


def top_scores(difficulty: str | None = None, limit: int = 10,
               path: Path | str | None = None) -> pd.DataFrame:
    """Best runs first: highest score, then fastest time."""
    init_db(path)
    sql = "SELECT detective, score, accuracy, seconds, difficulty, case_title FROM leaderboard"
    params: tuple = ()
    if difficulty and difficulty != "All":
        sql += " WHERE difficulty = ?"
        params = (difficulty,)
    sql += " ORDER BY score DESC, seconds ASC, id ASC LIMIT ?"
    with _connect(path) as con:
        return pd.read_sql_query(sql, con, params=params + (limit,))
