import uuid

from .analysis import AnalysisUnavailable
from .services import _text

REPORT_WORDS = ("report", "blood", "test", "lab", "cholesterol", "sugar", "vitamin", "hba1c")


class AssistantService:
    """Answers bounded questions from the user's actual logs; never invents measurements."""

    def __init__(self, store, insights, chat_model, reports, gamification):
        self.store = store
        self.insights = insights
        self.chat_model = chat_model
        self.reports = reports
        self.gamification = gamification

    def ask(self, profile, question, today):
        question = _text(question, "question", 300)
        meals = self.store.list_meals(profile["id"])
        workouts = self.store.list_workouts(profile["id"])
        progress = self.gamification.build(self.store.activity_stats(profile["id"]), today)
        insight = self.insights.build(profile, meals, workouts, today, progress)
        lower = question.lower()
        report_question = any(word in lower for word in REPORT_WORDS)
        if not report_question and any(word in lower for word in ("meal", "food", "eat", "calorie")):
            if insight["today_meals"]:
                names = ", ".join(item["name"] for item in meals if item["logged_on"] == today)[:180]
                count = insight["today_meals"]
                reply = f"You logged {count} {'meal' if count == 1 else 'meals'} today: {names}. The total is about {insight['today_kcal']} kcal; portions and photo estimates can vary."
            else:
                reply = "You have not logged a meal today. Add one meal to start noticing your pattern."
        elif not report_question and any(word in lower for word in ("move", "workout", "walk", "exercise", "step")):
            reply = (f"You have logged {insight['today_workout_minutes']} minutes of activity today. Choose a comfortable next step from the Move tab."
                     if insight["today_workout_minutes"] else "No activity is logged today. A short walk or stretch is one option if it feels comfortable.")
        elif report_question:
            trends = self.reports.trends(profile["id"], profile["goal"])
            if trends:
                parts = []
                for item in trends[:4]:
                    flag = {"above": " (above the range on your report)", "below": " (below the range on your report)"}.get(item["latest"]["status"], "")
                    parts.append(f"{item['label']} {item['latest']['value']:g}{(' ' + item['unit']) if item['unit'] else ''}{flag}")
                reply = "Here is what your saved reports show: " + ", ".join(parts) + ". I can’t diagnose anything from these, so a clinician is the right person to read them with you."
            else:
                reply = "No report is saved yet. Upload one in Reports and I’ll track the numbers for you."
        elif any(word in lower for word in ("goal", "today", "doing", "next", "improve", "progress")):
            reply = insight["suggestion"]
        else:
            reply = "I can help you understand today's meals, movement, goal progress, or a saved report. Try asking one of those, or use a suggested question below."
        if not report_question:
            facts = {
                "goal": profile["goal"],
                "obstacle": profile["obstacle"],
                "activity_level": profile["activity_level"],
                "today": today,
                "meals_today": [{"name": meal["name"], "kcal_estimate": meal["kcal"]} for meal in meals if meal["logged_on"] == today][:10],
                "movement_today": [{"activity": workout["activity"], "minutes": workout["minutes"]} for workout in workouts if workout["logged_on"] == today][:10],
                "total_kcal_estimate": insight["today_kcal"],
                "chosen_kcal_target": profile["target_kcal"],
                "streak_days": progress["streak"],
                "starting_suggestion": reply,
            }
            try:
                reply = self.chat_model.answer(question, facts, self.store.list_chat_messages(profile["id"]))
            except AnalysisUnavailable:
                pass
        self.store.add_chat_message(str(uuid.uuid4()), profile["id"], "user", question)
        self.store.add_chat_message(str(uuid.uuid4()), profile["id"], "assistant", reply)
        return {"answer": reply}
