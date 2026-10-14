"""Turns report readings into numbers a person can follow over time. Educational, never diagnostic."""
import re

# key, label, pattern, why, per-goal tips
MARKERS = [
    ("hba1c", "HbA1c", r"hba1c|\ba1c\b|glycated|glycosylated",
     "Shows your average blood sugar over about three months. Steady meals and regular movement tend to help.",
     {"eat_consistently": "A steady meal routine is one of the habits linked to this.", "move_more": "Regular movement helps your body use sugar for energy."}),
    ("glucose", "Glucose", r"glucose|blood sugar",
     "A snapshot of your blood sugar. Meal timing and daily movement can influence it.",
     {"eat_consistently": "Regular meal timing can keep this steadier."}),
    ("ldl", "LDL cholesterol", r"\bldl\b",
     "Often called the “bad” cholesterol. Food choices and activity both play a part.",
     {"move_more": "More movement supports healthier cholesterol over time."}),
    ("hdl", "HDL cholesterol", r"\bhdl\b",
     "Often called the “good” cholesterol. Regular movement tends to support it.",
     {"move_more": "Your movement goal fits this one well."}),
    ("triglycerides", "Triglycerides", r"triglyceride",
     "Affected by recent meals, sugars and alcohol. Consistent eating habits can help.",
     {"calorie_awareness": "Watching portions and sugary extras can show up here."}),
    ("total_cholesterol", "Total cholesterol", r"total cholesterol|cholesterol,? total|^cholesterol$",
     "A combined picture of the fats in your blood. Look at it together with LDL and HDL.", {}),
    ("vitamin_d", "Vitamin D", r"vitamin d|25.?oh", "Supports bones and mood. Sunlight and some foods contribute.", {}),
    ("vitamin_b12", "Vitamin B12", r"b ?12|cobalamin", "Helps energy and nerves. It comes mostly from animal foods or supplements.", {}),
    ("hemoglobin", "Hemoglobin", r"^h(a)?emoglobin$|^hb$|^hgb$|h(a)?emoglobin \(?hb", "Carries oxygen in your blood, which can affect energy levels.", {}),
    ("tsh", "TSH", r"\btsh\b|thyroid stimulating", "Reflects thyroid activity, which influences energy and weight.", {}),
]

_NUMBER = r"(-?\d+(?:[.,]\d+)?)"


def identify(name: str) -> dict:
    cleaned = name.strip()
    for key, label, pattern, why, tips in MARKERS:
        if re.search(pattern, cleaned, re.I):
            return {"key": key, "label": label, "why": why, "tips": tips}
    key = re.sub(r"[^a-z0-9]+", "_", cleaned.lower()).strip("_")[:60] or "unnamed"
    return {"key": key, "label": cleaned, "why": None, "tips": {}}


def _num(raw: str) -> float:
    return float(raw.replace(",", "."))


def parse_value(raw: str):
    """First number in a reading such as '5.8', '1,200' or '<0.5'; None if there is none."""
    match = re.search(_NUMBER, re.sub(r"(\d),(\d{3})", r"\1\2", raw))
    return _num(match.group(1)) if match else None


def parse_reference(raw: str):
    """Reads ranges such as '70-99', '< 100', 'up to 5.7' or '> 40' into (low, high)."""
    text = re.sub(r"(\d),(\d{3})", r"\1\2", raw).strip()
    between = re.search(_NUMBER + r"\s*(?:-|–|—|to)\s*" + _NUMBER, text, re.I)
    if between:
        low, high = _num(between.group(1)), _num(between.group(2))
        if low <= high:
            return low, high
    upper = re.match(r"(?:<=?|≤|up to|below|less than|under)\s*" + _NUMBER, text, re.I)
    if upper:
        return None, _num(upper.group(1))
    lower = re.match(r"(?:>=?|≥|above|more than|greater than|over|at least)\s*" + _NUMBER, text, re.I)
    if lower:
        return _num(lower.group(1)), None
    return None, None


def status_of(value, low, high) -> str:
    if low is None and high is None:
        return "unknown"
    if low is not None and value < low:
        return "below"
    if high is not None and value > high:
        return "above"
    return "within"


def to_points(metrics: list[dict], measured_on: str) -> list[dict]:
    points = []
    for metric in metrics:
        value = parse_value(metric["value"])
        if value is None:
            continue
        low, high = parse_reference(metric["reference"])
        points.append({"key": identify(metric["name"])["key"], "name": metric["name"], "unit": metric["unit"], "value": value,
                       "reference": metric["reference"], "ref_low": low, "ref_high": high, "measured_on": measured_on})
    return points


def build_trends(history: list[dict], goal: str) -> list[dict]:
    """One entry per marker: latest reading, change since the one before, and why it matters."""
    groups: dict[str, list[dict]] = {}
    for point in history:
        groups.setdefault(point["key"], []).append(point)
    trends = []
    for key, points in groups.items():
        ordered = sorted(points, key=lambda p: p["measured_on"])
        latest = ordered[-1]
        previous = ordered[-2] if len(ordered) > 1 else None
        identity = identify(latest["name"])
        direction = "new"
        if previous:
            base = abs(previous["value"])
            change = (latest["value"] - previous["value"]) / base if base else latest["value"] - previous["value"]
            direction = "same" if abs(change) < 0.02 else ("up" if change > 0 else "down")
        trends.append({
            "key": key,
            "label": identity["label"],
            "unit": latest["unit"],
            "latest": {"value": latest["value"], "measured_on": latest["measured_on"], "reference": latest["reference"],
                       "status": status_of(latest["value"], latest["ref_low"], latest["ref_high"])},
            "previous": {"value": previous["value"], "measured_on": previous["measured_on"]} if previous else None,
            "direction": direction,
            "series": [p["value"] for p in ordered[-8:]],
            "why": identity["why"],
            "goal_tip": identity["tips"].get(goal),
        })
    # Values outside the printed range come first, then the most recent.
    trends.sort(key=lambda t: t["latest"]["measured_on"], reverse=True)
    trends.sort(key=lambda t: 0 if t["latest"]["status"] in ("above", "below") else 1)
    return trends
