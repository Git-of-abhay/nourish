import base64
import json
import os
from urllib.parse import urlparse
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, current_app, g, jsonify, request

from .analysis import AnalysisUnavailable, GroqAnalyzer, GroqTranscriber, detect_audio, detect_file_type
from .assistant import AssistantService
from .database import PostgresDatabase, SQLiteDatabase
from .db import SqlStore
from .groq_chat import GroqChatClient
from .insights import InsightService
from .progress import FocusService, GamificationService
from .services import _text, ActivityPlanService, InputError, MealService, ProfileService, ReportService, WorkoutService


def _json():
    if not request.is_json:
        raise InputError("expected JSON body")
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise InputError("expected JSON object")
    return data


def _auth(route):
    @wraps(route)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        profile = current_app.services["profiles"].get_by_token(token)
        if profile is None:
            return jsonify(error="Unauthorized guest. Start onboarding again if app data was cleared."), 401
        g.profile = profile
        return route(*args, **kwargs)
    return wrapped


def _read_upload():
    if request.is_json:
        encoded = (request.get_json(silent=True) or {}).get("file_base64")
        if not isinstance(encoded, str) or not encoded:
            raise InputError("choose a file")
        try:
            content = base64.b64decode(encoded, validate=True)
        except ValueError:
            raise InputError("file could not be read") from None
    else:
        item = request.files.get("file")
        if not item:
            raise InputError("choose a file")
        content = item.read(5 * 1024 * 1024 + 1)
    if not content or len(content) > 5 * 1024 * 1024:
        raise InputError("file must be between 1 byte and 5 MB")
    return content


