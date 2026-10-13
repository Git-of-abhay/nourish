from typing import Protocol


class GoalRule(Protocol):
    goal: str
    def message(self, profile: dict, today_meals: list[dict], minutes: int, kcal: int) -> str: ...


class MoveMoreRule:
    goal = "move_more"

    def message(self, profile, today_meals, minutes, kcal):
        return (f"Nice, you moved for {minutes} minutes today. A stretch might feel good next."
                if minutes else "Fancy a short walk? It can help you ease into moving more.")


class CalorieAwarenessRule:
    goal = "calorie_awareness"

    def message(self, profile, today_meals, minutes, kcal):
        if not today_meals:
            return "Log one meal and we’ll start spotting your eating pattern."
        return f"You’ve logged about {kcal} of your {profile['target_kcal']} kcal target. You can tweak any estimate."


class EatConsistentlyRule:
    goal = "eat_consistently"

    def message(self, profile, today_meals, minutes, kcal):
        return ("Nice, a meal is logged. Add the next one when you eat."
                if today_meals else "Add a meal when you’re ready so we can spot your routine.")


class FeelBetterRule:
    goal = "feel_better"

    def message(self, profile, today_meals, minutes, kcal):
        return ("You checked in today. Little patterns get clearer with time."
                if today_meals or minutes else "Want to log a meal or a little movement? We’ll start there.")


OBSTACLE_SUFFIX = {
    "forget": " A quick nudge can help tomorrow.",
    "changing_routine": " One check-in still counts.",
    "portion_size": " Estimates are okay.",
    "exploring": " Go at your pace.",
}


class InsightService:
    """Composes registered goal rules; new goals do not change the dashboard route."""

    def __init__(self, rules: list[GoalRule] | None = None):
        selected = rules or [MoveMoreRule(), CalorieAwarenessRule(), EatConsistentlyRule(), FeelBetterRule()]
        self.rules = {rule.goal: rule for rule in selected}

    def build(self, profile: dict, meals: list[dict], workouts: list[dict], today: str):
        today_meals = [m for m in meals if m["logged_on"] == today]
        today_workouts = [w for w in workouts if w["logged_on"] == today]
        kcal = sum(m["kcal"] for m in today_meals)
        minutes = sum(w["minutes"] for w in today_workouts)
        rule = self.rules[profile["goal"]]
        suggestion = rule.message(profile, today_meals, minutes, kcal) + OBSTACLE_SUFFIX[profile["obstacle"]]
        if len(meals) >= 3:
            recent_days = len({m["logged_on"] for m in meals[:20]})
            if recent_days >= 3 and profile["goal"] != "move_more":
                suggestion += f" You’ve shown up on {recent_days} days."
        return {"today_kcal": kcal, "today_meals": len(today_meals), "today_workout_minutes": minutes, "suggestion": suggestion, "target_kcal": profile["target_kcal"]}
