"""Runs the API against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set."""
import os
import unittest
from datetime import date

from nourish import create_app

URL = os.environ.get("TEST_DATABASE_URL", "")
TODAY = date.today().isoformat()
GUEST = {"name": "Pat", "goal": "move_more", "obstacle": "forget", "reminder": "off", "activity_level": "beginner", "target_kcal": None}


@unittest.skipUnless(URL, "set TEST_DATABASE_URL to run PostgreSQL tests")
class PostgresTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({"TESTING": True, "DATABASE_URL": URL})
        self.client = self.app.test_client()
        result = self.client.post("/api/guests", json=GUEST)
        self.assertEqual(result.status_code, 201)
        self.headers = {"Authorization": "Bearer " + result.json["token"]}

    def tearDown(self):
        self.app.database.close()

    def test_full_flow_persists_and_isolates(self):
        self.assertEqual(self.client.post("/api/meals", headers=self.headers, json={"name": "Dal", "portion": "1 bowl", "kcal": 180, "source": "voice_estimate", "logged_on": TODAY}).status_code, 201)
        self.assertEqual(self.client.post("/api/workouts", headers=self.headers, json={"activity": "walk", "minutes": 20, "logged_on": TODAY}).status_code, 201)
        report = {"title": "Lab", "summary": "One value", "metrics": [{"name": "LDL Cholesterol", "value": "140", "unit": "mg/dL", "reference": "< 100"}]}
        self.assertEqual(self.client.post("/api/reports", headers=self.headers, json=report).status_code, 201)
        dashboard = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json
        self.assertEqual(dashboard["insight"]["today_meals"], 1)
        self.assertEqual(dashboard["progress"]["streak"], 1)
        self.assertEqual(dashboard["focus"]["progress"]["value"], 20)
        self.assertEqual(dashboard["metric_trends"][0]["latest"]["status"], "above")
        self.assertIsInstance(dashboard["meals"][0]["logged_on"], str)
        self.assertEqual(self.client.post("/api/assistant/messages", headers=self.headers, json={"question": "How is my cholesterol?", "today": TODAY}).status_code, 200)
        self.assertEqual(len(self.client.get("/api/assistant/messages", headers=self.headers).json), 2)
        other = self.client.post("/api/guests", json=GUEST).json["token"]
        self.assertEqual(self.client.get("/api/meals", headers={"Authorization": "Bearer " + other}).json, [])
        report_id = self.client.get(f"/api/dashboard?today={TODAY}", headers=self.headers).json["reports"][0]["id"]
        self.assertEqual(self.client.delete(f"/api/reports/{report_id}", headers=self.headers).status_code, 204)
        self.assertEqual(self.client.get("/api/metrics", headers=self.headers).json, [])

    def test_data_survives_a_new_app_instance(self):
        self.client.post("/api/meals", headers=self.headers, json={"name": "Rice", "portion": "1 cup", "kcal": 200, "source": "manual", "logged_on": TODAY})
        second = create_app({"TESTING": True, "DATABASE_URL": URL})
        try:
            self.assertEqual(second.test_client().get("/api/meals", headers=self.headers).json[0]["name"], "Rice")
        finally:
            second.database.close()


if __name__ == "__main__":
    unittest.main()
