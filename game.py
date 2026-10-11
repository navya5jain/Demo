"""Game rules: hints, trick-or-treat, scoring."""

from __future__ import annotations

import random

from config import DIFFICULTY, ENTITIES, ROOMS
from generate_data import Case, generate_case


def new_case(difficulty: str, seed: int | None = None) -> Case:
    return generate_case(difficulty, seed)


def fmt_hour(h: int) -> str:
    """0 -> '12:00 AM', 14 -> '2:00 PM'."""
    suffix = "AM" if h < 12 else "PM"
    return f"{(h % 12) or 12}:00 {suffix}"


# ---------------------------------------------------------------------------
# Trick or Treat
# ---------------------------------------------------------------------------
def build_hints(case: Case) -> list[str]:
    """Ordered list of free hints a 'treat' can hand out."""
    a = case.answer
    floor = ROOMS[a["room"]]["floor"]
    side = "before midnight" if a["hour"] >= 12 else "after midnight"
    first_letter = a["entity"].replace("The ", "")[0]
    return [
        f"The haunted room is on the {floor}.",
        f"The haunting peaks {side}.",
        f"The culprit's name (after 'The') starts with the letter '{first_letter}'.",
    ]


TRICKS = [
    "A skeleton snatched 5 points from your pocket!",
    "A bat flew off with 5 of your points!",
    "The lights flickered... and 5 points vanished!",
    "A cackling witch charged you 5 points for 'consulting fees'!",
]
TREAT_FLAVOUR = [
    "The pumpkin has nothing left to say, but you get some candy corn.",
    "Only candy this time. The spirits have no more secrets to spare.",
]
TRICK_PENALTY = 5
TREAT_CHANCE = 0.65


def trick_or_treat(case: Case, hints_given: int, rng: random.Random | None = None) -> dict:
    """Roll a trick or a treat.

    Returns {'kind': 'treat'|'trick', 'message': str, 'hint': str|None, 'penalty': int}.
    """
    rng = rng or random
    if rng.random() < TREAT_CHANCE:
        hints = build_hints(case)
        if hints_given < len(hints):
            return {"kind": "treat", "message": "TREAT! A free clue for you:",
                    "hint": hints[hints_given], "penalty": 0}
        return {"kind": "treat", "message": rng.choice(TREAT_FLAVOUR), "hint": None, "penalty": 0}
    return {"kind": "trick", "message": rng.choice(TRICKS), "hint": None, "penalty": TRICK_PENALTY}


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
ROOM_POINTS, HOUR_POINTS, ENTITY_POINTS = 40, 30, 30
HOUR_NEAR_POINTS = 15
MAX_TIME_BONUS = 20


def hour_distance(a: int, b: int) -> int:
    d = abs(a - b) % 24
    return min(d, 24 - d)


def score_accusation(case: Case, room: str, hour: int, entity: str,
                     seconds: float, penalty: int = 0) -> dict:
    """Score a final accusation.

    accuracy (0-100): room 40 + hour 30 (15 if off by one hour) + culprit 30.
    speed bonus (0-20): only if accuracy >= 70, so rushing a wrong guess never wins.
    final = (accuracy + speed bonus - trick penalties) x difficulty multiplier.
    """
    a, cfg = case.answer, DIFFICULTY[case.difficulty]
    room_ok = room == a["room"]
    dist = hour_distance(hour, a["hour"])
    hour_pts = HOUR_POINTS if dist == 0 else HOUR_NEAR_POINTS if dist == 1 else 0
    entity_ok = entity == a["entity"]

    accuracy = (ROOM_POINTS if room_ok else 0) + hour_pts + (ENTITY_POINTS if entity_ok else 0)
    speed_bonus = 0
    if accuracy >= 70:
        speed_bonus = round(max(0.0, MAX_TIME_BONUS * (1 - seconds / cfg["par_seconds"])))
    final = max(0, round((accuracy + speed_bonus - penalty) * cfg["multiplier"]))
    return {
        "room_ok": room_ok, "hour_pts": hour_pts, "hour_exact": dist == 0,
        "entity_ok": entity_ok, "accuracy": accuracy, "speed_bonus": speed_bonus,
        "penalty": penalty, "multiplier": cfg["multiplier"], "final": final,
        "solved": accuracy == 100, "seconds": round(seconds),
    }


def fmt_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def entity_names() -> list[str]:
    return list(ENTITIES)
