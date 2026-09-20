"""Prompt construction for Ladder of Why.

All model-facing text lives here so the game's pedagogy can be tuned in one
place, separately from transport (llm.py) and state (db.py).
"""

import json

# The fixed escalation. A ladder always starts at RUNG_TYPES[0] and always
# ends at RUNG_TYPES[-1]; the middle is filled in order, depending on how much
# the situation can bear.
RUNG_TYPES = [
    ("immediate", "the concrete, observable cause or trigger of what happened"),
    ("deeper_cause", "one level further: the condition, decision, habit or system that produced that immediate cause"),
    ("assumptions_evidence", "an assumption the player is making, and what evidence would confirm or disconfirm it"),
    ("alternative", "a competing explanation, or how another person involved would describe the same events"),
    ("principle", "the general, transferable lesson about how the player forms beliefs, tied to a named concept"),
]

NAMED_CONCEPTS = (
    "confirmation bias, hindsight bias, correlation vs causation, availability heuristic, "
    "fundamental attribution error, survivorship bias, base-rate neglect, anecdotal evidence, "
    "post hoc ergo propter hoc, motivated reasoning, the narrative fallacy"
)


def ladder_prompt(scenario: str) -> str:
    """Ask the model for a ladder of 3-5 rungs about one specific situation."""
    type_lines = "\n".join(
        f"{i + 1}. {key} - {desc}." for i, (key, desc) in enumerate(RUNG_TYPES)
    )
    return (
        "You are a Socratic critical-thinking coach building one round of a reasoning game "
        'called "Ladder of Why". A player describes something that really happened to them, '
        "and you build a ladder of escalating questions about THAT SPECIFIC SITUATION.\n\n"
        "The rung types, in fixed order:\n"
        f"{type_lines}\n\n"
        "Decide how many rungs this situation deserves: 3 for a simple, single-cause "
        "situation, up to 5 for a rich, multi-cause one. Always start with the "
        "'immediate' type and always end with the 'principle' type; fill the middle from "
        "the remaining types in order.\n\n"
        f"Player's situation: {json.dumps(scenario)}\n\n"
        "Rules for the questions:\n"
        "- Every question must reference actual details the player gave. Never a generic "
        "template question that could be asked of any situation.\n"
        "- One question per rung, one sentence, ending in a question mark.\n"
        "- Each rung must be answerable by the player from what they know or can reason "
        "about; do not demand data they cannot have.\n"
        "- Be warm and curious, never interrogating or judgemental.\n"
        f"- For the final rung, name a real concept where one fits: {NAMED_CONCEPTS}.\n"
        "- 'concept' is the critical-thinking skill the rung trains, at most 4 words.\n"
        "- 'good_answer_looks_like' is one sentence describing what a strong answer would "
        "contain. The player never sees it; it is used to grade them.\n\n"
        "Reply with ONLY a JSON array, one object per rung, in exactly this shape:\n"
        '[{"level": 1, "type": "immediate", "title": "<=5 word label", '
        '"concept": "<=4 words", "question": "the specific question", '
        '"good_answer_looks_like": "one sentence"}]'
    )


def grade_prompt(scenario: str, rung: dict, answer: str) -> str:
    """Ask the model to score one answer and give feedback tied to that answer."""
    return (
        'You are grading one rung of the critical-thinking game "Ladder of Why". '
        "You are generous with genuine reasoning and strict with hand-waving.\n\n"
        f"Situation: {json.dumps(scenario)}\n"
        f"Rung {rung['level']} ({rung['title']}) trains: {rung['concept']}\n"
        f"Question asked: {json.dumps(rung['question'])}\n"
        f"A strong answer would: {json.dumps(rung.get('good_answer_looks_like', ''))}\n"
        f"Player's answer: {json.dumps(answer)}\n\n"
        "Score the reasoning 1-5:\n"
        "5 - specific, evidence-aware, and it avoids the pitfall this rung is about.\n"
        "4 - solid reasoning with a concrete detail, one step short of rigorous.\n"
        "3 - reasonable but generic; true of many situations, not just this one.\n"
        "2 - asserts a cause without support, or drifts off the question.\n"
        "1 - missing, off-topic, or restates the question.\n\n"
        "Then write feedback in exactly two short sentences: first name ONE specific "
        "strength in what they actually wrote (quote a few of their own words), then give "
        "ONE concrete way to sharpen it. Address the player as 'you'. Never give generic "
        "advice that would fit any answer.\n\n"
        'Reply with ONLY JSON: {"score": <int 1-5>, "feedback": "<two sentences>"}'
    )
