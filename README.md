# HUBpool MVP

A small route-based carpool matching web app for colleagues commuting to one fixed workplace HUB.

## What this version demonstrates

- One fixed HUB destination.
- User commute profile with privacy level.
- Driver / passenger / either + seats + maximum detour.
- **Private phone number**, intended to unlock only after a carpool request is accepted.
- **Editable weekly shift schedule** that can change without any Google Maps request.
- Cached route-match cards with practical pickup detours.
- Live schedule compatibility layered on top of the cached route match.
- Request / simulated accept flow that reveals contact details after acceptance.
- Supabase schema and RLS groundwork for separating exact route data, schedule data, and private contact data.
- Google Routes server utilities for the later connected version.

## Cost model

HUBpool keeps route calculations separate from weekly coordination:

1. A route is calculated when the user first supplies a routing origin.
2. The route result and useful colleague matches are cached.
3. Opening the app does not recalculate them.
4. Updating a phone number or weekly schedule costs **zero Maps calls**.
5. Only changing the routing origin should trigger a new Google route calculation.

## Run locally

Requirements: Node.js 20.9+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Locked-down Windows laptop / portable Node

If PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd install
npm.cmd run dev
```

Keep that terminal open while using the development server.

## Demo mode

The current UI works without Google or Supabase. Profile and request changes are stored in browser `localStorage`, while coworkers/routes are demo fixtures.

## Later connection

Copy `.env.example` to `.env.local`, configure Supabase and Google Maps Platform, run `supabase/schema.sql`, and wire the profile save flow to the existing API endpoints.

The intended production rule is simple: **schedule/contact changes never call Google; route-origin changes may.**
