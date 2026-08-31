import type { CachedMatch, CommuteProfile, WeeklySchedule } from "@/lib/types";
import { createDefaultWeeklySchedule } from "@/lib/schedule";

function schedule(overrides: Partial<WeeklySchedule> = {}): WeeklySchedule {
  return { ...createDefaultWeeklySchedule(), ...overrides };
}

export const DEMO_CURRENT_USER: CommuteProfile = {
  id: "you",
  displayName: "You",
  phoneNumber: "",
  originInput: "El Perelló, Valencia",
  publicArea: "El Perelló",
  privacyLevel: "town",
  role: "either",
  availableSeats: 3,
  maxDetourMinutes: 10,
  weeklySchedule: schedule({
    tue: { enabled: false, arriveBy: "09:00", leaveAt: "18:00" },
    thu: { enabled: true, arriveBy: "10:00", leaveAt: "19:00" },
  }),
  routeDurationMinutes: 38,
  routeDistanceKm: 31.4,
  routeCalculatedAt: "2026-08-31T09:00:00.000Z",
};

export const DEMO_COLLEAGUES: CommuteProfile[] = [
  {
    id: "lucia",
    displayName: "Lucía",
    phoneNumber: "+34 600 000 101",
    originInput: "Sueca, Valencia",
    publicArea: "Sueca",
    privacyLevel: "town",
    role: "driver",
    availableSeats: 2,
    maxDetourMinutes: 10,
    weeklySchedule: schedule({
      tue: { enabled: false, arriveBy: "09:00", leaveAt: "18:00" },
      thu: { enabled: true, arriveBy: "10:15", leaveAt: "19:15" },
    }),
    routeDurationMinutes: 34,
    routeDistanceKm: 28.1,
    routeCalculatedAt: "2026-08-31T08:15:00.000Z",
  },
  {
    id: "james",
    displayName: "James",
    phoneNumber: "+34 600 000 102",
    originInput: "Cullera, Valencia",
    publicArea: "Cullera",
    privacyLevel: "town",
    role: "either",
    availableSeats: 3,
    maxDetourMinutes: 12,
    weeklySchedule: schedule({
      mon: { enabled: true, arriveBy: "08:00", leaveAt: "17:00" },
      wed: { enabled: true, arriveBy: "08:00", leaveAt: "17:00" },
      fri: { enabled: true, arriveBy: "08:00", leaveAt: "17:00" },
    }),
    routeDurationMinutes: 43,
    routeDistanceKm: 39.2,
    routeCalculatedAt: "2026-08-30T17:20:00.000Z",
  },
  {
    id: "sarah",
    displayName: "Sarah",
    phoneNumber: "+34 600 000 103",
    originInput: "El Saler, Valencia",
    publicArea: "El Saler",
    privacyLevel: "postcode",
    role: "driver",
    availableSeats: 1,
    maxDetourMinutes: 8,
    weeklySchedule: schedule({
      wed: { enabled: false, arriveBy: "09:00", leaveAt: "18:00" },
      thu: { enabled: true, arriveBy: "10:30", leaveAt: "19:30" },
      sat: { enabled: true, arriveBy: "09:00", leaveAt: "18:00" },
    }),
    routeDurationMinutes: 23,
    routeDistanceKm: 17.6,
    routeCalculatedAt: "2026-08-30T18:10:00.000Z",
  },
];

export const DEMO_MATCHES: CachedMatch[] = [
  {
    id: "match-lucia",
    candidate: DEMO_COLLEAGUES[0],
    recommendedDriverId: "lucia",
    detourMinutes: 3,
    routeCompatibility: 96,
    label: "Excellent",
    cachedAt: "2026-08-31T09:00:00.000Z",
  },
  {
    id: "match-james",
    candidate: DEMO_COLLEAGUES[1],
    recommendedDriverId: "james",
    detourMinutes: 6,
    routeCompatibility: 88,
    label: "Good",
    cachedAt: "2026-08-31T09:00:00.000Z",
  },
  {
    id: "match-sarah",
    candidate: DEMO_COLLEAGUES[2],
    recommendedDriverId: "you",
    detourMinutes: 8,
    routeCompatibility: 78,
    label: "Possible",
    cachedAt: "2026-08-31T09:00:00.000Z",
  },
];
