import unittest

from nourish import metrics


class ParsingTests(unittest.TestCase):
    def test_values(self):
        self.assertEqual(metrics.parse_value("5.8"), 5.8)
        self.assertEqual(metrics.parse_value("1,200"), 1200)
        self.assertEqual(metrics.parse_value("<0.5"), 0.5)
        self.assertIsNone(metrics.parse_value("negative"))

    def test_reference_ranges(self):
        self.assertEqual(metrics.parse_reference("70-99"), (70, 99))
        self.assertEqual(metrics.parse_reference("0.4 – 4.0"), (0.4, 4.0))
        self.assertEqual(metrics.parse_reference("< 100"), (None, 100))
        self.assertEqual(metrics.parse_reference("up to 5.7"), (None, 5.7))
        self.assertEqual(metrics.parse_reference("> 40"), (40, None))
        self.assertEqual(metrics.parse_reference("see note"), (None, None))

    def test_status(self):
        self.assertEqual(metrics.status_of(110, 70, 99), "above")
        self.assertEqual(metrics.status_of(60, 70, 99), "below")
        self.assertEqual(metrics.status_of(80, 70, 99), "within")
        self.assertEqual(metrics.status_of(80, None, None), "unknown")

    def test_marker_names_are_normalised(self):
        self.assertEqual(metrics.identify("Glycated Hemoglobin (HbA1c)")["key"], "hba1c")
        self.assertEqual(metrics.identify("LDL Cholesterol")["key"], "ldl")
        self.assertEqual(metrics.identify("Some Rare Marker")["key"], "some_rare_marker")


class TrendTests(unittest.TestCase):
    def point(self, value, day, low=70, high=99):
        return {"key": "glucose", "name": "Fasting Glucose", "unit": "mg/dL", "value": value, "reference": "70-99", "ref_low": low, "ref_high": high, "measured_on": day}

    def test_latest_compared_with_previous(self):
        trends = metrics.build_trends([self.point(90, "2026-08-01"), self.point(105, "2026-10-01")], "eat_consistently")
        self.assertEqual(len(trends), 1)
        trend = trends[0]
        self.assertEqual(trend["latest"]["value"], 105)
        self.assertEqual(trend["latest"]["status"], "above")
        self.assertEqual(trend["direction"], "up")
        self.assertEqual(trend["series"], [90, 105])
        self.assertIn("blood sugar", trend["why"])
        self.assertIn("meal timing", trend["goal_tip"])

    def test_single_reading_is_new_and_small_change_is_same(self):
        self.assertEqual(metrics.build_trends([self.point(90, "2026-08-01")], "move_more")[0]["direction"], "new")
        self.assertEqual(metrics.build_trends([self.point(90, "2026-08-01"), self.point(90.5, "2026-09-01")], "move_more")[0]["direction"], "same")

    def test_out_of_range_markers_come_first(self):
        steady = {**self.point(85, "2026-10-05"), "key": "hdl", "name": "HDL"}
        high = self.point(130, "2026-09-01")
        keys = [t["key"] for t in metrics.build_trends([steady, high], "move_more")]
        self.assertEqual(keys, ["glucose", "hdl"])


if __name__ == "__main__":
    unittest.main()
