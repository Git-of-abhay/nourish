import unittest

from nourish.progress import FocusService, GamificationService

STATS = {"active_dates": [], "total_minutes": 0, "meal_count": 0, "photo_meals": 0, "voice_meals": 0, "report_count": 0}


class StreakTests(unittest.TestCase):
    def build(self, dates, today="2026-10-14", **extra):
        return GamificationService().build({**STATS, "active_dates": dates, **extra}, today)

    def test_no_activity(self):
        progress = self.build([])
        self.assertEqual(progress["streak"], 0)
        self.assertFalse(progress["streak_at_risk"])
        self.assertEqual(progress["active_days_this_week"], 0)
        self.assertFalse(any(b["earned"] for b in progress["badges"]))

    def test_streak_counts_back_from_today(self):
        progress = self.build(["2026-10-12", "2026-10-13", "2026-10-14"])
        self.assertEqual(progress["streak"], 3)
        self.assertFalse(progress["streak_at_risk"])

    def test_yesterday_keeps_streak_alive_but_at_risk(self):
        progress = self.build(["2026-10-12", "2026-10-13"])
        self.assertEqual(progress["streak"], 2)
        self.assertTrue(progress["streak_at_risk"])

    def test_gap_breaks_the_streak_but_best_is_remembered(self):
        progress = self.build(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-14"])
        self.assertEqual(progress["streak"], 1)
        self.assertEqual(progress["best_streak"], 3)
        self.assertTrue(next(b for b in progress["badges"] if b["id"] == "streak_3")["earned"])

    def test_week_strip_is_seven_days_ending_today(self):
        week = self.build(["2026-10-14", "2026-10-10"])["week"]
        self.assertEqual(len(week), 7)
        self.assertEqual(week[-1], {"date": "2026-10-14", "active": True})
        self.assertEqual(week[0]["date"], "2026-10-08")

    def test_badges_follow_totals(self):
        badges = {b["id"]: b["earned"] for b in self.build(["2026-10-14"], meal_count=1, total_minutes=120, photo_meals=1, voice_meals=1, report_count=1)["badges"]}
        self.assertTrue(all(badges[k] for k in ("first_meal", "first_move", "move_100", "photo_log", "voice_log", "first_report")))
        self.assertFalse(badges["streak_7"])


class FocusTests(unittest.TestCase):
    def profile(self, goal, target=None):
        return {"goal": goal, "target_kcal": target}

    def test_each_goal_has_what_why_and_progress(self):
        meals = [{"kcal": 400}, {"kcal": 250}]
        for goal, target in (("move_more", None), ("calorie_awareness", 2000), ("eat_consistently", None), ("feel_better", None)):
            focus = FocusService().build(self.profile(goal, target), meals, 60, 3)
            self.assertTrue(focus["title"] and focus["why"], goal)
            self.assertGreater(focus["progress"]["target"], 0)

    def test_progress_values(self):
        service = FocusService()
        self.assertEqual(service.build(self.profile("move_more"), [], 60, 3)["progress"]["value"], 60)
        self.assertEqual(service.build(self.profile("calorie_awareness", 1800), [{"kcal": 650}], 0, 0)["progress"], {"label": "Food today", "value": 650, "target": 1800, "unit": "kcal"})
        self.assertEqual(service.build(self.profile("eat_consistently"), [{"kcal": 1}], 0, 0)["progress"]["value"], 1)
        self.assertEqual(service.build(self.profile("feel_better"), [], 0, 4)["progress"]["value"], 4)


if __name__ == "__main__":
    unittest.main()
