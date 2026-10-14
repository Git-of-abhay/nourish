import unittest

from nourish.meal_estimate import TEXT_PROMPT, clean_estimate


def item(**over):
    return {"name": "dal", "quantity": 3, "unit": "cup", "portion": "3 cups", "kcal": 600, **over}


class CleanEstimateTests(unittest.TestCase):
    def test_amounts_calories_and_totals_are_kept(self):
        result = clean_estimate({"items": [item(), item(name="roti", quantity=2, unit="", portion="2 medium rotis", kcal=240)], "description": "d", "uncertainty": "u"})
        self.assertEqual(result["foods"], ["dal", "roti"])
        self.assertEqual(result["kcal"], 840)
        self.assertEqual(result["portion"], "dal: 3 cups; roti: 2 medium rotis")
        self.assertEqual(result["items"][0]["quantity"], 3.0)

    def test_every_unit_counts_not_only_cups(self):
        result = clean_estimate({"items": [item(name="idli", quantity=4, unit="piece", portion="4 idlis", kcal=240), item(name="chai", quantity=1, unit="glass", portion="1 glass", kcal=90)]})
        self.assertEqual(result["kcal"], 330)

    def test_fractions_survive(self):
        self.assertEqual(clean_estimate({"items": [item(quantity=0.5)]})["items"][0]["quantity"], 0.5)

    def test_bad_amounts_fall_back_to_one_serving(self):
        for bad in ("lots", None, 0, -2, 500, float("inf"), float("nan")):
            with self.subTest(bad=bad):
                self.assertEqual(clean_estimate({"items": [item(quantity=bad)]})["items"][0]["quantity"], 1.0)

    def test_unusable_calories_leave_the_total_empty_so_the_person_types_it(self):
        for bad in (None, "many", -5, 99999):
            with self.subTest(bad=bad):
                self.assertIsNone(clean_estimate({"items": [item(kcal=bad)]})["kcal"])
        self.assertIsNone(clean_estimate({"items": [item(), item(name="roti", kcal=None)]})["kcal"])

    def test_total_is_capped_at_what_a_meal_can_hold(self):
        result = clean_estimate({"items": [item(kcal=3000), item(name="rice", kcal=3000)]})
        self.assertEqual(result["kcal"], 5000)

    def test_portion_text_is_built_when_the_model_omits_it(self):
        self.assertEqual(clean_estimate({"items": [item(portion="")]})["items"][0]["portion"], "3 cup")

    def test_malformed_input_is_ignored(self):
        result = clean_estimate({"items": ["dal", {"quantity": 2}, {"name": "  "}, {"name": "egg", "kcal": 72}]})
        self.assertEqual(result["foods"], ["egg"])
        self.assertEqual(clean_estimate("nonsense")["items"], [])
        self.assertIsNone(clean_estimate({})["kcal"])

    def test_portion_summary_fits_the_save_limit(self):
        many = [item(name=f"food {i}", portion="1 big bowl of something") for i in range(8)]
        self.assertLessEqual(len(clean_estimate({"items": many})["portion"]), 200)

    def test_a_model_that_returns_plain_names_still_works(self):
        result = clean_estimate({"foods": ["rice", "dal", 5]})
        self.assertEqual(result["foods"], ["rice", "dal"])
        self.assertIsNone(result["kcal"])

    def test_estimated_weight_is_kept_when_sensible(self):
        self.assertEqual(clean_estimate({"items": [item(grams=250.4)]})["items"][0]["grams"], 250)
        for bad in (None, 0, -3, 99999, "heavy"):
            self.assertIsNone(clean_estimate({"items": [item(grams=bad)]})["items"][0]["grams"])

    def test_photo_prompt_asks_for_scale_and_every_calorie(self):
        from nourish.meal_estimate import PHOTO_PROMPT
        self.assertIn("katori", PHOTO_PROMPT)
        self.assertIn("scale", PHOTO_PROMPT)
        self.assertIn("Always give a calorie estimate", PHOTO_PROMPT)

    def test_prompt_teaches_the_multiplication(self):
        self.assertIn("3 cups of dal is about 600 kcal", TEXT_PROMPT)


if __name__ == "__main__":
    unittest.main()
