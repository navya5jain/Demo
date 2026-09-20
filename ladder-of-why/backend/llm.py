"""LLM transport for Ladder of Why.

Three providers, chosen by the LLM_PROVIDER env var:

  anthropic          Claude via the Messages API          (needs ANTHROPIC_API_KEY)
  openai_compatible  any /v1/chat/completions endpoint    (needs OPENAI_API_KEY)
                     - OpenAI, Groq, OpenRouter, LM Studio, Ollama, vLLM ...
  mock               no network, no key, deterministic    (always available)

If LLM_PROVIDER is unset, the app picks the first provider whose key is present
and otherwise falls back to "mock", so the game runs with zero setup.

HTTP goes through urllib from the standard library, so the whole backend needs
exactly one third-party package (Flask).
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

from . import prompts

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"

# Verified against platform.claude.com/docs/en/about-claude/models/overview.
# Ladders need reasoning; grading is short and repetitive, so it gets the fast model.
DEFAULT_ANTHROPIC_LADDER_MODEL = "claude-sonnet-5"
DEFAULT_ANTHROPIC_GRADE_MODEL = "claude-haiku-4-5-20251001"

TIMEOUT_SECONDS = 90


class LLMError(RuntimeError):
    """Raised when a provider call fails in a way the API layer should report."""


# --------------------------------------------------------------------------
# provider selection
# --------------------------------------------------------------------------

def active_provider() -> str:
    explicit = os.getenv("LLM_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.getenv("OPENAI_API_KEY"):
        return "openai_compatible"
    return "mock"


def provider_info() -> dict[str, Any]:
    """What /api/health reports, and what the UI shows in its footer."""
    provider = active_provider()
    if provider == "anthropic":
        model = os.getenv("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_LADDER_MODEL)
    elif provider == "openai_compatible":
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    else:
        model = "offline-templates"
    return {"provider": provider, "model": model, "live": provider != "mock"}


# --------------------------------------------------------------------------
# JSON extraction
# --------------------------------------------------------------------------

def extract_json(text: str) -> Any:
    """Parse the first JSON value in a model reply, tolerating prose and fences."""
    text = (text or "").strip()
    if not text:
        raise LLMError("The model returned an empty reply.")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fenced = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    for opener, closer in (("[", "]"), ("{", "}")):
        start, end = text.find(opener), text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue

    raise LLMError("The model reply did not contain valid JSON.")


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

def _post_json(url: str, payload: dict, headers: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise LLMError(f"{url} returned {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise LLMError(f"Could not reach {url}: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise LLMError("The provider returned a non-JSON response.") from exc


def _call_anthropic(prompt: str, *, model: str, max_tokens: int) -> str:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise LLMError("ANTHROPIC_API_KEY is not set.")
    data = _post_json(
        ANTHROPIC_URL,
        {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
        {
            "x-api-key": key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
    )
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


def _call_openai_compatible(prompt: str, *, model: str, max_tokens: int) -> str:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise LLMError("OPENAI_API_KEY is not set.")
    base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    data = _post_json(
        f"{base}/chat/completions",
        {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise LLMError("Unexpected response shape from the chat completions endpoint.") from exc


def complete(prompt: str, *, kind: str) -> str:
    """Send one prompt. `kind` is 'ladder' or 'grade', and only picks the model."""
    provider = active_provider()
    max_tokens = 2000 if kind == "ladder" else 400
    if provider == "anthropic":
        default = DEFAULT_ANTHROPIC_LADDER_MODEL if kind == "ladder" else DEFAULT_ANTHROPIC_GRADE_MODEL
        return _call_anthropic(prompt, model=os.getenv("ANTHROPIC_MODEL", default), max_tokens=max_tokens)
    if provider == "openai_compatible":
        return _call_openai_compatible(
            prompt, model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), max_tokens=max_tokens
        )
    raise LLMError(f"Unknown provider: {provider}")


# --------------------------------------------------------------------------
# offline mock - keeps the whole game playable with no key and no network
# --------------------------------------------------------------------------

def _mock_ladder(scenario: str) -> list[dict]:
    snippet = scenario.strip().rstrip(".")
    if len(snippet) > 70:
        snippet = snippet[:67].rsplit(" ", 1)[0] + "..."
    full = [
        {
            "level": 1,
            "type": "immediate",
            "title": "What actually happened",
            "concept": "observation",
            "question": f'Walk through "{snippet}" step by step: what is the first concrete thing that went wrong?',
            "good_answer_looks_like": "Names a specific observable trigger rather than a vague summary.",
        },
        {
            "level": 2,
            "type": "deeper_cause",
            "title": "The cause behind that",
            "concept": "root cause",
            "question": "Why was that first thing able to happen at all, and what decision or habit set it up?",
            "good_answer_looks_like": "Goes one causal level deeper than the surface trigger.",
        },
        {
            "level": 3,
            "type": "assumptions_evidence",
            "title": "Check your assumption",
            "concept": "evidence",
            "question": "What are you taking for granted here that you have not verified, and what would show you were wrong?",
            "good_answer_looks_like": "States a real assumption plus a concrete disconfirming test.",
        },
        {
            "level": 4,
            "type": "alternative",
            "title": "Someone else's account",
            "concept": "perspective",
            "question": "If another person there told this story, what would they say caused it instead?",
            "good_answer_looks_like": "Offers a plausible competing account rather than a strawman.",
        },
        {
            "level": 5,
            "type": "principle",
            "title": "The general lesson",
            "concept": "self-awareness",
            "question": "What does your first explanation reveal about how you usually judge causes, and what is that tendency called?",
            "good_answer_looks_like": "Names a transferable reasoning habit, ideally with a real term for it.",
        },
    ]
    # A thin situation gets a shorter ladder, the same call a live model makes.
    if len(scenario.split()) < 8:
        chosen = [full[0], full[2], full[4]]
        for i, rung in enumerate(chosen, start=1):
            rung["level"] = i
        return chosen
    return full


CAUSAL_MARKERS = (
    "because", "since", "due to", "caused", "led to", "so that", "therefore",
    "which meant", "as a result", "if", "unless", "assume", "evidence", "maybe",
    "might", "could", "instead", "however", "although", "whereas",
)


def _mock_grade(rung: dict, answer: str) -> dict:
    words = [w for w in re.split(r"\s+", answer.strip()) if w]
    count = len(words)
    markers = sum(1 for m in CAUSAL_MARKERS if m in answer.lower())

    score = 1
    if count >= 5:
        score = 2
    if count >= 12 and markers >= 1:
        score = 3
    if count >= 20 and markers >= 2:
        score = 4
    if count >= 35 and markers >= 3:
        score = 5

    if count < 5:
        feedback = (
            "That is too short to show your reasoning. "
            "Write a full sentence saying why you think so, and what makes you confident."
        )
    elif score <= 3:
        feedback = (
            f"You are engaging with the {rung['concept']} question rather than dodging it. "
            "Push one step further: add a concrete detail from your own situation and say why it matters."
        )
    else:
        feedback = (
            "You give a specific cause and connect it to something you actually observed. "
            "To go further, say what would have to be true for your explanation to be wrong."
        )
    return {"score": score, "feedback": feedback, "offline": True}


# --------------------------------------------------------------------------
# public API used by app.py
# --------------------------------------------------------------------------

def generate_ladder(scenario: str) -> list[dict]:
    """Return 3-5 validated rungs for one scenario."""
    if active_provider() == "mock":
        return _mock_ladder(scenario)

    data = extract_json(complete(prompts.ladder_prompt(scenario), kind="ladder"))
    if not isinstance(data, list):
        raise LLMError("Expected a JSON array of rungs.")

    rungs: list[dict] = []
    for i, item in enumerate(data[:5], start=1):
        if not isinstance(item, dict) or not item.get("question"):
            continue
        rungs.append(
            {
                "level": i,
                "type": str(item.get("type") or prompts.RUNG_TYPES[min(i - 1, 4)][0]),
                "title": str(item.get("title") or f"Rung {i}").strip()[:60],
                "concept": str(item.get("concept") or "reasoning").strip()[:40],
                "question": str(item["question"]).strip(),
                "good_answer_looks_like": str(item.get("good_answer_looks_like") or "").strip(),
            }
        )
    if len(rungs) < 3:
        raise LLMError("The model returned fewer than 3 usable rungs.")
    return rungs


def grade_answer(scenario: str, rung: dict, answer: str) -> dict:
    """Score one answer 1-5 with feedback tied to what the player wrote."""
    if active_provider() == "mock":
        return _mock_grade(rung, answer)

    data = extract_json(complete(prompts.grade_prompt(scenario, rung, answer), kind="grade"))
    if not isinstance(data, dict) or "score" not in data:
        raise LLMError("Expected JSON with a score.")
    try:
        score = max(1, min(5, int(round(float(data["score"])))))
    except (TypeError, ValueError) as exc:
        raise LLMError("The model returned a non-numeric score.") from exc
    feedback = str(data.get("feedback") or "").strip() or "Scored, but no feedback was returned."
    return {"score": score, "feedback": feedback, "offline": False}
