# Turbo Charge AR S1 live status server

FastAPI service for Admin-published status/message and Member read-only live updates.

- GET /health
- GET /api/status
- POST /api/status (Bearer token required)
- WebSocket /ws (read-only, no token required; a supplied token must validate)

## Deploy
Use the root render.yaml Blueprint. Configure DASHBOARD_API_TOKEN with a strong secret.
DASHBOARD_ALLOWED_ORIGINS is a comma-separated list of allowed website origins. The
Render service provides HTTPS/WSS automatically. Keep the admin token out of the Member APK.

## Tests
Run from repository root: python -m pytest server/tests -q
