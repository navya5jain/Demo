# Ladder of Why

A critical-thinking game built on epistemology. The player describes something that
really happened to them — an accident, an argument, a failed exam — and the app builds
a **ladder of 3–5 questions about that specific situation**, each rung demanding more
careful reasoning than the last:

| Rung type | What it trains |
|---|---|
| `immediate` | Separating what you observed from what you inferred |
| `deeper_cause` | Root-cause reasoning: the cause behind the cause |
| `assumptions_evidence` | Naming an assumption, and what would disconfirm it |
| `alternative` | Competing explanations, other people's accounts |
| `principle` | The transferable lesson, tied to a named bias or fallacy |

Every answer is scored 1–5 with feedback written against that answer, and the player
earns XP, ranks (Curious Novice → Rigorous Epistemologist) and badges
(Root Cause Finder, Assumption Buster, …).

A simple situation gets a 3-rung ladder; a rich one gets 5. The model decides.

---

## Run it

```bash
pip install -r requirements.txt     # one dependency: Flask
python -m backend.app               # http://127.0.0.1:8000
```

That works immediately, with **no API key**: the app falls back to an offline
template engine so the whole loop is playable and demoable. The questions are
generic in that mode.

To get questions actually written for the player's situation, add a key:

```bash
cp .env.example .env
# edit .env:
#   LLM_PROVIDER=anthropic
#   ANTHROPIC_API_KEY=sk-ant-...
python -m backend.app
```

The footer of the page always tells you which engine answered.

### Providers

| `LLM_PROVIDER` | Needs | Notes |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | Ladders use `claude-sonnet-5`, grading uses `claude-haiku-4-5-20251001` (cheap, and grading is a short task). Override with `ANTHROPIC_MODEL`. |
| `openai_compatible` | `OPENAI_API_KEY` | Any `/v1/chat/completions` endpoint — OpenAI, Groq, OpenRouter, or a local Ollama/LM Studio via `OPENAI_BASE_URL`. Set `OPENAI_MODEL`. |
| `mock` | nothing | Offline templates + a heuristic grader. Always available. |

Unset `LLM_PROVIDER` and the app auto-detects: Claude key → Claude, OpenAI key →
OpenAI, otherwise offline.

## Test

```bash
python -m unittest discover -s tests -t . -v
```

15 tests, all running against the offline provider, so they need no key and no
network: ladder shape, rubric never leaking to the client, XP and badge awards,
double-answer rejection, resume, history.

---

## How it is put together

```
backend/
  app.py       Flask routes, anonymous player cookie, serves the frontend
  llm.py       provider adapters (Claude / OpenAI-compatible / offline mock)
  prompts.py   the two prompts — ladder generation and answer grading
  game.py      XP, ranks, badges (pure functions, unit-tested)
  db.py        SQLite: players, sessions, rungs, badges
frontend/      index.html + styles.css + app.js, no build step, installable as a PWA
tests/         end-to-end API tests on the offline provider
```

Three decisions worth knowing:

**The grading rubric never reaches the browser.** When a ladder is generated the model
also writes a `good_answer_looks_like` line per rung. It is stored server-side and used
to grade, but `public_rung()` strips it, so a player cannot read the answer key out of
the page source.

**Ladder generation and grading use different models.** Generating a good ladder is a
reasoning task; grading one short answer against a rubric is not. Splitting them keeps
the per-case cost roughly at one strong call plus a few cheap ones.

**Player identity is one anonymous cookie.** No login, no personal data. Good enough for
a prototype and a demo; swap `current_player()` in `app.py` for real auth if you need it.

## API

| Route | Does |
|---|---|
| `GET /api/health` | which engine is answering |
| `GET /api/me` | rank, XP, progress, badges |
| `GET /api/history` | this player's past cases |
| `POST /api/sessions` | `{scenario}` → a new ladder |
| `GET /api/sessions/<id>` | resume a case in progress |
| `POST /api/sessions/<id>/answers` | `{idx, answer}` → score, feedback, XP, badges |

## Where to take it next

- **Phone app.** The frontend is already responsive and has a web manifest, so it
  installs from the browser as-is. For a store build, keep this backend and put
  React Native or Flutter in front of the same six endpoints.
- **Streaming.** Grading currently blocks until the model replies. Server-sent
  events would let feedback type out as it is written.
- **Multiplayer.** Two players answer the same rung, then see each other's reasoning
  before scoring — the disagreement is where the epistemology actually bites.
- **Curated campaigns.** Pre-written scenarios grouped by bias (a "confirmation bias"
  set, a "correlation vs causation" set) alongside the free-text mode.
- **Spaced repetition.** Resurface a player's own weakest rung type a week later.
