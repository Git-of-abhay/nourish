import io
import tempfile
import unittest
from datetime import date
from pathlib import Path

from nourish import create_app
from nourish.analysis import AnalysisUnavailable, detect_file_type


TODAY = date.today().isoformat()
GUEST = {"name": "Sam", "goal": "move_more", "obstacle": "forget", "reminder": "off", "activity_level": "beginner", "target_kcal": None}
MEAL = {"name": "Rice", "portion": "1 cup", "kcal": 205, "source": "manual", "logged_on": TODAY}


class FakeTranscriber:
    text = "I had two rotis and dal"

    def transcribe(self, _content, _mime, _extension):
        return self.text


class FakeParser:
    def estimate_text(self, text):
        if "nothing" in text:
            return {"foods": [], "items": [], "kcal": None, "portion": "", "description": text, "uncertainty": ""}
        return {"foods": ["roti", "dal"], "items": [{"name": "roti", "quantity": 2, "unit": "", "portion": "2 medium rotis", "kcal": 240}, {"name": "dal", "quantity": 3, "unit": "cup", "portion": "3 cups", "kcal": 600}],
                "kcal": 840, "portion": "roti: 2 medium rotis; dal: 3 cups", "description": text, "uncertainty": "Portions were assumed."}


class FakeAnalyzer:
    def analyze_meal(self, _content, _mime):
        return {"foods": ["rice"], "description": "Rice is visible", "uncertainty": "Portion is uncertain"}

    def analyze_report(self, _content, _mime):
        return {"title": "Lab report", "summary": "One value was legible.", "metrics": [{"name": "Glucose", "value": "95", "unit": "mg/dL", "reference": "70-99"}]}


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.temp.name) / "db.sqlite3")
        self.app = create_app({"TESTING": True, "DATABASE_PATH": self.db_path})
        self.app.services["analyzer"] = FakeAnalyzer()
        self.app.services["transcriber"] = FakeTranscriber()
        self.app.services["meal_parser"] = FakeParser()
        self.client = self.app.test_client()
        result = self.client.post("/api/guests", json=GUEST)
        self.assertEqual(result.status_code, 201)
        self.token = result.json["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.temp.cleanup()

    def test_missing_and_invalid_token(self):
        self.assertEqual(self.client.get("/api/me").status_code, 401)
        self.assertEqual(self.client.get("/api/me", headers={"Authorization": "Bearer bogus"}).status_code, 401)

    def test_guest_rejects_invalid_goal(self):
        self.assertEqual(self.client.post("/api/guests", json={**GUEST, "goal": "diagnose_me"}).status_code, 400)

    def test_calorie_goal_requires_valid_target(self):
        base = {**GUEST, "goal": "calorie_awareness"}
        for target in (None, 0, 7000, True, 123.5, "abc"):
            with self.subTest(target=target):
                self.assertEqual(self.client.post("/api/guests", json={**base, "target_kcal": target}).status_code, 400)
        self.assertEqual(self.client.post("/api/guests", json={**base, "target_kcal": 2000}).status_code, 201)

    def test_other_goal_cannot_sneak_in_target(self):
        self.assertEqual(self.client.post("/api/guests", json={**GUEST, "target_kcal": 2000}).status_code, 400)

    def test_invalid_meal_fields(self):
        for change in ({"name": ""}, {"name": "x" * 101}, {"portion": ""}, {"kcal": -1}, {"kcal": 5001}, {"kcal": 1.5}, {"kcal": True}, {"source": "model_saved"}):
            with self.subTest(change=change):
                self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, **change}).status_code, 400)

    def test_invalid_or_future_date(self):
        for day in ("2026-99-99", "3026-01-01", "2020-01-01", None):
            with self.subTest(day=day):
                self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, "logged_on": day}).status_code, 400)

    def test_profile_isolation_on_meal_delete(self):
        meal = self.client.post("/api/meals", headers=self.headers, json=MEAL).json
        another = self.client.post("/api/guests", json={**GUEST, "name": "Other"}).json["token"]
        other_headers = {"Authorization": f"Bearer {another}"}
        self.assertEqual(self.client.delete(f"/api/meals/{meal['id']}", headers=other_headers).status_code, 404)
        self.assertEqual(len(self.client.get("/api/meals", headers=self.headers).json), 1)
        self.assertEqual(self.client.delete(f"/api/meals/{meal['id']}", headers=self.headers).status_code, 204)

    def test_dashboard_uses_local_logged_on(self):
        self.client.post("/api/meals", headers=self.headers, json=MEAL)
        data = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json
        self.assertEqual(data["insight"]["today_kcal"], 205)
        self.assertEqual(data["insight"]["today_meals"], 1)
        self.assertEqual(self.client.get("/api/dashboard?today=nope", headers=self.headers).status_code, 400)

    def test_workout_validation_and_insight(self):
        for minutes in (0, 301, "x", 1.5):
            with self.subTest(minutes=minutes):
                self.assertEqual(self.client.post("/api/workouts", headers=self.headers, json={"activity": "walk", "minutes": minutes, "logged_on": TODAY}).status_code, 400)
        self.assertEqual(self.client.post("/api/workouts", headers=self.headers, json={"activity": "walk", "minutes": 20, "logged_on": TODAY}).status_code, 201)
        data = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json
        self.assertEqual(data["insight"]["today_workout_minutes"], 20)

    def test_photo_type_and_empty_file(self):
        for content in (b"", b"not an image"):
            with self.subTest(content=content):
                response = self.client.post("/api/analyze/meal", headers=self.headers, data={"file": (io.BytesIO(content), "food.jpg")})
                self.assertEqual(response.status_code, 400)
        self.assertIsNone(detect_file_type(b"%PDF-1.0", allow_pdf=False))

    def test_photo_analysis_success_and_failure(self):
        content = b"\xff\xd8\xff" + b"x" * 20
        response = self.client.post("/api/analyze/meal", headers=self.headers, data={"file": (io.BytesIO(content), "meal.jpg")})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["foods"], ["rice"])
        class BrokenAnalyzer:
            def analyze_meal(self, *_args): raise AnalysisUnavailable("try manual")
        self.app.services["analyzer"] = BrokenAnalyzer()
        response = self.client.post("/api/analyze/meal", headers=self.headers, data={"file": (io.BytesIO(content), "meal.jpg")})
        self.assertEqual(response.status_code, 503)

    def test_photo_analysis_accepts_base64_json(self):
        import base64
        content = b"\xff\xd8\xff" + b"x" * 20
        response = self.client.post("/api/analyze/meal", headers=self.headers, json={"file_base64": base64.b64encode(content).decode()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["foods"], ["rice"])
        self.assertEqual(self.client.post("/api/analyze/meal", headers=self.headers, json={"file_base64": "!!!"}).status_code, 400)
        self.assertEqual(self.client.post("/api/analyze/meal", headers=self.headers, json={}).status_code, 400)

    def audio_body(self):
        import base64
        return {"file_base64": base64.b64encode(b"\x00\x00\x00\x18ftypM4A " + b"x" * 40).decode()}

    def test_voice_meal_is_transcribed_and_parsed(self):
        response = self.client.post("/api/analyze/voice", headers=self.headers, json=self.audio_body())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["transcript"], "I had two rotis and dal")
        self.assertEqual(response.json["foods"], ["roti", "dal"])
        self.assertEqual(response.json["items"][1]["kcal"], 600)
        self.assertEqual(response.json["kcal"], 840)

    def test_describing_a_meal_in_words_is_estimated_too(self):
        response = self.client.post("/api/analyze/text", headers=self.headers, json={"text": "3 cups of dal and 2 rotis"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["kcal"], 840)
        self.assertEqual(response.json["transcript"], "3 cups of dal and 2 rotis")
        self.assertEqual(self.client.post("/api/analyze/text", headers=self.headers, json={"text": "nothing edible"}).status_code, 422)
        for bad in ({}, {"text": ""}, {"text": "x" * 601}, {"text": 5}):
            with self.subTest(bad=bad):
                self.assertEqual(self.client.post("/api/analyze/text", headers=self.headers, json=bad).status_code, 400)

    def test_zero_calories_only_saves_for_water(self):
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, "kcal": 0}).status_code, 400)
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, "name": "Water", "portion": "1 glass", "kcal": 0}).status_code, 201)
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, "kcal": 1}).status_code, 201)

    def test_a_long_multi_food_portion_can_be_saved(self):
        portion = "; ".join(f"food {i}: 2 medium bowls" for i in range(9))[:200]
        self.assertGreater(len(portion), 80)
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, "portion": portion, "source": "voice_estimate"}).status_code, 201)
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={**MEAL, "portion": "p" * 201}).status_code, 400)

    def test_voice_rejects_non_audio_and_silence(self):
        import base64
        bad = {"file_base64": base64.b64encode(b"not audio at all").decode()}
        self.assertEqual(self.client.post("/api/analyze/voice", headers=self.headers, json=bad).status_code, 400)
        FakeTranscriber.text = ""
        try:
            self.assertEqual(self.client.post("/api/analyze/voice", headers=self.headers, json=self.audio_body()).status_code, 422)
        finally:
            FakeTranscriber.text = "I had two rotis and dal"

    def test_voice_meals_can_be_saved_and_earn_a_badge(self):
        self.client.post("/api/meals", headers=self.headers, json={**MEAL, "source": "voice_estimate"})
        badges = {b["id"]: b["earned"] for b in self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json["progress"]["badges"]}
        self.assertTrue(badges["voice_log"])
        self.assertTrue(badges["first_meal"])

    def test_dashboard_explains_focus_and_progress(self):
        data = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json
        self.assertEqual(data["focus"]["progress"]["unit"], "min")
        self.assertTrue(data["focus"]["why"])
        self.assertEqual(data["progress"]["streak"], 0)
        self.client.post("/api/meals", headers=self.headers, json=MEAL)
        data = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json
        self.assertEqual(data["progress"]["streak"], 1)
        self.assertTrue(data["progress"]["week"][-1]["active"])

    def test_saved_report_values_become_trends(self):
        report = FakeAnalyzer().analyze_report(b"", "")
        self.assertEqual(self.client.post("/api/reports", headers=self.headers, json=report).status_code, 201)
        high = {**report, "metrics": [{"name": "Glucose", "value": "130", "unit": "mg/dL", "reference": "70-99"}]}
        self.client.post("/api/reports", headers=self.headers, json=high)
        trends = self.client.get("/api/metrics", headers=self.headers).json
        self.assertEqual(len(trends), 1)
        self.assertEqual(trends[0]["latest"]["status"], "above")
        self.assertEqual(trends[0]["series"], [95, 130])
        self.assertEqual(self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json["metric_trends"][0]["key"], "glucose")

    def test_deleting_a_report_removes_its_trend_points(self):
        report = self.client.post("/api/reports", headers=self.headers, json=FakeAnalyzer().analyze_report(b"", "")).json
        self.assertEqual(self.client.delete(f"/api/reports/{report['id']}", headers=self.headers).status_code, 204)
        self.assertEqual(self.client.get("/api/metrics", headers=self.headers).json, [])

    def test_report_requires_confirmed_save(self):
        content = b"%PDF-1.4" + b"x" * 20
        result = self.client.post("/api/analyze/report", headers=self.headers, data={"file": (io.BytesIO(content), "report.pdf")})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json["reports"], [])
        saved = self.client.post("/api/reports", headers=self.headers, json=result.json)
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(len(self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json["reports"]), 1)

    def test_persistence_after_app_restart(self):
        self.client.post("/api/meals", headers=self.headers, json=MEAL)
        reopened = create_app({"TESTING": True, "DATABASE_PATH": self.db_path}).test_client()
        self.assertEqual(len(reopened.get("/api/meals", headers=self.headers).json), 1)

    def test_content_type_and_payload_errors(self):
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, data="plain").status_code, 400)
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json=[1, 2]).status_code, 400)

    def test_no_data_has_actionable_insight(self):
        result = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json
        self.assertIn("walk", result["insight"]["suggestion"].lower())

    def test_profile_update_changes_plan_and_rejects_invalid(self):
        updated = {**GUEST, "name": "Riya", "activity_level": "active", "reminder": "morning"}
        response = self.client.put("/api/me", headers=self.headers, json=updated)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["name"], "Riya")
        self.assertEqual(self.client.get("/api/me", headers=self.headers).json["activity_level"], "active")
        self.assertEqual(self.client.put("/api/me", headers=self.headers, json={**updated, "goal": "bad"}).status_code, 400)
        self.assertEqual(self.client.get("/api/me", headers=self.headers).json["goal"], GUEST["goal"])

    def test_chat_uses_real_logs_and_persists(self):
        self.client.post("/api/meals", headers=self.headers, json=MEAL)
        response = self.client.post("/api/assistant/messages", headers=self.headers, json={"question": "What did I eat?", "today": TODAY})
        self.assertEqual(response.status_code, 200)
        self.assertIn("1 meal today: Rice", response.json["answer"])
        messages = self.client.get("/api/assistant/messages", headers=self.headers).json
        self.assertEqual([item["role"] for item in messages], ["user", "assistant"])
        reopened = create_app({"TESTING": True, "DATABASE_PATH": self.db_path}).test_client()
        self.assertEqual(len(reopened.get("/api/assistant/messages", headers=self.headers).json), 2)

    def test_chat_rejects_empty_long_or_invalid_date(self):
        for payload in ({"question": "", "today": TODAY}, {"question": "x" * 301, "today": TODAY}, {"question": "help", "today": "not-date"}):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/assistant/messages", headers=self.headers, json=payload).status_code, 400)
        self.assertEqual(self.client.get("/api/assistant/messages", headers=self.headers).json, [])

    def test_chat_is_private_between_guests(self):
        self.client.post("/api/assistant/messages", headers=self.headers, json={"question": "How am I doing?", "today": TODAY})
        another = self.client.post("/api/guests", json={**GUEST, "name": "Other"}).json["token"]
        self.assertEqual(self.client.get("/api/assistant/messages", headers={"Authorization": f"Bearer {another}"}).json, [])

    def test_chat_model_receives_bounded_log_facts(self):
        self.client.post("/api/meals", headers=self.headers, json=MEAL)
        class FakeChat:
            def answer(self, question, facts, history):
                self.facts = facts
                self.history = history
                return "Rice is in your log. Add the next meal when you eat."
        fake = FakeChat()
        self.app.services["assistant"].chat_model = fake
        result = self.client.post("/api/assistant/messages", headers=self.headers, json={"question": "What did I eat?", "today": TODAY})
        self.assertEqual(result.json["answer"], "Rice is in your log. Add the next meal when you eat.")
        self.assertEqual(fake.facts["meals_today"][0]["name"], "Rice")
        self.assertEqual(fake.history, [])
        self.assertNotIn("token", fake.facts)

    def test_report_delete_is_private_and_idempotent_error(self):
        report = self.client.post("/api/reports", headers=self.headers, json=FakeAnalyzer().analyze_report(b"", "")).json
        another = self.client.post("/api/guests", json={**GUEST, "name": "Other"}).json["token"]
        other_headers = {"Authorization": f"Bearer {another}"}
        self.assertEqual(self.client.delete(f"/api/reports/{report['id']}", headers=other_headers).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/reports/{report['id']}", headers=self.headers).status_code, 204)
        self.assertEqual(self.client.delete(f"/api/reports/{report['id']}", headers=self.headers).status_code, 404)


if __name__ == "__main__":
    unittest.main()