def _upload(allow_pdf=False):
    content = _read_upload()
    mime = detect_file_type(content, allow_pdf)
    if mime is None:
        raise InputError("use a JPEG, PNG, WebP" + (" or PDF" if allow_pdf else "") + " file")
    return content, mime


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(
        DATABASE_URL=os.environ.get("DATABASE_URL", ""),
        DATABASE_PATH=os.environ.get("NOURISH_DB", str(Path(__file__).resolve().parent.parent / "data" / "nourish.sqlite3")),
        GROQ_API_KEY=os.environ.get("GROQ_API_KEY", ""),
        GROQ_MODEL=os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b"),
        GROQ_CHAT_MODEL=os.environ.get("GROQ_CHAT_MODEL", "openai/gpt-oss-20b"),
        GROQ_SPEECH_MODEL=os.environ.get("GROQ_SPEECH_MODEL", "whisper-large-v3-turbo"),
        MAX_CONTENT_LENGTH=9 * 1024 * 1024,
        DEV_CORS=os.environ.get("NOURISH_DEV_CORS") == "1",
    )
    if config:
        app.config.update(config)
    clock = app.config.get("CLOCK") or (lambda: datetime.now(timezone.utc))
    database = PostgresDatabase(app.config["DATABASE_URL"]) if app.config["DATABASE_URL"] else SQLiteDatabase(app.config["DATABASE_PATH"])
    store = SqlStore(database, clock)
    app.database = database
    chat_client = GroqChatClient(app.config["GROQ_API_KEY"], app.config["GROQ_CHAT_MODEL"])
    reports = ReportService(store, lambda: clock().date())
    insights = InsightService()
    gamification = GamificationService()
    app.services = {
        "store": store,
        "profiles": ProfileService(store),
        "meals": MealService(store),
        "workouts": WorkoutService(store),
        "reports": reports,
        "insights": insights,
        "gamification": gamification,
        "focus": FocusService(),
        "activity_plans": ActivityPlanService(),
        "analyzer": GroqAnalyzer(app.config["GROQ_API_KEY"], app.config["GROQ_MODEL"]),
        "transcriber": GroqTranscriber(app.config["GROQ_API_KEY"], app.config["GROQ_SPEECH_MODEL"]),
        "meal_parser": chat_client,
    }
    app.services["assistant"] = AssistantService(store, insights, chat_client, reports, gamification)

    @app.before_request
    def local_preflight():
        if request.method == "OPTIONS" and app.config["DEV_CORS"]:
            return "", 204

    @app.after_request
    def local_cors(response):
        origin = request.headers.get("Origin", "")
        parsed = urlparse(origin)
        if app.config["DEV_CORS"] and parsed.scheme in {"http", "https"} and parsed.hostname in {"localhost", "127.0.0.1"}:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    @app.errorhandler(InputError)
    def invalid(exc):
        return jsonify(error=str(exc)), 400

    @app.errorhandler(AnalysisUnavailable)
    def analysis_failed(exc):
        return jsonify(error=str(exc)), 503

    @app.errorhandler(413)
    def too_large(_exc):
        return jsonify(error="file is too large (5 MB maximum)"), 413

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.post("/api/guests")
    def guest():
        return jsonify(app.services["profiles"].create_guest(_json())), 201

    @app.get("/api/me")
    @_auth
    def me():
        return jsonify(g.profile)

    @app.put("/api/me")
    @_auth
    def update_me():
        return jsonify(app.services["profiles"].update(g.profile["id"], _json()))

    @app.get("/api/dashboard")
    @_auth
    def dashboard():
        today = request.args.get("today", date.today().isoformat())
        try:
            date.fromisoformat(today)
        except ValueError:
            raise InputError("today must be YYYY-MM-DD") from None
        profile = g.profile
        meals = store.list_meals(profile["id"])
        workouts = store.list_workouts(profile["id"])
        progress = app.services["gamification"].build(store.activity_stats(profile["id"]), today)
        week_start = (date.fromisoformat(today) - timedelta(days=6)).isoformat()
        week_minutes = store.workout_minutes_between(profile["id"], week_start, today)
        today_meals = [m for m in meals if m["logged_on"] == today]
        return jsonify({
            "profile": profile,
            "insight": app.services["insights"].build(profile, meals, workouts, today, progress),
            "activity_plan": app.services["activity_plans"].for_profile(profile),
            "focus": app.services["focus"].build(profile, today_meals, week_minutes, progress["active_days_this_week"]),
            "progress": progress,
            "meals": meals[:20],
            "workouts": workouts[:20],
            "reports": [{"id": r["id"], "title": r["title"], "summary": r["summary"], "metrics": json.loads(r["metrics_json"]), "created_at": r["created_at"]} for r in store.list_reports(profile["id"])],
            "metric_trends": app.services["reports"].trends(profile["id"], profile["goal"]),
        })

    @app.get("/api/meals")
    @_auth
    def meals():
        return jsonify(store.list_meals(g.profile["id"]))

    @app.post("/api/meals")
    @_auth
    def create_meal():
        return jsonify(app.services["meals"].add(g.profile["id"], _json())), 201

    @app.delete("/api/meals/<meal_id>")
    @_auth
    def delete_meal(meal_id):
        if not store.delete_meal(g.profile["id"], meal_id):
            return jsonify(error="meal not found"), 404
        return "", 204

    @app.post("/api/analyze/meal")
    @_auth
    def analyze_meal():
        content, mime = _upload()
        return jsonify(app.services["analyzer"].analyze_meal(content, mime))

    @app.post("/api/analyze/voice")
    @_auth
    def analyze_voice():
        content = _read_upload()
        audio = detect_audio(content)
        if audio is None:
            raise InputError("use an m4a, wav, webm, ogg or mp3 recording")
        transcript = app.services["transcriber"].transcribe(content, *audio)
        if not transcript:
            return jsonify(error="I couldn’t hear anything. Try again a little closer to the mic."), 422
        return jsonify({"transcript": transcript, **app.services["meal_parser"].estimate_text(transcript)})

    @app.post("/api/analyze/text")
    @_auth
    def analyze_text():
        text = _text(_json().get("text"), "text", 600)
        result = app.services["meal_parser"].estimate_text(text)
        if not result["items"]:
            return jsonify(error="I couldn’t spot any food in that. Try listing what you ate."), 422
        return jsonify({"transcript": text, **result})

    @app.get("/api/metrics")
    @_auth
    def metrics():
        return jsonify(app.services["reports"].trends(g.profile["id"], g.profile["goal"]))

    @app.get("/api/workouts")
    @_auth
    def workouts():
        return jsonify(store.list_workouts(g.profile["id"]))

    @app.post("/api/workouts")
    @_auth
    def create_workout():
        return jsonify(app.services["workouts"].add(g.profile["id"], _json())), 201

    @app.delete("/api/workouts/<workout_id>")
    @_auth
    def delete_workout(workout_id):
        if not store.delete_workout(g.profile["id"], workout_id):
            return jsonify(error="workout not found"), 404
        return "", 204

    @app.post("/api/analyze/report")
    @_auth
    def analyze_report():
        content, mime = _upload(allow_pdf=True)
        analysis = app.services["analyzer"].analyze_report(content, mime)
        if not analysis["metrics"]:
            return jsonify(error="No readable measurements were found. Try a clearer report."), 422
        return jsonify(analysis)

    @app.post("/api/reports")
    @_auth
    def create_report():
        return jsonify(app.services["reports"].save(g.profile["id"], _json())), 201

    @app.get("/api/assistant/messages")
    @_auth
    def assistant_messages():
        return jsonify(store.list_chat_messages(g.profile["id"]))

    @app.post("/api/assistant/messages")
    @_auth
    def assistant_message():
        payload = _json()
        today = payload.get("today", date.today().isoformat())
        try:
            date.fromisoformat(today)
        except (TypeError, ValueError):
            raise InputError("today must be YYYY-MM-DD") from None
        return jsonify(app.services["assistant"].ask(g.profile, payload.get("question"), today))

    @app.delete("/api/reports/<report_id>")
    @_auth
    def delete_report(report_id):
        if not store.delete_report(g.profile["id"], report_id):
            return jsonify(error="report not found"), 404
        return "", 204

    return app
