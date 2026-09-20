"""Game rules: XP, ranks and badges.

Pure functions with no I/O, so the progression can be tuned and unit-tested
without touching the database or the model.
"""

from __future__ import annotations

# XP is awarded per rung, so a thoughtful 3-rung case can beat a lazy 5-rung one.
XP_PER_POINT = 10
CASE_COMPLETION_BONUS = 25

RANKS = [
    (0, "Curious Novice"),
    (150, "Careful Thinker"),
    (400, "Sharp Reasoner"),
    (800, "Evidence Hunter"),
    (1400, "Rigorous Epistemologist"),
]

# code -> (display name, what earns it)
BADGES = {
    "first_case": ("First Case Closed", "Finish your first ladder."),
    "root_cause": ("Root Cause Finder", "Score 4+ on a 'cause behind the cause' rung."),
    "assumption_buster": ("Assumption Buster", "Score 4+ on an assumptions-and-evidence rung."),
    "perspective_taker": ("Perspective Taker", "Score 4+ on an alternative-viewpoint rung."),
    "principle_seeker": ("Principle Seeker", "Score 4+ on a general-lesson rung."),
    "clean_climb": ("Clean Climb", "Average 4.0 or better across a whole ladder."),
    "persistent": ("Persistent Thinker", "Close five cases."),
}

_TYPE_BADGE = {
    "deeper_cause": "root_cause",
    "assumptions_evidence": "assumption_buster",
    "alternative": "perspective_taker",
    "principle": "principle_seeker",
}


def xp_for_answer(score: int) -> int:
    return max(0, int(score)) * XP_PER_POINT


def rank_for_xp(xp: int) -> dict:
    """Current rank plus progress toward the next one, for the XP bar."""
    name = RANKS[0][1]
    index = 0
    for i, (threshold, label) in enumerate(RANKS):
        if xp >= threshold:
            name, index = label, i
    floor = RANKS[index][0]
    if index + 1 < len(RANKS):
        ceiling = RANKS[index + 1][0]
        next_name = RANKS[index + 1][1]
        span = ceiling - floor
        progress = (xp - floor) / span if span else 1.0
    else:
        ceiling, next_name, progress = xp, None, 1.0
    return {
        "level": index + 1,
        "rank": name,
        "xp": xp,
        "next_rank": next_name,
        "xp_into_rank": xp - floor,
        "xp_for_next": (ceiling - floor) if next_name else 0,
        "progress": round(min(1.0, max(0.0, progress)), 3),
    }


def badges_earned(rungs: list[dict], cases_closed: int) -> list[str]:
    """Badge codes a just-finished case qualifies for."""
    earned: list[str] = []
    scores = [r.get("score") or 0 for r in rungs]

    if cases_closed >= 1:
        earned.append("first_case")
    if cases_closed >= 5:
        earned.append("persistent")
    if scores and sum(scores) / len(scores) >= 4.0:
        earned.append("clean_climb")

    for rung in rungs:
        code = _TYPE_BADGE.get(rung.get("type", ""))
        if code and (rung.get("score") or 0) >= 4:
            earned.append(code)

    seen: set[str] = set()
    return [c for c in earned if not (c in seen or seen.add(c))]


def describe_badges(codes: list[str]) -> list[dict]:
    return [
        {"code": c, "name": BADGES[c][0], "how": BADGES[c][1]}
        for c in codes
        if c in BADGES
    ]
