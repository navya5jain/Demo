"""The Ghost Report: a spooky case summary built from the REAL data of the case."""

from __future__ import annotations

from datetime import timedelta

from config import ENTITIES, START
from game import fmt_hour


def ghost_report(case) -> str:
    """Return a markdown story using the actual numbers from the case's data."""
    a = case.answer
    df = case.readings
    room, hour, entity = a["room"], a["hour"], a["entity"]
    info = ENTITIES[entity]

    in_room = df[df["room"] == room]
    haunt_dates = [(START + timedelta(days=d)).date() for d in a["haunt_days"]]
    event = in_room[(in_room["timestamp"].dt.hour == hour)
                    & (in_room["timestamp"].dt.date.isin(haunt_dates))]
    temp_drop = in_room["temperature"].median() - event["temperature"].mean()
    emf_ratio = event["emf"].mean() / max(in_room["emf"].median(), 1e-6)

    clue_reports = case.reports[(case.reports["room"] == room)
                                & (case.reports["keyword"] == info["clue"])]
    witnesses = case.guests[case.guests["room"] == room]["guest"].tolist()[:2]
    first = haunt_dates[0].strftime("%A, %d %B")

    lines = [
        f"### 🕯️ Ghost Report - *{case.title}*",
        f"**The culprit:** {entity}",
        f"**The scene:** the {room}, around **{fmt_hour(hour)}**",
        "",
        f"On {first}, the {room} fell quiet and cold. At {fmt_hour(hour)} the thermometer "
        f"dropped **{temp_drop:.1f} °C** below the room's normal, while electromagnetic "
        f"activity climbed to **{emf_ratio:.1f}x** its usual level.",
        "",
        f"It did not stop there. The same hour, the same room, on **{len(haunt_dates)} separate nights**. "
        f"A random glitch never repeats itself - a ghost does.",
        "",
        f"Guests reported *“{info['clue'].lower()}”* **{len(clue_reports)} times** "
        f"from that room, the signature of {entity}.",
    ]
    if witnesses:
        lines.append(f"The brave souls {' and '.join(witnesses)} slept in the {room} all week "
                     "and never got a good night's sleep again.")
    lines += ["", f"*{info['lore']}*"]
    if a["decoy_rooms"]:
        rooms_txt = " and ".join(a["decoy_rooms"])
        lines.append(f"\n🔎 Red herrings: the {rooms_txt} had a harmless "
                     "one-off event - no recurrence, no ghost.")
    if a["glitch_room"]:
        lines.append(f"⚡ The {a['glitch_room']} had a faulty EMF sensor throwing random spikes.")
    return "\n".join(lines)
