import { NextResponse } from "next/server";

// V3 intentionally keeps Google Routes disabled while we validate real users,
// shared profiles and carpool requests. This prevents a public endpoint from
// consuming paid API quota before authentication + caching are wired together.
export async function POST() {
  return NextResponse.json(
    { error: "Google routing is intentionally disabled in HUBpool V3. It will return in the cached-route milestone." },
    { status: 501 },
  );
}
