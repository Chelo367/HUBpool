"use client";

import type {
  CommuteProfile,
  DirectoryCoworker,
  LiveCarpoolRequestView,
  LiveRouteMatch,
  OrganizationContext,
  OrganizationRole,
  RequestStatus,
  RouteRebuildResult,
  Weekday,
  WeeklySchedule,
} from "@/lib/types";

import {
  createDefaultWeeklySchedule,
  WEEKDAYS,
} from "@/lib/schedule";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/* =========================================================
   DATABASE ROW TYPES
========================================================= */

type ScheduleRow = {
  user_id: string;
  day_of_week: number;
  enabled: boolean;
  arrive_by: string | null;
  leave_at: string | null;
};

type DirectoryRow = {
  user_id: string;
  organization_id: string;
  hub_id: string;
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
  hub_id: string;
  requester_id: string;
  target_user_id: string;
  message: string;
  status: RequestStatus;
  created_at: string;
};

type CachedMatchRow = {
  id: string;
  owner_user_id: string;
  candidate_user_id: string;

  owner_driver_detour_minutes: number | null;
  candidate_driver_detour_minutes: number | null;

  cached_at: string;
};

type MembershipRow = {
  organization_id: string;
  role: OrganizationRole;
  active_hub_id: string | null;
};

/* =========================================================
   ORGANIZATION TYPE USED BY OUR NEW COMPONENTS
========================================================= */

export type CurrentOrganization = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;

  member_role: OrganizationRole;

  hub_id: string;
  hub_name: string;
  hub_public_label: string;
  hub_destination_input: string;

  hub_destination_configured: boolean;
};

/* =========================================================
   WEEKLY SCHEDULE HELPERS
========================================================= */

const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

function cleanTime(
  value: string | null | undefined,
  fallback: string
) {
  if (!value) return fallback;

  return value.slice(0, 5);
}

function scheduleFromRows(
  rows: ScheduleRow[] | null | undefined
): WeeklySchedule {
  const schedule = createDefaultWeeklySchedule();

  for (const row of rows ?? []) {
    const weekday = WEEKDAYS[row.day_of_week - 1]?.key;

    if (!weekday) continue;

    const fallback = schedule[weekday];

    schedule[weekday] = {
      enabled: Boolean(row.enabled),

      arriveBy: cleanTime(
        row.arrive_by,
        fallback.arriveBy
      ),

      leaveAt: cleanTime(
        row.leave_at,
        fallback.leaveAt
      ),
    };
  }

  return schedule;
}

/* =========================================================
   AUTH
========================================================= */

async function currentUserOrThrow() {
  const supabase = getSupabaseBrowserClient();

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(
      "Please sign in to use HUBpool."
    );
  }

  return data.user;
}

/* =========================================================
   ORGANIZATION / HUB CONTEXT
========================================================= */

export async function loadLiveOrganizationContext():
Promise<OrganizationContext | null> {
  const supabase = getSupabaseBrowserClient();

  const user = await currentUserOrThrow();

  const {
    data: membershipData,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select(
      "organization_id,role,active_hub_id"
    )
    .eq("user_id", user.id)
    .order("joined_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (
    !membershipData?.organization_id ||
    !membershipData.active_hub_id
  ) {
    return null;
  }

  const membership =
    membershipData as MembershipRow;

  const [
    organizationResult,
    hubResult,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,slug")
      .eq(
        "id",
        membership.organization_id
      )
      .single(),

    supabase
      .from("hubs")
      .select(
        "id,name,public_label,destination_input"
      )
      .eq(
        "id",
        membership.active_hub_id
      )
      .single(),
  ]);

  if (organizationResult.error) {
    throw organizationResult.error;
  }

  if (hubResult.error) {
    throw hubResult.error;
  }

  return {
    organizationId:
      organizationResult.data.id,

    organizationName:
      organizationResult.data.name,

    organizationSlug:
      organizationResult.data.slug,

    memberRole:
      membership.role,

    hubId:
      hubResult.data.id,

    hubName:
      hubResult.data.name,

    hubPublicLabel:
      hubResult.data.public_label ||
      hubResult.data.name,

    hubDestinationConfigured:
      Boolean(
        hubResult.data.destination_input?.trim()
      ),
  };
}

