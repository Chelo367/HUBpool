import { NextResponse } from "next/server";

// Deliberately disabled in V3. The previous prototype accepted a user id from
// the request body; that is not appropriate for a public deployment using
// privileged database credentials. V4 will authenticate the caller server-side
// before rebuilding only that user's cached route matches.
export async function POST() {
  return NextResponse.json(
    { error: "Route rebuilding is intentionally disabled in HUBpool V3." },
    { status: 501 },
  );
}
