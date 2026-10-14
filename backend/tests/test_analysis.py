import io
import json
import unittest
import urllib.error
from unittest.mock import patch

from nourish.analysis import AnalysisUnavailable, GroqAnalyzer


class ModelAdapterTests(unittest.TestCase):
    def test_no_key_fails_without_network(self):
        with patch("nourish.analysis.urllib.request.urlopen") as call:
            with self.assertRaises(AnalysisUnavailable):
                GroqAnalyzer("").analyze_meal(b"image", "image/png")
            call.assert_not_called()

    def test_meal_parses_supported_response_and_sends_image(self):
        class Response(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *_args): self.close()
        payload = {"choices": [{"message": {"content": json.dumps({"foods": ["apple"], "description": "An apple", "uncertainty": "Size unknown"})}}]}
        with patch("nourish.analysis.urllib.request.urlopen", return_value=Response(json.dumps(payload).encode())) as call:
            result = GroqAnalyzer("test-key").analyze_meal(b"image", "image/png")
        self.assertEqual(result["foods"], ["apple"])
        sent = json.loads(call.call_args.args[0].data)
        self.assertTrue(sent["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,"))
        self.assertNotIn("test-key", json.dumps(sent))

    def test_rate_limit_is_actionable_and_does_not_echo_key(self):
        error = urllib.error.HTTPError("https://api.groq.com", 429, "Too Many Requests", {}, io.BytesIO(b""))
        with patch("nourish.analysis.urllib.request.urlopen", side_effect=error):
            with self.assertRaisesRegex(AnalysisUnavailable, "rate limit") as caught:
                GroqAnalyzer("secret-key").analyze_meal(b"image", "image/png")
        error.close()
        self.assertNotIn("secret-key", str(caught.exception))

    def test_pdf_routes_rendered_pages_to_model(self):
        class Renderer:
            def render(self, content):
                self.content = content
                return [(b"rendered", "image/jpeg")]
        renderer = Renderer()
        analyzer = GroqAnalyzer("key", renderer=renderer)
        with patch.object(analyzer, "_generate", return_value={"title": "Report", "summary": "One value.", "metrics": []}) as call:
            self.assertEqual(analyzer.analyze_report(b"%PDF-file", "application/pdf")["title"], "Report")
        self.assertEqual(renderer.content, b"%PDF-file")
        self.assertEqual(call.call_args.args[0], [(b"rendered", "image/jpeg")])


if __name__ == "__main__":
    unittest.main()