/* =========================================================
   COMPATIBILITY FUNCTION FOR OrganizationGate/Admin
========================================================= */

export async function getCurrentOrganization():
Promise<CurrentOrganization | null> {
  const supabase =
    getSupabaseBrowserClient();

  const context =
    await loadLiveOrganizationContext();

  if (!context) {
    return null;
  }

  const {
    data: hub,
    error,
  } = await supabase
    .from("hubs")
    .select(
      "id,name,public_label,destination_input"
    )
    .eq(
      "id",
      context.hubId
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    organization_id:
      context.organizationId,

    organization_name:
      context.organizationName,

    organization_slug:
      context.organizationSlug,

    member_role:
      context.memberRole,

    hub_id:
      context.hubId,

    hub_name:
      hub.name,

    hub_public_label:
      hub.public_label ||
      hub.name,

    hub_destination_input:
      hub.destination_input || "",

    hub_destination_configured:
      Boolean(
        hub.destination_input?.trim()
      ),
  };
}

/* =========================================================
   JOIN ORGANIZATION
========================================================= */

export async function joinLiveOrganization(
  code: string
): Promise<OrganizationContext> {
  const supabase =
    getSupabaseBrowserClient();

  await currentUserOrThrow();

  const {
    data,
    error,
  } = await supabase.rpc(
    "join_organization_by_code",
    {
      p_code: code.trim(),
    }
  );

  if (error) {
    throw error;
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!row) {
    throw new Error(
      "Unable to join that organization."
    );
  }

  return {
    organizationId:
      row.organization_id,

    organizationName:
      row.organization_name,

    organizationSlug:
      row.organization_slug,

    memberRole:
      row.member_role as OrganizationRole,

    hubId:
      row.hub_id,

    hubName:
      row.hub_name,

    hubPublicLabel:
      row.hub_public_label ||
      row.hub_name,

    hubDestinationConfigured:
      Boolean(
        row.hub_destination_configured
      ),
  };
}

export async function joinOrganizationByCode(
  code: string
) {
  await joinLiveOrganization(code);

  const result =
    await getCurrentOrganization();

  if (!result) {
    throw new Error(
      "Organization joined, but HUB information could not be loaded."
    );
  }

  return result;
}

/* =========================================================
   LOAD OWN PROFILE
========================================================= */

