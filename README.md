# Nourish

Nourish is a guest-first personal health assistant. Its four main flows are guided goal setup, meal tracking, goal-aware movement, and a conversation that explains the user's own logs. Report reading is an optional supporting flow. The interface is built with Expo and React Native; the small Flask API uses SQLite. No React web framework or JavaScript backend is needed.

## Product choices

- A guest token avoids a sign-up barrier. It is stored in SecureStore on Android/iOS and localStorage in the browser. Deleting app data loses the token; account recovery and cross-device sync are outside this assignment.
- A proactive opening message and optional local reminders surface a next step. Rules use actual logs and selected goals; they do not invent vital signs or diagnoses.
- Meal photos identify likely foods through Groq's vision model. The user reviews the result and edits the portion and estimated calories before saving. Manual entry works without an API key.
- Reports are sent to Groq only when the user chooses a file. PDF pages are rendered to images first; the first three pages are analyzed. The extracted summary is saved only after confirmation, and can be deleted.
- Health Connect step reading is opt-in and Android-only. It requires a native development or release build; Expo Go cannot load that native module.

## How one tap moves through the code

`Save meal` in `mobile/src/screens/Meals.tsx` calls `api.addMeal` in `mobile/src/api.ts`. Flask routes the POST through `backend/dayora/app.py`, `MealService` validates it, and `SQLiteStore` writes it. A refreshed dashboard then runs `InsightService` against the saved data and updates the UI. The analyzer is a separate adapter, so a missing model key never blocks manual logging.

Each service has one job: validation, persistence, insight rules, activity suggestions, assistant replies, or model calls. Routes compose those services. The analyzer and repository contracts are replaceable. The screens depend on the API layer and typed data instead of database or model details.

## Run locally

Backend:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
NOURISH_DEV_CORS=1 .venv/bin/python run.py
```

In another terminal:

```bash
cd mobile
npm ci
EXPO_PUBLIC_API_BASE_URL=http://localhost:5055 npx expo start --web --port 8088
```

Open `http://localhost:8088`. For a phone, replace `localhost` with the computer's reachable Wi-Fi address in `EXPO_PUBLIC_API_BASE_URL`, run the Flask backend on the same network, and use a native build for Health Connect. The development server and its plain HTTP connection are for local evaluation, not a public deployment.

To enable photo and report analysis, set `GROQ_API_KEY` in the **backend process environment**. Never put it in `EXPO_PUBLIC_*`, source files, screenshots, or a public repository. `GROQ_MODEL` optionally overrides the default model. PDF support uses the `pdftoppm` command from Poppler on the backend machine. Analysis sends the chosen image or rendered PDF pages to the model provider. See the privacy notes above before trying personal reports.

## Verify

```bash
cd backend
.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests -q
cd ../mobile
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

The backend suite covers invalid onboarding, calories, dates, uploads, guest isolation, persistence, assistant history, report deletion, and the derived dashboard. On a physical Android device, also check photo permission denial, notification permission denial, Health Connect unavailable/permission denied, app restart persistence, and an offline backend. Native behavior remains unverified until tested on the device.

## Current limits

The Assistant currently answers bounded questions about meals, movement, goals, and saved reports from local rules. Photo and report analysis require a working Groq key and network. Photo calorie estimates are approximate and user editable. This is a self-tracking aid, not a diagnosis or treatment tool. Guest data resides in local SQLite on the backend and is isolated by a bearer token; public hosting needs HTTPS, operational backups, and a privacy policy before real health data is used.
