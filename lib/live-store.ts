"use client";

import type {
  CommuteProfile,
  DirectoryCoworker,
  LiveCarpoolRequestView,
  RequestStatus,
  Weekday,
  WeeklySchedule,
} from "@/lib/types";
import { createDefaultWeeklySchedule, WEEKDAYS } from "@/lib/schedule";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ScheduleRow = {
  user_id: string;
  day_of_week: number;
  enabled: boolean;
  arrive_by: string | null;
  leave_at: string | null;
};

type DirectoryRow = {
  user_id: string;
  display_name: string;
  public_area: string;
  role: CommuteProfile["role"];
  available_seats: number;
  max_detour_minutes: number;
};

type ContactRow = {
  user_id: string;
  phone_number: string;
};

type RequestRow = {
  id: string;
  requester_id: string;
  target_user_id: string;
  message: string;
  status: RequestStatus;
  created_at: string;
};

const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

function cleanTime(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return value.slice(0, 5);
}

function scheduleFromRows(rows: ScheduleRow[] | null | undefined): WeeklySchedule {
  const schedule = createDefaultWeeklySchedule();
  for (const row of rows ?? []) {
    const weekday = WEEKDAYS[row.day_of_week - 1]?.key;
    if (!weekday) continue;
    const fallback = schedule[weekday];
    schedule[weekday] = {
      enabled: Boolean(row.enabled),
      arriveBy: cleanTime(row.arrive_by, fallback.arriveBy),
      leaveAt: cleanTime(row.leave_at, fallback.leaveAt),
    };
  }
  return schedule;
}

async function currentUserOrThrow() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Please sign in to use the shared HUBpool pilot.");
  return data.user;
}