export async function loadLiveProfile():
Promise<CommuteProfile> {
  const supabase =
    getSupabaseBrowserClient();

  const user =
    await currentUserOrThrow();

  const organization =
    await loadLiveOrganizationContext();

  const [
    profileResult,
    commuteResult,
    contactResult,
    scheduleResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("commute_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
      .from("contact_details")
      .select("phone_number")
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
      .from(
        "weekly_commute_schedules"
      )
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week"),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (commuteResult.error) {
    throw commuteResult.error;
  }

  if (contactResult.error) {
    throw contactResult.error;
  }

  if (scheduleResult.error) {
    throw scheduleResult.error;
  }

  const commute =
    commuteResult.data as
      | Record<string, unknown>
      | null;

  const displayName =
    (
      profileResult.data
        ?.display_name as
        | string
        | undefined
    ) ??
    user.user_metadata?.display_name ??
    user.email?.split("@")[0] ??
    "HUBpool user";

  return {
    id: user.id,

    displayName,

    phoneNumber:
      (
        contactResult.data
          ?.phone_number as
          | string
          | undefined
      ) ?? "",

    originInput:
      (
        commute?.origin_input as
          | string
          | undefined
      ) ?? "",

    publicArea:
      (
        commute?.public_area as
          | string
          | undefined
      ) ?? "",

    privacyLevel:
      (
        commute?.privacy_level as
          | CommuteProfile["privacyLevel"]
          | undefined
      ) ?? "town",

    role:
      (
        commute?.role as
          | CommuteProfile["role"]
          | undefined
      ) ?? "either",

    availableSeats:
      Number(
        commute?.available_seats ??
        3
      ),

    maxDetourMinutes:
      Number(
        commute?.max_detour_minutes ??
        10
      ),

    weeklySchedule:
  scheduleFromRows(
    scheduleResult.data ?? []
  ),

    organizationId:
      organization?.organizationId,

    organizationName:
      organization?.organizationName,

    hubId:
      organization?.hubId,

    hubName:
      organization?.hubName,

    hubPublicLabel:
      organization?.hubPublicLabel,

    hubDestinationConfigured:
      organization
        ?.hubDestinationConfigured,

    routeDurationMinutes:
      commute?.route_duration_seconds ==
      null
        ? undefined
        : Math.round(
            Number(
              commute.route_duration_seconds
            ) / 60
          ),

    routeDistanceKm:
      commute?.route_distance_meters ==
      null
        ? undefined
        : Math.round(
            (
              Number(
                commute.route_distance_meters
              ) / 1000
            ) * 10
          ) / 10,

    routePolyline:
      (
        commute?.route_polyline as
          | string
          | undefined
      ) ?? undefined,

    routeCalculatedAt:
      (
        commute?.route_calculated_at as
          | string
          | undefined
      ) ?? undefined,
  };
}

/* =========================================================
   SAVE PROFILE
========================================================= */

export async function saveLiveProfile(
  profile: CommuteProfile
) {
  const supabase =
    getSupabaseBrowserClient();

  const user =
    await currentUserOrThrow();

  const organization =
    await loadLiveOrganizationContext();

  if (!organization) {
    throw new Error(
      "Join your organization before saving a commute profile."
    );
  }

  const {
    data: previous,
    error: previousError,
  } = await supabase
    .from("commute_profiles")
    .select(
      `
      origin_input,
      hub_id,
      route_duration_seconds,
      route_distance_meters,
      route_polyline,
      route_origin_snapshot,
      route_calculated_at
      `
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (previousError) {
    throw previousError;
  }

  const normalizedOrigin =
    profile.originInput
      .trim()
      .toLowerCase();

  const originChanged =
    Boolean(previous) &&
    String(
      previous?.origin_input ?? ""
    )
      .trim()
      .toLowerCase() !==
      normalizedOrigin;

  const hubChanged =
    Boolean(previous) &&
    previous?.hub_id !==
      organization.hubId;

  const routeAlreadyCurrent =
    Boolean(
      previous?.route_calculated_at
    ) &&
    !hubChanged &&
    String(
      previous
        ?.route_origin_snapshot ??
        ""
    )
      .trim()
      .toLowerCase() ===
      normalizedOrigin;

  const needsRouteBuild =
    !routeAlreadyCurrent ||
    originChanged ||
    hubChanged;

  const routeFields =
    originChanged || hubChanged
      ? {
          route_duration_seconds:
            null,

          route_distance_meters:
            null,

          route_polyline:
            null,

          route_origin_snapshot:
            null,

          route_calculated_at:
            null,
        }
      : {
          route_duration_seconds:
            previous
              ?.route_duration_seconds ??
            null,

          route_distance_meters:
            previous
              ?.route_distance_meters ??
            null,

          route_polyline:
            previous
              ?.route_polyline ??
            null,

          route_origin_snapshot:
            previous
              ?.route_origin_snapshot ??
            null,

          route_calculated_at:
            previous
              ?.route_calculated_at ??
            null,
        };

  const now =
    new Date().toISOString();

  const seats =
    profile.role === "passenger"
      ? 0
      : profile.availableSeats;

  const {
    error: profileError,
  } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,

      display_name:
        profile.displayName.trim(),

      updated_at: now,
    });

  if (profileError) {
    throw profileError;
  }

  const {
    error: commuteError,
  } = await supabase
    .from("commute_profiles")
    .upsert({
      user_id: user.id,

      organization_id:
        organization.organizationId,

      hub_id:
        organization.hubId,

      origin_input:
        profile.originInput.trim(),

      public_area:
        profile.publicArea.trim(),

      privacy_level:
        profile.privacyLevel,

      role:
        profile.role,

      available_seats:
        seats,

      max_detour_minutes:
        profile.maxDetourMinutes,

      ...routeFields,

      updated_at: now,
    });

  if (commuteError) {
    throw commuteError;
  }

  const {
    error: directoryError,
  } = await supabase
    .from("commute_directory")
    .upsert({
      user_id:
        user.id,

      organization_id:
        organization.organizationId,

      hub_id:
        organization.hubId,

      display_name:
        profile.displayName.trim(),

      public_area:
        profile.publicArea.trim(),

      role:
        profile.role,

      available_seats:
        seats,

      max_detour_minutes:
        profile.maxDetourMinutes,

      updated_at:
        now,
    });

  if (directoryError) {
    throw directoryError;
  }

  const {
    error: contactError,
  } = await supabase
    .from("contact_details")
    .upsert({
      user_id:
        user.id,

      phone_number:
        profile.phoneNumber.trim(),

      updated_at:
        now,
    });

  if (contactError) {
    throw contactError;
  }

  const scheduleRows =
    WEEKDAYS.map(({ key }) => ({
      user_id:
        user.id,

      day_of_week:
        WEEKDAY_TO_NUMBER[key],

      enabled:
        profile.weeklySchedule[
          key
        ].enabled,

      arrive_by:
        profile.weeklySchedule[
          key
        ].arriveBy || null,

      leave_at:
        profile.weeklySchedule[
          key
        ].leaveAt || null,

      updated_at:
        now,
    }));

  const {
    error: scheduleError,
  } = await supabase
    .from(
      "weekly_commute_schedules"
    )
    .upsert(
      scheduleRows,
      {
        onConflict:
          "user_id,day_of_week",
      }
    );

  if (scheduleError) {
    throw scheduleError;
  }

  return {
    originChanged,
    hubChanged,
    needsRouteBuild,
  };
}

