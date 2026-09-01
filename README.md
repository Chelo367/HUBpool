# HUBpool V3

HUBpool is a lightweight carpooling web app for colleagues commuting to one fixed HUB. The product separates **static route compatibility** from **mutable weekly schedules** so Google routing can be calculated once and cached instead of repeatedly billed.

## What V3 adds

- Real Supabase email/password accounts.
- Shared coworker directory across phones/computers.
- Shared commute profiles and Monday–Sunday schedules.
- Real carpool requests between registered users.
- Recipient accept / decline flow.
- Private phone number protected by Row Level Security and revealed only after an accepted connection.
- Exact routing origin remains private to its owner.
- Demo mode still works when Supabase environment variables are absent.

V3 deliberately does **not** claim real route/detour compatibility yet. In live mode, coworkers are filtered by driver/passenger role and sorted by weekly schedule compatibility. The next milestone connects Google Routes and writes the one-time result to `cached_matches`.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Supabase variables the app runs in browser-only demo mode.

## Connect Supabase

1. Create a new Supabase project.
2. Open **SQL Editor** and run the complete contents of `supabase/schema.sql` once.
3. In the Supabase project **Connect** dialog, copy:
   - Project URL
   - Publishable key
4. Create `.env.local` in the HUBpool root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

5. Restart the dev server.

For the quickest two-person development test, you can temporarily disable **Confirm email** in Supabase Authentication settings. Before a wider pilot, enable email confirmation and configure the production Site URL / redirect URLs.

### Important security rule

The browser uses only the Supabase **publishable** key. Never put the Supabase `service_role` key in a `NEXT_PUBLIC_*` variable or GitHub.

## Deploy with Vercel

Add these Environment Variables to the Vercel project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then redeploy. The same `hubpool.vercel.app` site will switch from demo mode to the live shared pilot.

## Two-user acceptance test

Use two different browsers/devices:

1. Person A creates an account and saves a commute profile.
2. Person B creates a different account and saves a commute profile.
3. Both appear under **Matches** if their driver/passenger roles can form a carpool.
4. A sends a carpool request to B.
5. B sees an **Incoming** request and accepts it.
6. Both users now see the other person's phone number under **Connections**.
7. Change only the weekly schedule and save again: this changes schedule compatibility but does not create or refresh a Google route.

## Cost model

Google Maps is not required for V3. The planned Google Routes integration will run only when a user creates or changes their routing origin. Route/detour results will then be cached in `commute_profiles` and `cached_matches`; opening pages, changing shifts, accepting requests, or editing a phone number will not call Google.
