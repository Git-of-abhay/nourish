"""Motivation: streaks, badges, and the 'what and why' focus card."""
from datetime import date, timedelta

WEEKLY_MINUTES = 150


def _day(value: str) -> date:
    return date.fromisoformat(value)


class GamificationService:
    """Any meal or movement counts for the day. Pure function of the stats, so it is easy to test."""

    def build(self, stats: dict, today: str) -> dict:
        active = set(stats["active_dates"])
        t = _day(today)
        # A streak survives until the end of today, so yesterday still counts while today is empty.
        cursor = t if today in active else t - timedelta(days=1)
        streak = 0
        while cursor.isoformat() in active:
            streak += 1
            cursor -= timedelta(days=1)

        best = run = 0
        previous = None
        for day in sorted(_day(d) for d in active):
            run = run + 1 if previous is not None and day == previous + timedelta(days=1) else 1
            best = max(best, run)
            previous = day

        week = [{"date": (t - timedelta(days=6 - i)).isoformat(), "active": (t - timedelta(days=6 - i)).isoformat() in active} for i in range(7)]

        def badge(id_, title, detail, earned):
            return {"id": id_, "title": title, "detail": detail, "earned": earned}

        return {
            "streak": streak,
            "streak_at_risk": streak > 0 and today not in active,
            "best_streak": best,
            "week": week,
            "active_days_this_week": sum(1 for d in week if d["active"]),
            "badges": [
                badge("first_meal", "First bite", "Log your first meal", stats["meal_count"] >= 1),
                badge("first_move", "First step", "Log your first movement", stats["total_minutes"] >= 1),
                badge("streak_3", "Three in a row", "Check in 3 days in a row", best >= 3),
                badge("streak_7", "Full week", "Check in 7 days in a row", best >= 7),
                badge("move_100", "Century", "Move for 100 minutes in total", stats["total_minutes"] >= 100),
                badge("photo_log", "Say cheese", "Log a meal with a photo", stats["photo_meals"] >= 1),
                badge("voice_log", "Say it out loud", "Log a meal by voice", stats["voice_meals"] >= 1),
                badge("first_report", "Know your numbers", "Save a health report", stats["report_count"] >= 1),
            ],
        }


class FocusService:
    """Tells the user WHAT to work on and WHY, with one number they can watch move."""

    def build(self, profile: dict, today_meals: list[dict], week_minutes: int, active_days_this_week: int) -> dict:
        kcal = sum(m["kcal"] for m in today_meals)
        goal = profile["goal"]
        if goal == "move_more":
            return {"title": "Move a little more, most days",
                    "why": "Regular movement supports your heart, mood and energy. Adults are generally advised about 150 minutes a week, and short bouts count.",
                    "progress": {"label": "Movement this week", "value": week_minutes, "target": WEEKLY_MINUTES, "unit": "min"}}
        if goal == "calorie_awareness":
            return {"title": "Know where your day adds up",
                    "why": "Seeing your meals against the target you chose makes patterns visible, without strict rules or guilt.",
                    "progress": {"label": "Food today", "value": kcal, "target": profile["target_kcal"] or 2000, "unit": "kcal"}}
        if goal == "eat_consistently":
            return {"title": "Build a steady meal routine",
                    "why": "Regular meals help keep your energy even and make it easier to notice what works for you.",
                    "progress": {"label": "Meals today", "value": len(today_meals), "target": 3, "unit": "meals"}}
        return {"title": "Check in a little every day",
                "why": "Small daily check-ins are the easiest habit to keep, and they show you what actually helps you feel good.",
                "progress": {"label": "Check-in days this week", "value": active_days_this_week, "target": 5, "unit": "days"}}
