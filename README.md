## Turbo Charge

Mobile-first account, announcements, notifications and support app.

### Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Run `npm run build` for a production build.

The app uses the Turbo Charge Supabase project URL and publishable key in `src/supabase.js`. Never add a service-role key. Database access is protected by Supabase Auth and Row Level Security.

### Current status

- Login and signup screens are implemented with email/password authentication (no OTP UI).
- Profile, announcements, notifications and support-ticket screens are connected to existing Supabase tables.
- Admin panel is intentionally out of scope for now.
- This repository currently contains a responsive web app. A native Android APK still needs an Android wrapper/build and device testing.
- Project-level email-confirmation settings may affect whether signup immediately creates an active session.


### Public web deployment

The app is deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` after each push to `main`.