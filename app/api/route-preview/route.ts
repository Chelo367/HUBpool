import { NextResponse } from "next/server";
import { computeRoute } from "@/lib/google-routes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { origin?: string };
    if (!body.origin?.trim()) return NextResponse.json({ error: "origin is required" }, { status: 400 });

    const hub = process.env.HUB_DESTINATION_ADDRESS;
    if (!hub) return NextResponse.json({ error: "HUB_DESTINATION_ADDRESS is not configured" }, { status: 503 });

    const route = await computeRoute(body.origin, hub);
    return NextResponse.json({
      durationMinutes: Math.round(route.durationSeconds / 60),
      distanceKm: Math.round(route.distanceMeters / 100) / 10,
      encodedPolyline: route.encodedPolyline,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown route error" }, { status: 500 });
  }
}
