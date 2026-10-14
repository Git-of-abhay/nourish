# Nourish

Nourish is a personal health assistant that does the remembering for you. You tell it a goal once, and it tells you what to work on, why it matters, and gives you a small next step every day. Logging a meal takes one tap: say it, snap it or type it.

## What you can do

1. **Get a plan you understand.** Onboarding asks for a goal, what gets in your way and your starting point. The home screen then shows your focus ("Move a little more, most days"), why it matters, and one number that moves as you log.
2. **Log food in seconds.** Voice (speech to text, then foods picked out of the sentence), camera or gallery (a vision model names the foods), or typing. Every estimate is editable, and nothing is saved before you confirm it.
3. **Keep going.** Streaks, a seven-day strip, badges and a short celebration when you earn one. If a streak is about to lapse, the daily nudge says so. Optional morning or evening reminders bring you back.
4. **Understand your reports.** Upload a lab report (image or PDF). The values are extracted, you confirm them, and each marker is then tracked across reports with a trend, the range printed on your report, and a plain explanation of why it matters for your goal.
5. **Ask.** A chat assistant answers from your own logs. It never invents data, and it points you to a clinician for anything medical.

## Product decisions

- **Guest-first.** No sign-up. A random token is created on the first launch, stored in SecureStore (localStorage on web) and hashed on the server. Data lives in PostgreSQL, so closing or reinstalling the server never loses it. Deleting the app's data does.
- **Proactive, not a logbook.** The assistant opens with something useful, the home screen always has a next step, and reminders are opt-in.
- **Motivation without pressure.** Any meal or movement counts for the day. A streak survives until the end of today, and badges celebrate starting as much as consistency.
- **Honest about health.** Report values are compared only with the ranges printed on the report. Nothing is called normal or abnormal by the model, and the UI says "not a diagnosis" where it matters. Calories are always editable estimates.
- **Consent before sharing.** A photo, a voice clip or a report goes to an AI model (Groq) only after an explicit "Share and analyze" tap, and none of them is stored.
- **Cut on purpose.** No profile screen, no wearable sync beyond optional Health Connect steps, no social features. Three flows done properly beat ten shallow ones.

## Architecture

```
mobile/   Expo (React Native, TypeScript), runs on Android and in the browser
backend/  Flask API, PostgreSQL (SQLite for local development and tests)
```

Backend layers, each depending only on the one below it through small interfaces:

| Layer | Files | Responsibility |
|---|---|---|
| Routes | `app.py` | HTTP, auth, error mapping. No business rules. |
| Services | `services.py`, `insights.py`, `progress.py`, `assistant.py` | Validation, goal rules, streaks, badges, focus, assistant. |
| Domain | `metrics.py` | Parsing report values and ranges, trends, explanations. |
| Adapters | `analysis.py`, `groq_chat.py` | The only code that knows Groq's wire format: vision, speech, chat. |
| Storage | `db.py`, `database.py` | `SqlStore` holds the SQL. `Database` has SQLite and PostgreSQL implementations. |

Choices worth knowing about:

- **Goals are rules, not branches.** `InsightService` composes one rule per goal, so adding a goal does not touch the dashboard route.
- **The store is engine-agnostic.** The same SQL runs on SQLite and PostgreSQL (ISO text for dates, `?` placeholders translated per engine). Tests run on SQLite, and `TEST_DATABASE_URL` runs the API suite against real PostgreSQL.
- **Schema creation is race-safe.** Server workers take a PostgreSQL advisory lock while creating tables.
- **Models are replaceable.** The analyzer, transcriber, meal parser and chat model are injected, and the tests use fakes. A missing key never blocks manual logging.
- **Uploads are base64 JSON.** Local file URIs and multipart are unreliable with Expo's fetch, and photos are shrunk on the phone first, so uploads stay small.
- **Frontend.** Screens call `api.ts` and typed data only. Shared pieces (`Sheet`, `Toast`, `ProgressBar`, `Sparkline`) live in `components.tsx`, and pure logic lives in `progress.ts` and `foodCatalog.ts` so it can be unit tested. The meal sheet is a bottom sheet on phones and a centered dialog on wide screens.

## Run locally

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
NOURISH_DEV_CORS=1 GROQ_API_KEY=... .venv/bin/python run.py     # SQLite, port 5055
# add DATABASE_URL=postgresql://... to use PostgreSQL

cd ../mobile
npm ci
EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:5055 npx expo start --lan
```

Scan the QR code with Expo Go (SDK 57), or press `w` for the browser. Health Connect steps and reminders need a real build, not Expo Go.

`GROQ_API_KEY` belongs in the server environment only. Never put it in `EXPO_PUBLIC_*`, in the app or in the repository. Without it, manual logging works and analysis returns a friendly error. Optional: `GROQ_MODEL` (vision), `GROQ_CHAT_MODEL`, `GROQ_SPEECH_MODEL`. PDF reports need `pdftoppm` (Poppler), which the Dockerfile installs.

## Tests

```bash
cd backend && .venv/bin/python -m unittest discover -s tests -q          # 49 tests, 2 need PostgreSQL
TEST_DATABASE_URL=postgresql://... .venv/bin/python -m unittest tests.test_postgres
cd mobile && npx tsc --noEmit && npm test                                # type check and unit tests
```

The backend suite covers validation, guest isolation, uploads, voice, report trends, streak and badge rules, assistant behaviour, and a full flow on PostgreSQL. On a phone, also try: denying camera and microphone permission, an offline phone, a first request while the free server is waking up, and closing and reopening the app.

## Deploy

`render.yaml` is a Render Blueprint: a free PostgreSQL database and a Docker web service for `backend/`. Set `GROQ_API_KEY` in the dashboard. On the free plan the server sleeps after about 15 minutes idle, so the first request can take around a minute. The app wakes it while the loading screen shows. The free database has a 30-day limit.

Build the Android app with `EXPO_PUBLIC_API_BASE_URL` set to the service URL. The release build is arm64 only with minification and resource shrinking (about 27 MB).

## Known limits

- Photo and voice estimates are approximate. The calorie table covers common foods and anything else is typed by the user.
- Guest data cannot move between devices, and there is no account recovery.
- The assistant answers about meals, movement, goals and saved reports. It does not give medical advice.
- Public hosting of real health data needs HTTPS (Render provides it), backups and a privacy policy.
