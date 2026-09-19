"""
ai_engine.py — Enhanced Prediction Engine for Expense Tracker (SIH 2026)

Drop-in replacement / merge target for your existing backend/ai_engine.py.
Adds: weighted moving-average forecasting, day-of-week seasonality,
trend detection (linear regression), confidence scoring, category-wise
forecasts, and a safe daily spending limit calculator.

Dependencies: numpy (already in your scikit-learn stack)
"""

from __future__ import annotations
from collections import defaultdict
from datetime import date, timedelta
from typing import List, Dict, Optional
import numpy as np


class PredictionEngine:
    """
    Expects `expenses` as a list of dicts:
        {"date": "YYYY-MM-DD" or date obj, "amount": float, "category": str}
    All amounts assumed positive (spend).
    """

    def __init__(self, expenses: List[Dict], month_start: Optional[date] = None):
        self.month_start = month_start or date.today().replace(day=1)
        self.today = date.today()
        self.expenses = self._normalize(expenses)

    # ---------- data prep ----------

    def _normalize(self, expenses: List[Dict]) -> List[Dict]:
        out = []
        for e in expenses:
            d = e["date"]
            if isinstance(d, str):
                d = date.fromisoformat(d)
            if d >= self.month_start:  # only current month for MTD forecast
                out.append({"date": d, "amount": float(e["amount"]), "category": e.get("category", "Other")})
        return sorted(out, key=lambda x: x["date"])

    def _daily_totals(self) -> Dict[date, float]:
        totals = defaultdict(float)
        for e in self.expenses:
            totals[e["date"]] += e["amount"]
        return totals

    # ---------- core forecasting ----------

    def _weighted_moving_average(self, values: List[float], window: int = 7) -> float:
        """Exponentially weighted average — recent days count more."""
        if not values:
            return 0.0
        recent = values[-window:]
        weights = np.exp(np.linspace(-1, 0, len(recent)))  # older -> smaller weight
        weights /= weights.sum()
        return float(np.dot(recent, weights))

    def _trend_slope(self, values: List[float]) -> float:
        """Linear regression slope of daily spend — rupees/day drift."""
        if len(values) < 3:
            return 0.0
        x = np.arange(len(values))
        slope, _ = np.polyfit(x, values, 1)
        return float(slope)

    def _seasonal_index(self) -> Dict[int, float]:
        """
        Average spend by weekday (0=Mon..6=Sun) relative to overall daily
        average. >1 means that weekday historically spends more.
        """
        daily = self._daily_totals()
        if not daily:
            return {i: 1.0 for i in range(7)}
        by_weekday = defaultdict(list)
        for d, amt in daily.items():
            by_weekday[d.weekday()].append(amt)
        overall_avg = np.mean(list(daily.values())) or 1.0
        index = {}
        for wd in range(7):
            vals = by_weekday.get(wd)
            index[wd] = float(np.mean(vals) / overall_avg) if vals else 1.0
        return index

    def _confidence_score(self, values: List[float]) -> int:
        """
        0-100 confidence based on how much data we have and how
        consistent (low variance) recent spending is. Coefficient of
        variation drives the penalty.
        """
        n = len(values)
        if n < 3:
            return 20  # not enough data — low confidence, say so in UI
        cv = (np.std(values) / np.mean(values)) if np.mean(values) else 1.0
        data_score = min(n / 20, 1.0) * 60          # up to 60 pts for data volume
        stability_score = max(0, 1 - min(cv, 1.5) / 1.5) * 40  # up to 40 pts for consistency
        return int(round(data_score + stability_score))

    # ---------- public API ----------

    def forecast_month_end(self, monthly_income: float) -> Dict:
        daily = self._daily_totals()
        values = [daily[d] for d in sorted(daily.keys())]

        if not values:
            return {
                "predicted_total": 0.0,
                "safe_daily_limit": round(monthly_income / 30, 2) if monthly_income else 0.0,
                "confidence": 0,
                "trend": "insufficient_data",
                "message": "Log a few expenses to unlock predictions.",
            }

        days_elapsed = (self.today - self.month_start).days + 1
        days_in_month = self._days_in_month(self.month_start)
        days_remaining = max(days_in_month - days_elapsed, 0)

        spent_so_far = sum(values)
        wma = self._weighted_moving_average(values)
        slope = self._trend_slope(values)
        seasonal = self._seasonal_index()

        # project remaining days: WMA drifted by trend slope, adjusted per weekday seasonality
        projected_remaining = 0.0
        for i in range(1, days_remaining + 1):
            future_date = self.today + timedelta(days=i)
            base = max(wma + slope * i, 0)
            projected_remaining += base * seasonal.get(future_date.weekday(), 1.0)

        predicted_total = round(spent_so_far + projected_remaining, 2)
        confidence = self._confidence_score(values)

        remaining_budget = max(monthly_income - spent_so_far, 0)
        safe_daily_limit = round(remaining_budget / days_remaining, 2) if days_remaining else 0.0

        trend_label = "rising" if slope > 5 else "falling" if slope < -5 else "stable"

        return {
            "predicted_total": predicted_total,
            "spent_so_far": round(spent_so_far, 2),
            "days_remaining": days_remaining,
            "safe_daily_limit": safe_daily_limit,
            "confidence": confidence,
            "trend": trend_label,
            "will_exceed_budget": predicted_total > monthly_income if monthly_income else False,
            "projected_overspend": round(max(predicted_total - monthly_income, 0), 2) if monthly_income else 0.0,
        }

    def category_forecast(self) -> List[Dict]:
        """Per-category month-end projection, sorted by projected spend desc."""
        by_cat = defaultdict(list)
        for e in self.expenses:
            by_cat[e["category"]].append(e)

        days_elapsed = (self.today - self.month_start).days + 1
        days_in_month = self._days_in_month(self.month_start)

        results = []
        for cat, items in by_cat.items():
            total = sum(i["amount"] for i in items)
            daily_avg = total / days_elapsed if days_elapsed else 0
            projected = round(daily_avg * days_in_month, 2)
            results.append({
                "category": cat,
                "spent_so_far": round(total, 2),
                "projected_month_total": projected,
                "transaction_count": len(items),
            })
        return sorted(results, key=lambda r: r["projected_month_total"], reverse=True)

    @staticmethod
    def _days_in_month(d: date) -> int:
        next_month = d.replace(day=28) + timedelta(days=4)
        return (next_month - timedelta(days=next_month.day)).day
