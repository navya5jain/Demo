"""Case generator.

`generate_case(difficulty, seed)` builds one complete, self-contained case:
    * hourly sensor readings for every room (temperature, EMF, noise)
    * a guest register
    * witness reports (the clue that identifies the ghost)
    * a hidden answer (which room, which hour, which ghost)

The same seed always produces the same case, which makes the project easy to
test and to demo.  A new random seed gives a brand-new case.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import timedelta

import numpy as np
import pandas as pd

from config import (
    BASE_EMF_SPIKE, BASE_NOISE_SPIKE, BASE_TEMP_DROP, CASE_TITLES, CLUE_TO_ENTITY,
    DAYS, DIFFICULTY, ENTITIES, GUEST_NAMES, HAUNT_HOURS, ROOMS, START,
)


@dataclass
class Case:
    case_id: str
    title: str
    difficulty: str
    seed: int
    readings: pd.DataFrame
    guests: pd.DataFrame
    reports: pd.DataFrame
    answer: dict = field(repr=False)


def _inject(temp, emf, noise, idx, factor, strength):
    """Add a haunting-sized disturbance at the given row positions."""
    temp[idx] -= BASE_TEMP_DROP * strength * factor
    emf[idx] += BASE_EMF_SPIKE * strength * factor
    noise[idx] += BASE_NOISE_SPIKE * strength * factor


def generate_case(difficulty: str = "Easy", seed: int | None = None) -> Case:
    cfg = DIFFICULTY[difficulty]
    if seed is None:
        seed = random.randint(10_000, 99_999)
    rng = np.random.default_rng(seed)

    times = pd.date_range(START, periods=DAYS * 24, freq="h")
    n = len(times)
    hours = times.hour.to_numpy()
    nm, strength = cfg["noise_mult"], cfg["strength"]

    # ---- the hidden truth --------------------------------------------------
    room_names = list(ROOMS)
    haunted_room = str(rng.choice(room_names))
    haunt_hour = int(rng.choice(HAUNT_HOURS))
    entity = str(rng.choice(list(ENTITIES)))
    haunt_days = sorted(int(d) for d in rng.choice(DAYS, size=cfg["nights"], replace=False))

    others = [r for r in room_names if r != haunted_room]
    decoy_rooms = [str(r) for r in rng.choice(others, size=cfg["decoys"], replace=False)]
    remaining = [r for r in others if r not in decoy_rooms]
    glitch_room = str(rng.choice(remaining)) if cfg["glitch"] else None

    # ---- sensor readings ---------------------------------------------------
    frames = []
    for room, p in ROOMS.items():
        temp = p["temp"] + 0.4 * np.sin(2 * np.pi * (hours - 15) / 24) + rng.normal(0, 0.8 * nm, n)
        emf = p["emf"] + rng.normal(0, 3.0 * nm, n)
        daytime = np.where((hours >= 8) & (hours < 22), 6.0, 0.0)
        noise = p["noise"] + daytime + rng.normal(0, 3.0 * nm, n)

        if room == haunted_room:  # the real haunting: same hour, several nights
            for d in haunt_days:
                i = d * 24 + haunt_hour
                _inject(temp, emf, noise, i, 1.0, strength)
                if i + 1 < n:  # the effect lingers, weaker, for one more hour
                    _inject(temp, emf, noise, i + 1, 0.5, strength)

        if room in decoy_rooms:  # a harmless one-off event at a random time
            d = int(rng.integers(0, DAYS))
            start = int(rng.integers(0, 21))
            for k in range(3):
                i = d * 24 + start + k
                if i < n:
                    _inject(temp, emf, noise, i, 0.9, strength)

        if room == glitch_room:  # a broken EMF sensor: random wild readings
            idx = rng.choice(n, size=cfg["glitch"], replace=False)
            emf[idx] = rng.uniform(70, 110, size=len(idx))

        frames.append(pd.DataFrame({
            "timestamp": times, "room": room,
            "temperature": np.round(temp, 1), "emf": np.round(emf, 1),
            "noise_db": np.round(noise, 1),
        }))
    readings = pd.concat(frames, ignore_index=True)

    # ---- witness reports (the clue that names the ghost) --------------------
    clue = ENTITIES[entity]["clue"]
    other_clues = [c for c in CLUE_TO_ENTITY if c != clue]
    rows = []
    for d in haunt_days:
        for _ in range(int(rng.poisson(2.5)) + 1):  # at least one report per haunting
            ts = START + timedelta(days=d, hours=haunt_hour, minutes=int(rng.integers(0, 60)))
            kw = clue if rng.random() < cfg["report_hit"] else str(rng.choice(other_clues))
            rows.append((ts, haunted_room, kw))
    for _ in range(cfg["report_noise"]):  # unrelated, random reports
        ts = START + timedelta(hours=int(rng.integers(0, n)), minutes=int(rng.integers(0, 60)))
        rows.append((ts, str(rng.choice(room_names)), str(rng.choice(list(CLUE_TO_ENTITY)))))
    reports = pd.DataFrame(rows, columns=["timestamp", "room", "keyword"])
    reports = reports.sort_values("timestamp").reset_index(drop=True)

    # ---- guest register ----------------------------------------------------
    names = list(rng.permutation(GUEST_NAMES))
    guest_rows = []
    for g in names[:2]:  # two guests stayed in the haunted room all week
        guest_rows.append((g, haunted_room, START, START + timedelta(days=DAYS)))
    for g in names[2:9]:
        r = str(rng.choice(room_names))
        c_in = int(rng.integers(0, DAYS - 1))
        c_out = min(DAYS, c_in + int(rng.integers(2, 5)))
        guest_rows.append((g, r, START + timedelta(days=c_in), START + timedelta(days=c_out)))
    guests = pd.DataFrame(guest_rows, columns=["guest", "room", "check_in", "check_out"])

    answer = {
        "room": haunted_room, "hour": haunt_hour, "entity": entity,
        "haunt_days": haunt_days, "decoy_rooms": decoy_rooms, "glitch_room": glitch_room,
    }
    title = f"{CASE_TITLES[seed % len(CASE_TITLES)]}"
    return Case(
        case_id=f"{difficulty[0]}-{seed}", title=title, difficulty=difficulty,
        seed=seed, readings=readings, guests=guests, reports=reports, answer=answer,
    )
