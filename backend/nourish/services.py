import hashlib
import json
import secrets
import uuid
from datetime import date, timedelta

from . import metrics as markers
from .contracts import MealRepository, ProfileRepository, ReportRepository, WorkoutRepository


GOALS = {"eat_consistently", "calorie_awareness", "move_more", "feel_better"}
OBSTACLES = {"forget", "changing_routine", "portion_size", "exploring"}
REMINDERS = {"off", "morning", "evening"}
ACTIVITY_LEVELS = {"beginner", "some_activity", "active"}
WORKOUTS = {"walk", "stretch", "yoga", "strength", "other"}


class InputError(ValueError):
    pass


def _text(value, field, maximum, required=True):
    if not isinstance(value, str):
        raise InputError(f"{field} must be text")
    result = value.strip()
    if (required and not result) or len(result) > maximum:
        raise InputError(f"{field} must be 1-{maximum} characters" if required else f"{field} must be at most {maximum} characters")
    return result


def _choice(value, field, allowed):
    if value not in allowed:
        raise InputError(f"invalid {field}")
    return value


def _int(value, field, minimum, maximum):
    if isinstance(value, bool):
        raise InputError(f"{field} must be between {minimum} and {maximum}")
    try:
        number = int(value)
    except (ValueError, TypeError):
        raise InputError(f"{field} must be between {minimum} and {maximum}") from None
    if number < minimum or number > maximum or str(number) != str(value):
        raise InputError(f"{field} must be between {minimum} and {maximum}")
    return number


def _logged_on(value):
    if not isinstance(value, str):
        raise InputError("logged_on must be a date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise InputError("logged_on must be a date") from None
    if parsed > date.today() + timedelta(days=1) or parsed < date.today() - timedelta(days=365):
        raise InputError("logged_on is outside the allowed range")
    return parsed.isoformat()


class ProfileService:
    def __init__(self, profiles: ProfileRepository):
        self.profiles = profiles

    def create_guest(self, payload):
        data = self._validate(payload)
        token = secrets.token_urlsafe(32)
        profile_id = str(uuid.uuid4())
        self.profiles.insert_profile({"id": profile_id, "token_hash": hashlib.sha256(token.encode()).hexdigest(), **data})
        return {"token": token, "profile": self.get_by_token(token)}

    def update(self, profile_id, payload):
        return self.profiles.update_profile(profile_id, self._validate(payload))

    def _validate(self, payload):
        goal = _choice(payload.get("goal"), "goal", GOALS)
        obstacle = _choice(payload.get("obstacle"), "obstacle", OBSTACLES)
        reminder = _choice(payload.get("reminder", "off"), "reminder", REMINDERS)
        activity_level = _choice(payload.get("activity_level", "beginner"), "activity_level", ACTIVITY_LEVELS)
        name = _text(payload.get("name", ""), "name", 40, required=False)
        target = payload.get("target_kcal")
        if goal == "calorie_awareness":
            if target is None:
                raise InputError("target_kcal is required for calorie awareness")
            target = _int(target, "target_kcal", 500, 6000)
        elif target is not None:
            raise InputError("target_kcal is only used for calorie awareness")
        return {
            "name": name,
            "goal": goal,
            "obstacle": obstacle,
            "target_kcal": target,
            "reminder": reminder,
            "activity_level": activity_level,
        }

    def get_by_token(self, token):
        if not isinstance(token, str) or len(token) > 256 or not token:
            return None
        return self.profiles.profile_by_token_hash(hashlib.sha256(token.encode()).hexdigest())


class MealService:
    def __init__(self, meals: MealRepository):
        self.meals = meals

    def add(self, profile_id, payload):
        name = _text(payload.get("name"), "name", 100)
        portion = _text(payload.get("portion"), "portion", 80)
        kcal = _int(payload.get("kcal"), "kcal", 0, 5000)
        source = _choice(payload.get("source", "manual"), "source", {"manual", "photo_estimate", "voice_estimate"})
        logged_on = _logged_on(payload.get("logged_on"))
        return self.meals.insert_meal({"id": str(uuid.uuid4()), "profile_id": profile_id, "name": name, "portion": portion, "kcal": kcal, "source": source, "logged_on": logged_on})


class WorkoutService:
    def __init__(self, workouts: WorkoutRepository):
        self.workouts = workouts

    def add(self, profile_id, payload):
        activity = _choice(payload.get("activity"), "activity", WORKOUTS)
        minutes = _int(payload.get("minutes"), "minutes", 1, 300)
        logged_on = _logged_on(payload.get("logged_on"))
        return self.workouts.insert_workout({"id": str(uuid.uuid4()), "profile_id": profile_id, "activity": activity, "minutes": minutes, "logged_on": logged_on})


class ActivityPlanService:
    """Small, non-clinical activity suggestions based only on stated preference."""

    def for_profile(self, profile):
        level = profile["activity_level"]
        goal = profile["goal"]
        if level == "beginner":
            ideas = [{"activity": "walk", "minutes": 10, "label": "Easy walk"}, {"activity": "stretch", "minutes": 5, "label": "Gentle stretch"}]
        elif level == "some_activity":
            ideas = [{"activity": "walk", "minutes": 20, "label": "Brisk walk"}, {"activity": "yoga", "minutes": 15, "label": "Yoga break"}]
        else:
            ideas = [{"activity": "walk", "minutes": 30, "label": "Longer walk"}, {"activity": "strength", "minutes": 20, "label": "Strength session"}]
        headline = "Build a comfortable movement rhythm" if goal == "move_more" else "Movement can support your day"
        return {"headline": headline, "ideas": ideas, "note": "Choose activities that feel comfortable. Stop if you feel pain or unwell."}


class ReportService:
    def __init__(self, reports: ReportRepository, today=date.today):
        self.reports = reports
        self.today = today

    def trends(self, profile_id, goal):
        return markers.build_trends(self.reports.metric_history(profile_id), goal)

    def save(self, profile_id, analysis):
        title = _text(analysis.get("title", "Health report"), "title", 100)
        summary = _text(analysis.get("summary", "Review the source report for exact values."), "summary", 800)
        metrics = analysis.get("metrics", [])
        if not isinstance(metrics, list) or len(metrics) > 30:
            raise InputError("invalid report metrics")
        clean_metrics = []
        for metric in metrics:
            if not isinstance(metric, dict):
                continue
            clean_metrics.append({
                "name": _text(str(metric.get("name", "")), "metric name", 80),
                "value": _text(str(metric.get("value", "")), "metric value", 80),
                "unit": _text(str(metric.get("unit", "")), "unit", 30, required=False),
                "reference": _text(str(metric.get("reference", "")), "reference", 100, required=False),
            })
        points = markers.to_points(clean_metrics, self.today().isoformat())
        return self.reports.insert_report({"id": str(uuid.uuid4()), "profile_id": profile_id, "title": title, "summary": summary, "metrics_json": json.dumps(clean_metrics)}, points)
