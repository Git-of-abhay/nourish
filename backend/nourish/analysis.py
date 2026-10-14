import base64
import json
import uuid
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path


class AnalysisUnavailable(Exception):
    pass


def detect_file_type(content: bytes, allow_pdf=False):
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    if allow_pdf and content.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def detect_audio(content: bytes):
    """Returns (mime, extension) from the first bytes, never from what the client claims."""
    head = content[:12]
    if head[4:8] == b"ftyp":
        return "audio/mp4", "m4a"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "audio/wav", "wav"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "audio/webm", "webm"
    if head[:4] == b"OggS":
        return "audio/ogg", "ogg"
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return "audio/mpeg", "mp3"
    return None


class PdfPageRenderer:
    """Renders up to three PDF pages for a vision model using the poppler CLI."""

    def render(self, content: bytes) -> list[tuple[bytes, str]]:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "report.pdf"
            source.write_bytes(content)
            output = Path(directory) / "page"
            try:
                subprocess.run(
                    ["pdftoppm", "-f", "1", "-l", "3", "-jpeg", "-r", "110", "-scale-to", "1600", str(source), str(output)],
                    check=True, capture_output=True, timeout=20,
                )
            except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
                raise AnalysisUnavailable("This PDF could not be read. Try a clear image of the report.") from exc
            pages = [(path.read_bytes(), "image/jpeg") for path in sorted(Path(directory).glob("page-*.jpg"))[:3]]
            if not pages:
                raise AnalysisUnavailable("No readable pages were found. Try a clear image of the report.")
            return pages


class GroqAnalyzer:
    """Vision adapter; services and routes do not know Groq's wire format."""

    def __init__(self, api_key: str, model: str = "qwen/qwen3.8-27b", renderer=None):
        self.api_key = api_key
        self.model = model
        self.renderer = renderer or PdfPageRenderer()

    def _generate(self, images: list[tuple[bytes, str]], prompt: str) -> dict:
        if not self.api_key:
            raise AnalysisUnavailable("Photo analysis is not configured yet")
        content = [{"type": "text", "text": prompt}]
        for data, mime in images:
            content.append({"type": "image_url", "image_url": {"url": "data:" + mime + ";base64," + base64.b64encode(data).decode("ascii")}})
        body = json.dumps({
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.1,
            "max_completion_tokens": 1800,
            "response_format": {"type": "json_object"},
        }).encode("utf-8")
        request = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions", data=body, method="POST",
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + self.api_key, "User-Agent": "Nourish/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                payload = json.load(response)
            output = payload["choices"][0]["message"]["content"]
            result = json.loads(output)
            if not isinstance(result, dict):
                raise ValueError("model returned an invalid object")
            return result
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise AnalysisUnavailable("The Groq API key was rejected. Check the backend key.") from exc
            if exc.code == 429:
                raise AnalysisUnavailable("The model is busy or a rate limit was reached. Try again later.") from exc
            raise AnalysisUnavailable("Analysis could not complete. You can enter details manually.") from exc
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError, TypeError) as exc:
            raise AnalysisUnavailable("Analysis could not complete. You can enter details manually.") from exc

    def analyze_meal(self, content: bytes, mime: str) -> dict:
        raw = self._generate([(content, mime)],
            "Identify only foods visibly present in this image. Return a JSON object with keys: foods (array of short food names, max 8), description (one sentence), uncertainty (one sentence about portions or hidden ingredients). If no food is visible, foods must be empty. Do not estimate calories or invent ingredients.")
        foods = raw.get("foods", [])
        if not isinstance(foods, list):
            foods = []
        return {
            "foods": [str(food).strip()[:80] for food in foods[:8] if str(food).strip()],
            "description": str(raw.get("description", "Check the suggested foods before saving."))[:300],
            "uncertainty": str(raw.get("uncertainty", "Portions and cooking ingredients are hard to judge from a photo."))[:300],
        }

    def analyze_report(self, content: bytes, mime: str) -> dict:
        images = self.renderer.render(content) if mime == "application/pdf" else [(content, mime)]
        raw = self._generate(images,
            "Read these health-report images only as a transcription aid. Return a JSON object with title (short), summary (at most two plain sentences, no diagnosis or treatment advice), and metrics (up to 20 objects with name, value, unit, reference). Copy values and reference ranges only when legible; omit unclear values. Do not claim a result is normal or abnormal. If this is not a readable health report, return an empty metrics array and explain that in summary. For a PDF, only the first three pages are shown.")
        metrics = raw.get("metrics", [])
        if not isinstance(metrics, list):
            metrics = []
        return {
            "title": str(raw.get("title", "Health report"))[:100],
            "summary": str(raw.get("summary", "Check the original report for exact values."))[:800],
            "metrics": [m for m in metrics[:20] if isinstance(m, dict)],
        }


class GroqTranscriber:
    """Speech to text for spoken meals, using Groq's Whisper endpoint."""

    def __init__(self, api_key: str, model: str = "whisper-large-v3-turbo"):
        self.api_key = api_key
        self.model = model

    def transcribe(self, content: bytes, mime: str, extension: str) -> str:
        if not self.api_key:
            raise AnalysisUnavailable("Voice logging is not configured yet")
        boundary = "nourish" + uuid.uuid4().hex
        parts = []
        for name, value in (("model", self.model), ("response_format", "json"), ("temperature", "0")):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="meal.{extension}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + content + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        request = urllib.request.Request(
            "https://api.groq.com/openai/v1/audio/transcriptions", data=b"".join(parts), method="POST",
            headers={"Content-Type": "multipart/form-data; boundary=" + boundary, "Authorization": "Bearer " + self.api_key, "User-Agent": "Nourish/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return str(json.load(response).get("text", "")).strip()
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise AnalysisUnavailable("The model is busy or a rate limit was reached. Try again later.") from exc
            raise AnalysisUnavailable("I couldn’t transcribe that. You can type the meal instead.") from exc
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise AnalysisUnavailable("I couldn’t transcribe that. You can type the meal instead.") from exc