export async function loadLiveProfile(): Promise<CommuteProfile> {
  const supabase = getSupabaseBrowserClient();
  const user = await currentUserOrThrow();

  const [profileResult, commuteResult, contactResult, scheduleResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("commute_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("contact_details").select("phone_number").eq("user_id", user.id).maybeSingle(),
    supabase.from("weekly_commute_schedules").select("*").eq("user_id", user.id).order("day_of_week"),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (commuteResult.error) throw commuteResult.error;
  if (contactResult.error) throw contactResult.error;
  if (scheduleResult.error) throw scheduleResult.error;

  const commute = commuteResult.data as Record<string, unknown> | null;
  const displayName = (profileResult.data?.display_name as string | undefined)
    ?? user.user_metadata?.display_name
    ?? user.email?.split("@")[0]
    ?? "HUBpool user";

  return {
    id: user.id,
    displayName,
    phoneNumber: (contactResult.data?.phone_number as string | undefined) ?? "",
    originInput: (commute?.origin_input as string | undefined) ?? "",
    publicArea: (commute?.public_area as string | undefined) ?? "",
    privacyLevel: (commute?.privacy_level as CommuteProfile["privacyLevel"] | undefined) ?? "town",
    role: (commute?.role as CommuteProfile["role"] | undefined) ?? "either",
    availableSeats: Number(commute?.available_seats ?? 3),
    maxDetourMinutes: Number(commute?.max_detour_minutes ?? 10),
    weeklySchedule: scheduleFromRows(scheduleResult.data as ScheduleRow[]),
    routeDurationMinutes: commute?.route_duration_seconds == null
      ? undefined
      : Math.round(Number(commute.route_duration_seconds) / 60),
    routeDistanceKm: commute?.route_distance_meters == null
      ? undefined
      : Math.round((Number(commute.route_distance_meters) / 1000) * 10) / 10,
    routePolyline: (commute?.route_polyline as string | undefined) ?? undefined,
    routeCalculatedAt: (commute?.route_calculated_at as string | undefined) ?? undefined,
  };
}

export async function saveLiveProfile(profile: CommuteProfile) {
  const supabase = getSupabaseBrowserClient();
  const user = await currentUserOrThrow();

  const { data: previous, error: previousError } = await supabase
    .from("commute_profiles")
    .select("origin_input, route_duration_seconds, route_distance_meters, route_polyline, route_origin_snapshot, route_calculated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (previousError) throw previousError;

  const originChanged = Boolean(previous)
    && String(previous?.origin_input ?? "").trim().toLowerCase() !== profile.originInput.trim().toLowerCase();

  const routeFields = originChanged
    ? {
        route_duration_seconds: null,
        route_distance_meters: null,
        route_polyline: null,
        route_origin_snapshot: null,
        route_calculated_at: null,
      }
    : {
        route_duration_seconds: previous?.route_duration_seconds ?? null,
        route_distance_meters: previous?.route_distance_meters ?? null,
        route_polyline: previous?.route_polyline ?? null,
        route_origin_snapshot: previous?.route_origin_snapshot ?? null,
        route_calculated_at: previous?.route_calculated_at ?? null,
      };

  const now = new Date().toISOString();
  const seats = profile.role === "passenger" ? 0 : profile.availableSeats;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: profile.displayName.trim(),
    updated_at: now,
  });
  if (profileError) throw profileError;

  const { error: commuteError } = await supabase.from("commute_profiles").upsert({
    user_id: user.id,
    origin_input: profile.originInput.trim(),
    public_area: profile.publicArea.trim(),
    privacy_level: profile.privacyLevel,
    role: profile.role,
    available_seats: seats,
    max_detour_minutes: profile.maxDetourMinutes,
    ...routeFields,
    updated_at: now,
  });
  if (commuteError) throw commuteError;

  const { error: directoryError } = await supabase.from("commute_directory").upsert({
    user_id: user.id,
    display_name: profile.displayName.trim(),
    public_area: profile.publicArea.trim(),
    role: profile.role,
    available_seats: seats,
    max_detour_minutes: profile.maxDetourMinutes,
    updated_at: now,
  });
  if (directoryError) throw directoryError;

  const { error: contactError } = await supabase.from("contact_details").upsert({
    user_id: user.id,
    phone_number: profile.phoneNumber.trim(),
    updated_at: now,
  });
  if (contactError) throw contactError;

  const scheduleRows = WEEKDAYS.map(({ key }) => ({
    user_id: user.id,
    day_of_week: WEEKDAY_TO_NUMBER[key],
    enabled: profile.weeklySchedule[key].enabled,
    arrive_by: profile.weeklySchedule[key].arriveBy || null,
    leave_at: profile.weeklySchedule[key].leaveAt || null,
    updated_at: now,
  }));

  const { error: scheduleError } = await supabase
    .from("weekly_commute_schedules")
    .upsert(scheduleRows, { onConflict: "user_id,day_of_week" });
  if (scheduleError) throw scheduleError;

  return { originChanged };
}

export async function loadLiveCoworkers(): Promise<DirectoryCoworker[]> {
  const supabase = getSupabaseBrowserClient();
  const user = await currentUserOrThrow();

  const { data: directoryData, error: directoryError } = await supabase
    .from("commute_directory")
    .select("*")
    .neq("user_id", user.id)
    .order("display_name");
  if (directoryError) throw directoryError;

  const directory = (directoryData ?? []) as DirectoryRow[];
  const ids = directory.map((row) => row.user_id);
  if (!ids.length) return [];

  const { data: scheduleData, error: scheduleError } = await supabase
    .from("weekly_commute_schedules")
    .select("*")
    .in("user_id", ids)
    .order("day_of_week");
  if (scheduleError) throw scheduleError;

  const schedules = (scheduleData ?? []) as ScheduleRow[];
  const scheduleByUser = new Map<string, ScheduleRow[]>();
  for (const row of schedules) {
    scheduleByUser.set(row.user_id, [...(scheduleByUser.get(row.user_id) ?? []), row]);
  }

  return directory.map((row) => ({
    id: row.user_id,
    displayName: row.display_name,
    phoneNumber: "",
    originInput: "",
    publicArea: row.public_area,
    privacyLevel: "town",
    role: row.role,
    availableSeats: Number(row.available_seats ?? 0),
    maxDetourMinutes: Number(row.max_detour_minutes ?? 10),
    weeklySchedule: scheduleFromRows(scheduleByUser.get(row.user_id)),
    routeReady: false,
  }));
}

export async function sendLiveRequest(target: DirectoryCoworker) {
  const supabase = getSupabaseBrowserClient();
  const user = await currentUserOrThrow();

  const { data: existingData, error: existingError } = await supabase
    .from("carpool_requests")
    .select("id,status,requester_id,target_user_id")
    .or(`and(requester_id.eq.${user.id},target_user_id.eq.${target.id}),and(requester_id.eq.${target.id},target_user_id.eq.${user.id})`);
  if (existingError) throw existingError;

  const existing = (existingData ?? []) as Array<Pick<RequestRow, "id" | "status" | "requester_id" | "target_user_id">>;
  const active = existing.some((row) => row.status === "pending" || row.status === "accepted");
  if (active) return { alreadyExists: true };

  const message = `Hi ${target.displayName}! HUBpool shows that our weekly commute may be compatible. Want to arrange a carpool?`;
  const { error } = await supabase.from("carpool_requests").insert({
    requester_id: user.id,
    target_user_id: target.id,
    message,
  });
  if (error) throw error;

  return { alreadyExists: false };
}

export async function loadLiveRequests(): Promise<LiveCarpoolRequestView[]> {
  const supabase = getSupabaseBrowserClient();
  const user = await currentUserOrThrow();

  const { data: requestData, error: requestsError } = await supabase
    .from("carpool_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (requestsError) throw requestsError;

  const requests = (requestData ?? []) as RequestRow[];
  if (!requests.length) return [];

  const colleagueIds = Array.from(new Set(requests.map((request) => (
    request.requester_id === user.id ? request.target_user_id : request.requester_id
  ))));

  const [directoryResult, scheduleResult, contactResult] = await Promise.all([
    supabase.from("commute_directory").select("user_id,display_name,public_area").in("user_id", colleagueIds),
    supabase.from("weekly_commute_schedules").select("*").in("user_id", colleagueIds).order("day_of_week"),
    supabase.from("contact_details").select("user_id,phone_number").in("user_id", colleagueIds),
  ]);

  if (directoryResult.error) throw directoryResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  // Contact RLS intentionally hides non-accepted coworkers. An empty result is expected.
  if (contactResult.error) throw contactResult.error;

  const directoryRows = (directoryResult.data ?? []) as Array<Pick<DirectoryRow, "user_id" | "display_name" | "public_area">>;
  const scheduleRows = (scheduleResult.data ?? []) as ScheduleRow[];
  const contactRows = (contactResult.data ?? []) as ContactRow[];

  const directoryMap = new Map(directoryRows.map((row) => [row.user_id, row]));
  const phoneMap = new Map(contactRows.map((row) => [row.user_id, row.phone_number]));
  const scheduleByUser = new Map<string, ScheduleRow[]>();
  for (const row of scheduleRows) {
    scheduleByUser.set(row.user_id, [...(scheduleByUser.get(row.user_id) ?? []), row]);
  }

  return requests.map((row): LiveCarpoolRequestView => {
    const incoming = row.target_user_id === user.id;
    const colleagueId = incoming ? row.requester_id : row.target_user_id;
    const colleague = directoryMap.get(colleagueId);

    return {
      id: row.id,
      requesterId: row.requester_id,
      requesterName: incoming ? (colleague?.display_name ?? "Coworker") : "You",
      targetUserId: row.target_user_id,
      targetUserName: incoming ? "You" : (colleague?.display_name ?? "Coworker"),
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      direction: incoming ? "incoming" : "outgoing",
      colleagueId,
      colleagueName: colleague?.display_name ?? "Coworker",
      colleaguePublicArea: colleague?.public_area ?? "Area hidden",
      colleaguePhoneNumber: phoneMap.get(colleagueId),
      colleagueSchedule: scheduleFromRows(scheduleByUser.get(colleagueId)),
    };
  });
}

export async function updateLiveRequestStatus(id: string, status: RequestStatus) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("carpool_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function withdrawLiveRequest(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("carpool_requests").delete().eq("id", id);
  if (error) throw error;
}

export async function signOutLiveUser() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
