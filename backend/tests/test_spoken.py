import unittest

from nourish.groq_chat import clean_spoken_meal


class SpokenMealTests(unittest.TestCase):
    def test_quantities_are_kept(self):
        result = clean_spoken_meal({"items": [{"name": "dal", "quantity": 3, "unit": "cup"}, {"name": "roti", "quantity": "2"}], "description": "d", "uncertainty": "u"})
        self.assertEqual(result["foods"], ["dal", "roti"])
        self.assertEqual(result["items"][0], {"name": "dal", "quantity": 3.0, "unit": "cup"})
        self.assertEqual(result["items"][1]["quantity"], 2.0)

    def test_fractions_survive(self):
        self.assertEqual(clean_spoken_meal({"items": [{"name": "rice", "quantity": 0.5, "unit": "cup"}]})["items"][0]["quantity"], 0.5)

    def test_bad_amounts_fall_back_to_one_serving(self):
        for bad in ("lots", None, 0, -2, 500, float("inf")):
            with self.subTest(bad=bad):
                self.assertEqual(clean_spoken_meal({"items": [{"name": "dal", "quantity": bad}]})["items"][0]["quantity"], 1.0)

    def test_malformed_items_are_dropped(self):
        result = clean_spoken_meal({"items": ["dal", {"quantity": 2}, {"name": "  "}, {"name": "egg"}]})
        self.assertEqual(result["foods"], ["egg"])
        self.assertEqual(clean_spoken_meal("nonsense")["items"], [])


if __name__ == "__main__":
    unittest.main()
