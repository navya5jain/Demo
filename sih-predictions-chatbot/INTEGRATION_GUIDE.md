# Predictions + AI Chatbot — Integration Guide

## Backend (Flask)
1. Drop `ai_engine.py` in place of / merged into your existing `backend/ai_engine.py`.
2. Add `chatbot_engine.py` to `backend/`.
3. Add `requests` to `requirements.txt` if it isn't already there (`pip install requests`).
4. Merge the routes from `routes_additions.py` into your `routes.py`, swapping
   `get_user_expenses()` / `get_user_income()` for your real SQLAlchemy queries.
5. (Optional but recommended) set `GEMINI_API_KEY` as an environment variable
   for real conversational replies. Without it, the chatbot still works —
   it just uses the rule-based fallback, which is the same safety net you
   already mention in your Q&A prep ("rule-based fallback if the AI is down").

## Frontend (React)
1. Add `Predictions.js` + `Predictions.css` to `frontend/src/components/`,
   replacing your current `Predictions.js`.
2. Add `Chatbot.js` + `Chatbot.css` to the same folder.
3. Render `<Chatbot userId={currentUser.id} />` once near the root of your
   app (e.g. in `App.js`) so it floats on every page.
4. `chart.js` is already in your stack — no new npm installs needed.

## What changed vs. your old predictions
- Old: a flat average.
- New: weighted moving average (recent days count more) + linear trend +
  day-of-week seasonality + a 0–100 confidence score, so the UI says
  "62% confidence" instead of presenting a guess as fact.
- Category-wise forecast added — shows where the money's actually going.
- Safe daily limit is now derived (remaining budget ÷ days left), matching
  what your pitch script already promises live.

## Demo-day tip
Seed the demo account with expenses across at least 5-6 different days
before presenting. The confidence score and trend line look thin with
only 1-2 data points, and judges notice that kind of thing.