/* =========================================================
   GOOGLE ROUTE REBUILD
========================================================= */

export async function rebuildLiveRouteMatches():
Promise<RouteRebuildResult> {
  const supabase =
    getSupabaseBrowserClient();

  const {
    data: sessionData,
    error: sessionError,
  } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken =
    sessionData.session
      ?.access_token;

  if (!accessToken) {
    throw new Error(
      "Please sign in before building route matches."
    );
  }

  const response =
    await fetch(
      "/api/matches/rebuild",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

  const data =
    (await response.json()) as
      RouteRebuildResult & {
        error?: string;
      };

  if (!response.ok) {
    throw new Error(
      data.error ??
        "Unable to build route matches."
    );
  }

  return data;
}

/* =========================================================
   LOAD CACHED GEOGRAPHIC MATCHES
========================================================= */

export async function loadLiveRouteMatches():
Promise<LiveRouteMatch[]> {
  const supabase =
    getSupabaseBrowserClient();

  const user =
    await currentUserOrThrow();

  const {
    data: matchData,
    error: matchError,
  } = await supabase
    .from("cached_matches")
    .select(
      `
      id,
      owner_user_id,
      candidate_user_id,
      owner_driver_detour_minutes,
      candidate_driver_detour_minutes,
      cached_at
      `
    )
    .eq(
      "owner_user_id",
      user.id
    )
    .order(
      "cached_at",
      {
        ascending: false,
      }
    );

  if (matchError) {
    throw matchError;
  }

  const rows =
    (matchData ??
      []) as CachedMatchRow[];

  const ids =
    rows.map(
      (row) =>
        row.candidate_user_id
    );

  if (!ids.length) {
    return [];
  }

  const [
    directoryResult,
    scheduleResult,
  ] = await Promise.all([
    supabase
      .from("commute_directory")
      .select("*")
      .in(
        "user_id",
        ids
      ),

    supabase
      .from(
        "weekly_commute_schedules"
      )
      .select("*")
      .in(
        "user_id",
        ids
      )
      .order("day_of_week"),
  ]);

  if (directoryResult.error) {
    throw directoryResult.error;
  }

  if (scheduleResult.error) {
    throw scheduleResult.error;
  }

  const directoryRows =
    (directoryResult.data ??
      []) as DirectoryRow[];

  const scheduleRows =
    (scheduleResult.data ??
      []) as ScheduleRow[];

  const directoryMap =
    new Map(
      directoryRows.map(
        (row) => [
          row.user_id,
          row,
        ]
      )
    );

  const scheduleByUser =
    new Map<
      string,
      ScheduleRow[]
    >();

  for (const row of scheduleRows) {
    scheduleByUser.set(
      row.user_id,

      [
        ...(scheduleByUser.get(
          row.user_id
        ) ?? []),

        row,
      ]
    );
  }

  return rows.flatMap(
    (row): LiveRouteMatch[] => {
      const directory =
        directoryMap.get(
          row.candidate_user_id
        );

      if (!directory) {
        return [];
      }

      const candidate:
        DirectoryCoworker = {
        id:
          directory.user_id,

        displayName:
          directory.display_name,

        phoneNumber:
          "",

        originInput:
          "",

        publicArea:
          directory.public_area,

        privacyLevel:
          "town",

        role:
          directory.role,

        availableSeats:
          Number(
            directory
              .available_seats ??
            0
          ),

        maxDetourMinutes:
          Number(
            directory
              .max_detour_minutes ??
            10
          ),

        weeklySchedule:
          scheduleFromRows(
            scheduleByUser.get(
              directory.user_id
            )
          ),

        organizationId:
          directory.organization_id,

        hubId:
          directory.hub_id,

        routeReady:
          true,
      };

      return [
        {
          id:
            row.id,

          candidate,

          ownerDriverDetourMinutes:
            row.owner_driver_detour_minutes ==
            null
              ? null
              : Number(
                  row.owner_driver_detour_minutes
                ),

          candidateDriverDetourMinutes:
            row.candidate_driver_detour_minutes ==
            null
              ? null
              : Number(
                  row.candidate_driver_detour_minutes
                ),

          cachedAt:
            row.cached_at,
        },
      ];
    }
  );
}

/* =========================================================
   LOAD COWORKERS
   SAME HUB ONLY
========================================================= */

export async function loadLiveCoworkers():
Promise<DirectoryCoworker[]> {
  const supabase =
    getSupabaseBrowserClient();

  const user =
    await currentUserOrThrow();

  const organization =
    await loadLiveOrganizationContext();

  if (!organization) {
    return [];
  }

  const {
    data: directoryData,
    error: directoryError,
  } = await supabase
    .from("commute_directory")
    .select("*")
    .eq(
      "hub_id",
      organization.hubId
    )
    .neq(
      "user_id",
      user.id
    )
    .order(
      "display_name"
    );

  if (directoryError) {
    throw directoryError;
  }

  const directory =
    (directoryData ??
      []) as DirectoryRow[];

  const ids =
    directory.map(
      (row) =>
        row.user_id
    );

  if (!ids.length) {
    return [];
  }

  const {
    data: scheduleData,
    error: scheduleError,
  } = await supabase
    .from(
      "weekly_commute_schedules"
    )
    .select("*")
    .in(
      "user_id",
      ids
    )
    .order(
      "day_of_week"
    );

  if (scheduleError) {
    throw scheduleError;
  }

  const schedules =
    (scheduleData ??
      []) as ScheduleRow[];

  const scheduleByUser =
    new Map<
      string,
      ScheduleRow[]
    >();

  for (const row of schedules) {
    scheduleByUser.set(
      row.user_id,

      [
        ...(scheduleByUser.get(
          row.user_id
        ) ?? []),

        row,
      ]
    );
  }

  return directory.map(
    (row) => ({
      id:
        row.user_id,

      displayName:
        row.display_name,

      phoneNumber:
        "",

      originInput:
        "",

      publicArea:
        row.public_area,

      privacyLevel:
        "town",

      role:
        row.role,

      availableSeats:
        Number(
          row.available_seats ??
          0
        ),

      maxDetourMinutes:
        Number(
          row.max_detour_minutes ??
          10
        ),

      weeklySchedule:
        scheduleFromRows(
          scheduleByUser.get(
            row.user_id
          )
        ),

      organizationId:
        row.organization_id,

      hubId:
        row.hub_id,

      routeReady:
        false,
    })
  );
}

/* =========================================================
   SEND CARPOOL REQUEST
========================================================= */

export async function sendLiveRequest(
  target: DirectoryCoworker
) {
  const supabase =
    getSupabaseBrowserClient();

  const user =
    await currentUserOrThrow();

  const organization =
    await loadLiveOrganizationContext();

  if (!organization) {
    throw new Error(
      "Join an organization before requesting a carpool."
    );
  }

  if (
    target.hubId &&
    target.hubId !==
      organization.hubId
  ) {
    throw new Error(
      "That coworker belongs to a different HUB."
    );
  }

  const {
    data: existingData,
    error: existingError,
  } = await supabase
    .from("carpool_requests")
    .select(
      `
      id,
      status,
      requester_id,
      target_user_id
      `
    )
    .eq(
      "hub_id",
      organization.hubId
    )
    .or(
      `and(requester_id.eq.${user.id},target_user_id.eq.${target.id}),and(requester_id.eq.${target.id},target_user_id.eq.${user.id})`
    );

  if (existingError) {
    throw existingError;
  }

  const existing =
    (existingData ??
      []) as Array<
      Pick<
        RequestRow,
        | "id"
        | "status"
        | "requester_id"
        | "target_user_id"
      >
    >;

  const active =
    existing.some(
      (row) =>
        row.status ===
          "pending" ||
        row.status ===
          "accepted"
    );

  if (active) {
    return {
      alreadyExists:
        true,
    };
  }

  const message =
    `Hi ${target.displayName}! HUBpool shows that our weekly commute may be compatible. Want to arrange a carpool?`;

  const {
    error,
  } = await supabase
    .from(
      "carpool_requests"
    )
    .insert({
      hub_id:
        organization.hubId,

      requester_id:
        user.id,

      target_user_id:
        target.id,

      message,
    });

  if (error) {
    throw error;
  }

  return {
    alreadyExists:
      false,
  };
}

/* =========================================================
   LOAD REQUESTS
========================================================= */

export async function loadLiveRequests():
Promise<LiveCarpoolRequestView[]> {
  const supabase =
    getSupabaseBrowserClient();

  const user =
    await currentUserOrThrow();

  const {
    data: requestData,
    error: requestsError,
  } = await supabase
    .from("carpool_requests")
    .select("*")
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    );

  if (requestsError) {
    throw requestsError;
  }

  const requests =
    (requestData ??
      []) as RequestRow[];

  if (!requests.length) {
    return [];
  }

  const colleagueIds =
    Array.from(
      new Set(
        requests.map(
          (request) =>
            request.requester_id ===
            user.id
              ? request.target_user_id
              : request.requester_id
        )
      )
    );

  const [
    directoryResult,
    scheduleResult,
    contactResult,
  ] = await Promise.all([
    supabase
      .from(
        "commute_directory"
      )
      .select(
        `
        user_id,
        display_name,
        public_area
        `
      )
      .in(
        "user_id",
        colleagueIds
      ),

    supabase
      .from(
        "weekly_commute_schedules"
      )
      .select("*")
      .in(
        "user_id",
        colleagueIds
      )
      .order(
        "day_of_week"
      ),

    supabase
      .from(
        "contact_details"
      )
      .select(
        `
        user_id,
        phone_number
        `
      )
      .in(
        "user_id",
        colleagueIds
      ),
  ]);

  if (directoryResult.error) {
    throw directoryResult.error;
  }

  if (scheduleResult.error) {
    throw scheduleResult.error;
  }

  if (contactResult.error) {
    throw contactResult.error;
  }

  const directoryRows =
    (directoryResult.data ??
      []) as Array<
      Pick<
        DirectoryRow,
        | "user_id"
        | "display_name"
        | "public_area"
      >
    >;

  const scheduleRows =
    (scheduleResult.data ??
      []) as ScheduleRow[];

  const contactRows =
    (contactResult.data ??
      []) as ContactRow[];

  const directoryMap =
    new Map(
      directoryRows.map(
        (row) => [
          row.user_id,
          row,
        ]
      )
    );

  const phoneMap =
    new Map(
      contactRows.map(
        (row) => [
          row.user_id,
          row.phone_number,
        ]
      )
    );

  const scheduleByUser =
    new Map<
      string,
      ScheduleRow[]
    >();

  for (const row of scheduleRows) {
    scheduleByUser.set(
      row.user_id,

      [
        ...(scheduleByUser.get(
          row.user_id
        ) ?? []),

        row,
      ]
    );
  }

  return requests.map(
    (
      row
    ): LiveCarpoolRequestView => {
      const incoming =
        row.target_user_id ===
        user.id;

      const colleagueId =
        incoming
          ? row.requester_id
          : row.target_user_id;

      const colleague =
        directoryMap.get(
          colleagueId
        );

      return {
        id:
          row.id,

        requesterId:
          row.requester_id,

        requesterName:
          incoming
            ? colleague
                ?.display_name ??
              "Coworker"
            : "You",

        targetUserId:
          row.target_user_id,

        targetUserName:
          incoming
            ? "You"
            : colleague
                ?.display_name ??
              "Coworker",

        message:
          row.message,

        status:
          row.status,

        createdAt:
          row.created_at,

        direction:
          incoming
            ? "incoming"
            : "outgoing",

        colleagueId,

        colleagueName:
          colleague
            ?.display_name ??
          "Coworker",

        colleaguePublicArea:
          colleague
            ?.public_area ??
          "Area hidden",

        colleaguePhoneNumber:
          phoneMap.get(
            colleagueId
          ),

        colleagueSchedule:
          scheduleFromRows(
            scheduleByUser.get(
              colleagueId
            )
          ),
      };
    }
  );
}

