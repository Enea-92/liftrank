# LiftRank — Track. Progress. Rank.

Free, no-subscription gym tracker for iOS, Android and the web (Expo / React Native + Supabase).
The display name lives in one place: `APP_NAME` in `src/theme.ts`. Pick your own name before publishing.

## Run it
```
npm install
npx expo start --web      # browser
npx expo start            # phone: scan the QR code with Expo Go
```
Without any setup the app works fully offline on the device. Accounts and cloud sync need Supabase.

## Cloud setup (Supabase, free tier)
1. Create a project at supabase.com.
2. SQL Editor: run, in order, `supabase/schema.sql`, `supabase/02_full_schema.sql`, `supabase/03_seed_exercises.sql`, `supabase/04_sync.sql`.
   (If you skip 02-04 the app still works: it falls back to storing everything as one JSON blob per user. Run all four to get proper relational sync.)
3. Copy `.env.example` to `.env` and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL` (base URL, e.g. https://xxxx.supabase.co, no /rest/v1)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the anon / publishable key)
   Never put the secret / service_role key in the app.
4. Optional sign-in providers: enable Google / Apple in Supabase → Authentication → Providers, add the redirect
   `liftrank://` (native) and your site URL (web), then set `EXPO_PUBLIC_AUTH_GOOGLE=true` / `EXPO_PUBLIC_AUTH_APPLE=true`.
   Apple sign-in needs an Apple Developer account; Google needs a Google Cloud OAuth client.

## Status by stage
**Stage 1 (done):** design system, 5-tab navigation (Home, Workout, Exercises, Rankings, Profile), email auth,
Google/Apple structure, 4-step onboarding, edit profile, full Supabase schema with RLS, 53-exercise catalog,
workout logging with previous performance / repeat / rest timer / notes / reorder, PR detection, Epley 1RM,
progress charts (7d/30d/90d/1y/all), history, rank checker, JSON backup, cloud sync.
**Stage 3 (done):** progressive-overload suggestions (double progression, plateau detection, unit-aware weight steps) on the Workout screen and exercise page; rank-up detection with an animated summary; analytics screen (weekly sessions and volume, muscle and push/pull balance, top exercises); 11-level ranks (Newbie → GOAT) with standards for 15 lifts covering all 10 muscle groups, overall rank with progress to the next level, tappable front/back muscle map, per-muscle detail.
**Stage 2 (done):** every workout, exercise and set has a UUID and is stored in its own table row (pushed atomically, safe to retry, no duplicates); deletions sync through tombstones; old short-id data is migrated automatically; calendar screen; personal-records screen (best sets + PR history).
**Remaining:** Stage 4 leaderboards / friends / QR / share cards,
Stage 5 programs + marketplace + payments, Stage 6 subscriptions, push notifications, offline hardening.

## Tests
`npm test` (unit tests: ranks, stats, merge, sync planner, UUIDs, calendar, recommendations, analytics, rank-ups), `npx tsc --noEmit`, `npx expo export --platform web`.
