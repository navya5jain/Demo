"""Ladder of Why - API server (Flask).

Run from the project root:

    python -m backend.app          # http://127.0.0.1:8000

Routes
    GET  /api/health                     which engine is answering
    GET  /api/me                         rank, XP, badges for this player
    GET  /api/history                    this player's past cases
    POST /api/sessions                   {scenario} -> a new ladder
    GET  /api/sessions/<id>              resume a case
    POST /api/sessions/<id>/answers      {idx, answer} -> score + feedback
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from . import db, game, llm

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
PLAYER_COOKIE = "ladder_player"
COOKIE_MAX_AGE = 60 * 60 * 24 * 365

app = Flask(__name__, static_folder=None)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def current_player() -> str:
    """Resolve the anonymous player for this request, minting one if needed."""
    return db.ensure_player(request.cookies.get(PLAYER_COOKIE))


def with_player_cookie(payload, player_id: str, status: int = 200):
    response = jsonify(payload)
    response.status_code = status
    if request.cookies.get(PLAYER_COOKIE) != player_id:
        response.set_cookie(PLAYER_COOKIE, player_id, max_age=COOKIE_MAX_AGE, samesite="Lax")
    return response


def public_rung(row: dict) -> dict:
    """Everything the client may see. `good_answer` stays server-side so the
    grading rubric cannot be read out of the page."""
    return {
        "idx": row["idx"],
        "type": row["type"],
        "title": row["title"],
        "concept": row["concept"],
        "question": row["question"],
        "answer": row.get("answer"),
        "score": row.get("score"),
        "feedback": row.get("feedback"),
    }


def public_session(session: dict) -> dict:
    rungs = [public_rung(r) for r in session["rungs"]]
    answered = sum(1 for r in rungs if r["score"] is not None)
    return {
        "id": session["id"],
        "scenario": session["scenario"],
        "offline": session["offline"],
        "completed_at": session["completed_at"],
        "avg_score": session["avg_score"],
        "rungs": rungs,
        "current_idx": answered if answered < len(rungs) else None,
    }


def me_payload(player_id: str) -> dict:
    stats = db.player_stats(player_id)
    return {
        **game.rank_for_xp(stats["xp"]),
        "cases_closed": stats["cases_closed"],
        "best_avg": stats["best_avg"],
        "badges": game.describe_badges(stats["badge_codes"]),
    }


def body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({"ok": True, **llm.provider_info()})


@app.get("/api/me")
def me():
    pid = current_player()
    return with_player_cookie(me_payload(pid), pid)


@app.get("/api/history")
def history():
    pid = current_player()
    return with_player_cookie({"cases": db.history(pid)}, pid)


@app.post("/api/sessions")
def start_session():
    pid = current_player()
    scenario = str(body().get("scenario") or "").strip()
    if len(scenario) < 3:
        return with_player_cookie({"detail": "Describe what happened first."}, pid, 400)
    if len(scenario) > 2000:
        return with_player_cookie({"detail": "That is too long - a paragraph is plenty."}, pid, 400)

    try:
        rungs = llm.generate_ladder(scenario)
    except llm.LLMError as exc:
        return with_player_cookie({"detail": str(exc)}, pid, 502)

    sid = db.create_session(pid, scenario, rungs, llm.active_provider() == "mock")
    return with_player_cookie(public_session(db.get_session(sid)), pid)


@app.get("/api/sessions/<session_id>")
def read_session(session_id: str):
    session = db.get_session(session_id)
    if not session:
        return jsonify({"detail": "No such case."}), 404
    return jsonify(public_session(session))


@app.post("/api/sessions/<session_id>/answers")
def submit_answer(session_id: str):
    pid = current_player()
    payload = body()
    session = db.get_session(session_id)
    if not session:
        return with_player_cookie({"detail": "No such case."}, pid, 404)

    try:
        idx = int(payload.get("idx"))
    except (TypeError, ValueError):
        return with_player_cookie({"detail": "Which rung? `idx` must be a number."}, pid, 400)

    answer = str(payload.get("answer") or "").strip()
    if not answer:
        return with_player_cookie({"detail": "Write an answer before submitting."}, pid, 400)
    if not 0 <= idx < len(session["rungs"]):
        return with_player_cookie({"detail": "That rung is not on this ladder."}, pid, 400)

    rung = session["rungs"][idx]
    if rung["score"] is not None:
        return with_player_cookie({"detail": "That rung is already answered."}, pid, 409)

    grading_input = {
        "level": rung["idx"] + 1,
        "title": rung["title"],
        "concept": rung["concept"],
        "question": rung["question"],
        "good_answer_looks_like": rung["good_answer"] or "",
    }
    try:
        result = llm.grade_answer(session["scenario"], grading_input, answer)
    except llm.LLMError as exc:
        return with_player_cookie({"detail": str(exc)}, pid, 502)

    db.record_answer(session_id, idx, answer, result["score"], result["feedback"])
    gained = game.xp_for_answer(result["score"])

    updated = db.get_session(session_id)
    scores = [r["score"] for r in updated["rungs"] if r["score"] is not None]
    done = len(scores) == len(updated["rungs"])

    new_badges: list[str] = []
    avg = None
    if done:
        avg = sum(scores) / len(scores)
        db.complete_session(session_id, avg)
        gained += game.CASE_COMPLETION_BONUS
        closed = db.player_stats(pid)["cases_closed"]
        new_badges = db.award_badges(pid, game.badges_earned(updated["rungs"], closed))

    db.add_xp(pid, gained)

    return with_player_cookie(
        {
            "score": result["score"],
            "feedback": result["feedback"],
            "xp_gained": gained,
            "done": done,
            "avg_score": round(avg, 2) if avg is not None else None,
            "new_badges": game.describe_badges(new_badges),
            "me": me_payload(pid),
            "session": public_session(updated),
        },
        pid,
    )


# --------------------------------------------------------------------------
# frontend
# --------------------------------------------------------------------------

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    print(f"Ladder of Why - engine: {llm.provider_info()}")
    print(f"Open http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=bool(os.getenv("DEBUG")))


if __name__ == "__main__":
    main()