/* =========================================================
   REQUEST ACTIONS
========================================================= */

export async function updateLiveRequestStatus(
  id: string,
  status: RequestStatus
) {
  const supabase =
    getSupabaseBrowserClient();

  const {
    error,
  } = await supabase
    .from(
      "carpool_requests"
    )
    .update({
      status,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      id
    );

  if (error) {
    throw error;
  }
}

export async function withdrawLiveRequest(
  id: string
) {
  const supabase =
    getSupabaseBrowserClient();

  const {
    error,
  } = await supabase
    .from(
      "carpool_requests"
    )
    .delete()
    .eq(
      "id",
      id
    );

  if (error) {
    throw error;
  }
}

/* =========================================================
   HUB ADMIN
========================================================= */

export async function updateHubSettings(
  input: {
    hubId: string;
    name: string;
    publicLabel: string;
    destinationInput: string;
  }
) {
  const supabase =
    getSupabaseBrowserClient();

  const organization =
    await getCurrentOrganization();

  if (!organization) {
    throw new Error(
      "No organization found."
    );
  }

  if (
    organization.member_role !==
      "owner" &&
    organization.member_role !==
      "admin"
  ) {
    throw new Error(
      "Only organization owners and admins can change HUB settings."
    );
  }

  if (
    input.hubId !==
    organization.hub_id
  ) {
    throw new Error(
      "You can only edit your active HUB."
    );
  }

  const {
    error,
  } = await supabase
    .from("hubs")
    .update({
      name:
        input.name.trim(),

      public_label:
        input.publicLabel.trim(),

      destination_input:
        input.destinationInput.trim(),

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      input.hubId
    );

  if (error) {
    throw error;
  }
}

/*
=========================================================
   LOG OUT
=========================================================
*/

export async function signOutLiveUser() {
  const supabase =
    getSupabaseBrowserClient();

  const {
    error,
  } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}