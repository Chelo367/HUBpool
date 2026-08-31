"use client";

import type { CarpoolRequest, CommuteProfile } from "@/lib/types";
import { DEMO_CURRENT_USER } from "@/lib/demo-data";
import { createDefaultWeeklySchedule } from "@/lib/schedule";

const PROFILE_KEY = "hubpool.profile";
const REQUESTS_KEY = "hubpool.requests";

export function loadProfile(): CommuteProfile {
  if (typeof window === "undefined") return DEMO_CURRENT_USER;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return DEMO_CURRENT_USER;

  const stored = JSON.parse(raw) as Partial<CommuteProfile>;
  const defaults = createDefaultWeeklySchedule();
  return {
    ...DEMO_CURRENT_USER,
    ...stored,
    phoneNumber: stored.phoneNumber ?? "",
    weeklySchedule: {
      ...defaults,
      ...(stored.weeklySchedule ?? {}),
    },
  };
}

export function saveProfile(profile: CommuteProfile) {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadRequests(): CarpoolRequest[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(REQUESTS_KEY);
  return raw ? (JSON.parse(raw) as CarpoolRequest[]) : [];
}

export function saveRequests(requests: CarpoolRequest[]) {
  window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}
