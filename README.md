# 🎃 Haunted Data Detective

A Halloween data-detective game built for the Turing Club Tech Team Auditions 2026.

Blackwood Manor is haunted. You get a week of sensor data, a guest register and witness reports. Use SQL, charts and anomaly detection to find **which room** is haunted, **at what hour** the haunting peaks, and **which ghost** is responsible.

## Run it

```bash
python -m venv venv
venv\Scripts\activate          # Windows   (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
streamlit run app.py
```

It opens at http://localhost:8501.

## Features

| Feature | Where |
|---|---|
| 3 difficulty levels (Easy / Medium / Hard) | `config.py` -> `DIFFICULTY`, used by `generate_data.py` |
| Unlimited cases, each generated from a fresh random seed | `generate_data.py` |
| SQL Lab (read-only, with preset detective queries) | `db.py`, "SQL Lab" tab |
| Anomaly detection: per-room robust z-score + Isolation Forest | `detect.py`, "Ghost Scan" tab |
| Trick-or-Treat popup after each scan (free hint or point penalty) | `app.py` -> `trick_or_treat_dialog`, rules in `game.py` |
| Ghost Report: story built from the real numbers of the case | `report.py` |
| Leaderboard ranked by score, then speed (SQLite, persistent) | `db.py`, "Leaderboard" tab |
| Halloween theme, animated pumpkin and ghost | `theme.py`, `.streamlit/config.toml` |

## Architecture

```
generate_data.py  ->  Case (readings, guests, reports, hidden answer)
        |
        v
      db.py  ->  SQLite (haunted.db): readings, guests, reports, leaderboard
        |
 detect.py  ->  scores each reading against ITS OWN room, flags anomalies,
                then ranks (room, hour) cells by recurrence across nights
        |
    game.py  ->  hints, trick-or-treat, scoring
   report.py ->  ghost report
     app.py  ->  Streamlit UI (6 tabs)
```

## How detection works (the part to explain)

1. **Per-room normalisation.** The Cellar is always cold and the Kitchen is always noisy, so raw values mislead. Each reading is compared with its own room using a **robust z-score** (median and MAD, not mean and standard deviation, because the haunting itself would drag the mean).
2. **Haunting score** = how much colder than normal + how much more electromagnetic than normal.
3. **Two detectors:** a z-score threshold, and an **Isolation Forest** on all three sensors.
4. **Recurrence.** One odd reading proves nothing, because sensors glitch. A ghost returns. Flagged readings are grouped by (room, hour-of-day) and ranked by the number of *different nights* they appear on.
5. **Witness reports** identify *which* ghost: the most common clue in the haunted room matches one ghost's signature in the dossier.

## Scoring

`accuracy = room 40 + hour 30 (15 if one hour off) + ghost 30`
`speed bonus = up to 20, only if accuracy >= 70`
`final = (accuracy + speed bonus - trick penalties) x difficulty multiplier (1 / 1.5 / 2)`

## Difficulty (tested on 40 random cases each)

| Level | Signal | Extras | Z-score finds room + hour |
|---|---|---|---|
| Easy | strong | none | about 100% |
| Medium | weak | 1 decoy room, noisier | about 95% |
| Hard | very weak | 2 decoy rooms, a faulty sensor, unreliable witnesses | about 75-80% |

On Hard, the Isolation Forest alone often fails (it is fooled by the faulty sensor and decoys), which is intentional: players must cross-check the charts, SQL and witness reports.

## Limitations (be upfront about these)

- The data is **synthetic by design**. The model detects planted patterns, so the project demonstrates the *pipeline and method*, not a real-world result.
- Detection depends on thresholds. A lower threshold catches subtle ghosts but raises false alarms (a precision/recall trade-off the sliders let you explore).
- Only the leaderboard persists between sessions; each player's current case lives in the browser session.
- Future work: an LLM-written ghost report, multiplayer, and real IoT sensor input.

## Project files

```
app.py            Streamlit UI and game flow
config.py         rooms, ghosts, difficulty settings
generate_data.py  case generator
db.py             SQLite, SQL Lab, leaderboard
detect.py         anomaly detection
game.py           hints, trick-or-treat, scoring
report.py         ghost report
theme.py          Halloween CSS
```
