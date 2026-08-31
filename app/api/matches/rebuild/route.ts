import { NextResponse } from "next/server";
import { computePickupDetour, computeRoute } from "@/lib/google-routes";
import { compatibilityFromDetour, matchLabel } from "@/lib/matching";
import { createServiceClient } from "@/lib/supabase/server";

type MatchInsert = {
  owner_user_id: string;
  candidate_user_id: string;
  recommended_driver_id: string;
  detour_minutes: number;
  route_compatibility: number;
  label: "Excellent" | "Good" | "Possible";
  cached_at: string;
};

type ProfileRow = {
  user_id: string;
  origin_input: string;
  role: "driver" | "passenger" | "either";
  available_seats: number;
  max_detour_minutes: number;
  route_duration_seconds: number | null;
  route_origin_snapshot: string | null;
};

function canDrive(profile: ProfileRow) {
  return (profile.role === "driver" || profile.role === "either") && profile.available_seats > 0;
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    if (!supabase) return NextResponse.json({ error: "Supabase service connection is not configured." }, { status: 503 });

    const { userId } = (await request.json()) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const hub = process.env.HUB_DESTINATION_ADDRESS;
    if (!hub) return NextResponse.json({ error: "HUB_DESTINATION_ADDRESS is not configured" }, { status: 503 });

    const { data: current, error: currentError } = await supabase.from("commute_profiles").select("*").eq("user_id", userId).single();
    if (currentError || !current) return NextResponse.json({ error: currentError?.message ?? "Profile not found" }, { status: 404 });

    const currentRow = current as ProfileRow;

    // Calculate the user's normal route only if it has never been cached, or if the routing origin actually changed.
    const currentOriginChanged = currentRow.route_origin_snapshot?.trim().toLowerCase() !== currentRow.origin_input.trim().toLowerCase();
    if (!currentRow.route_duration_seconds || currentOriginChanged) {
      const normal = await computeRoute(currentRow.origin_input, hub);
      const { error } = await supabase.from("commute_profiles").update({
        route_duration_seconds: normal.durationSeconds,
        route_distance_meters: normal.distanceMeters,
        route_polyline: normal.encodedPolyline ?? null,
        route_origin_snapshot: currentRow.origin_input,
        route_calculated_at: new Date().toISOString(),
      }).eq("user_id", userId);
      if (error) throw error;
      currentRow.route_duration_seconds = normal.durationSeconds;
    }

    const { data: candidates, error: candidateError } = await supabase.from("commute_profiles").select("*").neq("user_id", userId);
    if (candidateError) throw candidateError;

    // This endpoint is intentionally invoked only when the profile is created/changed.
    // Existing cached matches for this owner are replaced, not periodically refreshed.
    await supabase.from("cached_matches").delete().eq("owner_user_id", userId);

    const rows: MatchInsert[] = [];
    for (const rawCandidate of candidates ?? []) {
      const candidate = rawCandidate as ProfileRow;
      const options: Array<{ driverId: string; detourMinutes: number; maxDetour: number }> = [];

      if (canDrive(currentRow) && candidate.role !== "driver") {
        const detour = await computePickupDetour({
          driverOrigin: currentRow.origin_input,
          passengerOrigin: candidate.origin_input,
          hub,
          cachedDriverDurationSeconds: currentRow.route_duration_seconds ?? undefined,
        });
        options.push({ driverId: currentRow.user_id, detourMinutes: Math.ceil(detour.detourSeconds / 60), maxDetour: currentRow.max_detour_minutes });
      }

      if (canDrive(candidate) && currentRow.role !== "driver") {
        const candidateOriginChanged = candidate.route_origin_snapshot?.trim().toLowerCase() !== candidate.origin_input.trim().toLowerCase();
        if (!candidate.route_duration_seconds || candidateOriginChanged) {
          const normal = await computeRoute(candidate.origin_input, hub);
          candidate.route_duration_seconds = normal.durationSeconds;
          await supabase.from("commute_profiles").update({
            route_duration_seconds: normal.durationSeconds,
            route_distance_meters: normal.distanceMeters,
            route_polyline: normal.encodedPolyline ?? null,
            route_origin_snapshot: candidate.origin_input,
            route_calculated_at: new Date().toISOString(),
          }).eq("user_id", candidate.user_id);
        }
        const detour = await computePickupDetour({
          driverOrigin: candidate.origin_input,
          passengerOrigin: currentRow.origin_input,
          hub,
          cachedDriverDurationSeconds: candidate.route_duration_seconds ?? undefined,
        });
        options.push({ driverId: candidate.user_id, detourMinutes: Math.ceil(detour.detourSeconds / 60), maxDetour: candidate.max_detour_minutes });
      }

      const best = options.filter((o) => o.detourMinutes <= o.maxDetour).sort((a,b) => a.detourMinutes - b.detourMinutes)[0];
      if (!best) continue;
      rows.push({
        owner_user_id: userId,
        candidate_user_id: candidate.user_id,
        recommended_driver_id: best.driverId,
        detour_minutes: best.detourMinutes,
        route_compatibility: compatibilityFromDetour(best.detourMinutes, best.maxDetour),
        label: matchLabel(best.detourMinutes),
        cached_at: new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error } = await supabase.from("cached_matches").insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ matchesCreated: rows.length, cached: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown matching error" }, { status: 500 });
  }
}
