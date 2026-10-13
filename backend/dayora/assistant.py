import uuid

from .analysis import AnalysisUnavailable
from .services import _text


class AssistantService:
    """Answers bounded questions from the user's actual logs; never invents measurements."""

    def __init__(self, store, insights, chat_model):
        self.store = store
        self.insights = insights
        self.chat_model = chat_model

    def ask(self, profile, question, today):
        question = _text(question, "question", 300)
        meals = self.store.list_meals(profile["id"])
        workouts = self.store.list_workouts(profile["id"])
        insight = self.insights.build(profile, meals, workouts, today)
        lower = question.lower()
        if any(word in lower for word in ("meal", "food", "eat", "calorie")):
            if insight["today_meals"]:
                names = ", ".join(item["name"] for item in meals if item["logged_on"] == today)[:180]
                count = insight["today_meals"]
                reply = f"You logged {count} {'meal' if count == 1 else 'meals'} today: {names}. The total is about {insight['today_kcal']} kcal; portions and photo estimates can vary."
            else:
                reply = "You have not logged a meal today. Add one meal to start noticing your pattern."
        elif any(word in lower for word in ("move", "workout", "walk", "exercise", "step")):
            reply = (f"You have logged {insight['today_workout_minutes']} minutes of activity today. Choose a comfortable next step from the Move tab."
                     if insight["today_workout_minutes"] else "No activity is logged today. A short walk or stretch is one option if it feels comfortable.")
        elif any(word in lower for word in ("report", "blood", "test", "lab")):
            reports = self.store.list_reports(profile["id"])
            reply = ("Your latest saved report is " + reports[0]["title"] + ". Open Reports to review its values against the original document. I cannot diagnose a condition from them."
                     if reports else "No report summary is saved yet. You can upload one in Reports and confirm any extracted values before saving.")
        elif any(word in lower for word in ("goal", "today", "doing", "next", "improve", "progress")):
            reply = insight["suggestion"]
        else:
            reply = "I can help you understand today's meals, movement, goal progress, or a saved report. Try asking one of those, or use a suggested question below."
        if not any(word in lower for word in ("report", "blood", "test", "lab")):
            facts = {
                "goal": profile["goal"],
                "obstacle": profile["obstacle"],
                "activity_level": profile["activity_level"],
                "today": today,
                "meals_today": [{"name": meal["name"], "kcal_estimate": meal["kcal"]} for meal in meals if meal["logged_on"] == today][:10],
                "movement_today": [{"activity": workout["activity"], "minutes": workout["minutes"]} for workout in workouts if workout["logged_on"] == today][:10],
                "total_kcal_estimate": insight["today_kcal"],
                "chosen_kcal_target": profile["target_kcal"],
                "starting_suggestion": reply,
            }
            try:
                reply = self.chat_model.answer(question, facts, self.store.list_chat_messages(profile["id"]))
            except AnalysisUnavailable:
                pass
        self.store.add_chat_message(str(uuid.uuid4()), profile["id"], "user", question)
        self.store.add_chat_message(str(uuid.uuid4()), profile["id"], "assistant", reply)
        return {"answer": reply}
