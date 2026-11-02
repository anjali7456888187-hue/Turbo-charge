# Turbo Charge

Mobile-first customer account, updates, alerts and support app.

## Customer features

- Email + password sign up and login (no OTP UI).
- Customer account is created first; the customer then logs in with the same email and password.
- Home dashboard with latest published updates, unread alert count and support-ticket count.
- Profile editing for username and optional mobile number.
- Alerts with a mark-as-read action.
- Support tickets, ticket history and customer replies.
- Telegram support link and shareable sign-up link.
- Profile, Alerts and Updates are available from Settings, not the main navigation.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Run `npm run build` for a production web build.

## Android build and smoke test

The `.github/workflows/android-apk.yml` workflow builds a debug APK, uploads it as `turbo-charge-debug-apk`, installs it on an Android emulator, launches the app, and checks that the app process remains running and no Android runtime crash is logged.

Open the repository's **Actions** tab to see build/test results and download the APK artifact from a successful run.

## Backend

The app uses the Turbo Charge Supabase project URL and publishable key in `src/supabase.js`. Never add a service-role or secret key to the client. Public-schema tables have Row Level Security enabled; customer policies restrict profile, notification, ticket and message access to the signed-in owner.

The database creates a customer profile when an Auth user is created and automatically adds a support acknowledgement when a ticket is opened. Project-level email-confirmation settings determine whether signup immediately returns a session.

## Web deployment

The app is deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` after each push to `main`.

## Manual customer acceptance checklist

- Open the shared link and confirm it opens Sign Up.
- Create an account, return to Login, and sign in with the same email/password.
- Confirm Home loads and the Settings shortcuts open Profile, Alerts and Updates.
- Save a profile change and confirm it remains after refresh/re-login.
- Mark an alert as read and confirm the unread count changes.
- Create a support ticket, open it, and send a reply.
- Test Share App on Android and in a desktop browser.
- Log out and confirm the next visitor sees the Login/Sign Up screen, not the previous account.

## AR S1 live server connection

- The AR S1 entry is available from the Tools screen in both Member and Admin builds.
- Member view reads `/api/status` and listens to `/ws` over HTTPS/WSS.
- Admin view can publish a status/message with a runtime-entered server token.
- Server source is in `server/`; Render Blueprint is `render.yaml`.
- Run backend tests from the repository root with `python -m pytest server/tests -q`.
- Set up the Render service from the Blueprint and configure `DASHBOARD_API_TOKEN` before connecting the apps. Do not put the admin token in Member builds.
