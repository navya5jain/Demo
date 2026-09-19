"""
chatbot_engine.py — AI Financial Assistant for Expense Tracker (SIH 2026)

Two-tier design (matches what you already told the judges in your pitch
Q&A: "rule-based fallback if the AI is down"):
  1. Tries the Gemini API for a natural, conversational answer grounded
     in the student's own data.
  2. Falls back to a rule-based intent matcher if no API key is set,
     the request fails, or the network drops — so the demo NEVER
     breaks on stage.

Set GEMINI_API_KEY as an environment variable. Without it, the chatbot
still works fully via the rule-based engine.
"""

import os
import re
import requests
from typing import Dict, Optional

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-1.5-flash:generateContent"
)

SYSTEM_INSTRUCTIONS = """You are a friendly financial assistant inside a student expense-tracking app.
Rules:
- Only give general budgeting guidance grounded in the numbers provided below. Never give investment, tax, or loan advice.
- Be concise: 2-4 sentences, no long essays.
- If the student is close to or over budget, be direct but encouraging, not alarming.
- Always base numbers on the CONTEXT block below — never invent figures.
"""


class FinanceChatbot:
    def __init__(self, use_gemini: bool = True):
        self.use_gemini = use_gemini and bool(GEMINI_API_KEY)

    # ---------- context ----------

    def build_context(self, user_data: Dict) -> str:
        """
        user_data expected keys (all optional, engine degrades gracefully):
          income, spent_so_far, predicted_total, safe_daily_limit,
          days_remaining, confidence, category_forecast (list),
          welfare_score
        """
        lines = []
        if "income" in user_data:
            lines.append(f"Monthly income: Rs {user_data['income']}")
        if "spent_so_far" in user_data:
            lines.append(f"Spent so far this month: Rs {user_data['spent_so_far']}")
        if "predicted_total" in user_data:
            lines.append(f"Predicted month-end total: Rs {user_data['predicted_total']}")
        if "safe_daily_limit" in user_data:
            lines.append(f"Safe daily spending limit: Rs {user_data['safe_daily_limit']}")
        if "days_remaining" in user_data:
            lines.append(f"Days left in month: {user_data['days_remaining']}")
        if "welfare_score" in user_data:
            lines.append(f"Financial Welfare Score: {user_data['welfare_score']}/100")
        if user_data.get("category_forecast"):
            top = user_data["category_forecast"][:3]
            cat_str = ", ".join(f"{c['category']}: Rs {c['projected_month_total']}" for c in top)
            lines.append(f"Top spending categories (projected): {cat_str}")
        return "\n".join(lines) if lines else "No expense data logged yet this month."

    # ---------- main entry ----------

    def get_response(self, message: str, user_data: Dict) -> Dict:
        context = self.build_context(user_data)

        if self.use_gemini:
            reply = self._ask_gemini(message, context)
            if reply:
                return {"reply": reply, "source": "gemini"}

        # fallback — always succeeds
        return {"reply": self._rule_based(message, user_data), "source": "rule_based"}

    # ---------- Gemini call ----------

    def _ask_gemini(self, message: str, context: str) -> Optional[str]:
        try:
            payload = {
                "contents": [{
                    "parts": [{
                        "text": f"{SYSTEM_INSTRUCTIONS}\n\nCONTEXT:\n{context}\n\nSTUDENT ASKS: {message}"
                    }]
                }]
            }
            resp = requests.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json=payload,
                timeout=6,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            return None  # silent fallback — never crash the chat

    # ---------- rule-based fallback ----------

    def _rule_based(self, message: str, user_data: Dict) -> str:
        msg = message.lower()

        limit = user_data.get("safe_daily_limit")
        income = user_data.get("income")
        predicted = user_data.get("predicted_total")
        score = user_data.get("welfare_score")
        cats = user_data.get("category_forecast", [])

        if re.search(r"spend.*today|daily limit|how much.*today", msg):
            if limit is not None:
                return f"You can safely spend up to Rs {limit} today and stay on track for the month."
            return "Log a few expenses first so I can calculate your safe daily limit."

        if re.search(r"over budget|exceed|too much", msg):
            if predicted and income:
                if predicted > income:
                    over = round(predicted - income, 2)
                    return f"At this pace you're projected to go Rs {over} over budget by month-end. Try trimming your top category below."
                return "You're on track — projected spend is within your budget."
            return "Add your monthly income in settings so I can check this for you."

        if re.search(r"save|saving|goal", msg):
            return "A good rule: automatically set aside 10-20% of income the day it arrives, before spending starts. Want me to check what's realistic given your current pace?"

        if re.search(r"category|where.*spend|top spend", msg):
            if cats:
                top = cats[0]
                return f"Your highest projected category is {top['category']} at Rs {top['projected_month_total']} this month."
            return "No category data yet — add a few expenses and ask me again."

        if re.search(r"welfare score|financial score|how am i doing", msg):
            if score is not None:
                tail = "Solid — keep it up." if score >= 70 else "There's room to improve, mostly by smoothing out daily spending."
                return f"Your Financial Welfare Score is {score}/100. {tail}"
            return "Your Welfare Score will appear once you've logged expenses for a few days."

        return ("I can help with your daily spending limit, budget status, savings tips, "
                "or your top spending categories — try asking about one of those.")
