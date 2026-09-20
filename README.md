# Demo

A collection of projects: an accessibility-first game hub, a standalone accessible security-triage game, a predictions + AI-chatbot module for a student expense tracker (SIH project), and a critical-thinking game built on epistemology.

## Unity Quest (`unity-quest/`)

**One game, every ability.** A multiplayer game hub where Deaf, Blind, Mute, and sighted/hearing players can all compete fairly in the same match — no player ever gets a shorter or easier version of a game.

- **Adaptive Fairness Engine** (`js/accessibility.js`) — game code never talks to the DOM directly; it calls `AFE.announce(text, opts)` with a sense-neutral message, and the AFE decides which channels (visual / audio / haptic) to fire based on the active player's profile. Every channel is always attempted — a profile changes emphasis, never withholds information.
- **AI Accessibility Assistant** (`js/assistant.js`) — a rule-based scaffold (zero API keys needed for the MVP) with clean seams (`explainRules`, `hint`, `suggestSettings`) for swapping in a real LLM later.
- **Storage** (`js/storage.js`) — the only module that touches `localStorage` (players, scores, achievements, tournaments); swappable for real HTTP calls without touching the rest of the app.
- **Modes** (`js/modes.js`) — Solo / 1v1 / Team / Tournament orchestration; mounts the shared HUD + caption bar + assistant shell around each game.
- **Games** (`js/games/`):
  - **Memory Pulse** — reproduce a sequence; every flash fires a visual highlight, a tone, and a vibration together, so it's fully playable by sight alone or by ear/touch alone.
  - **Pattern Breaker** — find the missing element; shapes are never color-only (silhouette + text label + optional spoken description).
  - **Rapid Logic** — timed logic puzzles, screen-reader friendly by nature, with visual+audio+haptic countdown.
  - **Signal Sync** — reaction/rhythm game; each signal fires a visual ring, tone, and vibration at once.
  - **UNITY Final** — flagship 3-seat team challenge (Seer / Hearer / Operator); seats exchange info only through the Quick Signals panel, so it works regardless of who can hear or speak.

Run it: open `unity-quest/index.html` in a browser.

## Triad Shift (`triad-shift.html`)

A security triage game with three solo play modes — **Deaf**, **Blind**, and **Mute** — each designed to let a player complete the full shift independently, regardless of ability. Built by Team Infinity Loop.

Run it: open `triad-shift.html` directly in a browser (single-file app).

## SIH Predictions + AI Chatbot (`sih-predictions-chatbot/`)

A drop-in module for a student expense-tracker app, adding smarter predictions and a finance chatbot. See `sih-predictions-chatbot/INTEGRATION_GUIDE.md` for the full merge steps — summary below.

**Backend** (`backend/`, Flask)
- `ai_engine.py` — `PredictionEngine`: weighted moving-average forecasting + linear trend + day-of-week seasonality + a 0–100 confidence score + category-wise forecasts + a safe daily spending limit.
- `chatbot_engine.py` — `FinanceChatbot`: tries Gemini (`GEMINI_API_KEY` env var) for natural replies grounded in the user's own numbers, and always has a rule-based fallback so the chatbot never breaks on stage.
- `routes_additions.py` — Flask blueprints exposing `GET /api/predictions/<user_id>` and `POST /api/chatbot`; `get_user_expenses()` / `get_user_income()` are stubs meant to be swapped for real SQLAlchemy queries.

**Frontend** (`frontend/src/components/`, React)
- `Predictions.js` / `.css` — month-end prediction card with a confidence badge and a category-spend bar chart (chart.js).
- `Chatbot.js` / `.css` — floating chat widget; calls `POST /api/chatbot` and renders the conversation.

This folder is a set of source files meant to be merged into an existing backend/frontend project (see the integration guide) — it isn't a standalone runnable app on its own.

## Ladder of Why (`ladder-of-why/`)

A critical-thinking game built on epistemology. The player describes something that really happened to them, and the app builds a ladder of 3–5 questions about that specific situation, each rung demanding more careful reasoning than the last (immediate observation vs. inference, root-cause, assumptions/evidence, alternative explanations, transferable principle). Answers are scored 1–5 with feedback, and the player earns XP, ranks, and badges.

Run it: `pip install -r ladder-of-why/requirements.txt && python -m backend.app` from inside `ladder-of-why/` (see `ladder-of-why/README.md` for full setup, including LLM provider config).
