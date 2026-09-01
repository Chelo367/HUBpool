export type CommuteRole = "driver" | "passenger" | "either";
export type PrivacyLevel = "exact" | "postcode" | "town" | "meeting_point";
export type RequestStatus = "pending" | "accepted" | "declined";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DaySchedule {
  enabled: boolean;
  arriveBy: string;
  leaveAt: string;
}

export type WeeklySchedule = Record<Weekday, DaySchedule>;

export interface CommuteProfile {
  id: string;
  displayName: string;
  phoneNumber: string;
  originInput: string;
  publicArea: string;
  privacyLevel: PrivacyLevel;
  role: CommuteRole;
  availableSeats: number;
  maxDetourMinutes: number;
  weeklySchedule: WeeklySchedule;
  routeDurationMinutes?: number;
  routeDistanceKm?: number;
  routePolyline?: string;
  routeCalculatedAt?: string;
}

export interface CachedMatch {
  id: string;
  candidate: CommuteProfile;
  recommendedDriverId: string;
  detourMinutes: number;
  routeCompatibility: number;
  label: "Excellent" | "Good" | "Possible";
  cachedAt: string;
}

export interface CarpoolRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  targetUserId: string;
  targetUserName: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
}

export interface DirectoryCoworker extends CommuteProfile {
  routeReady: boolean;
}

export interface LiveCarpoolRequestView extends CarpoolRequest {
  direction: "incoming" | "outgoing";
  colleagueId: string;
  colleagueName: string;
  colleaguePublicArea: string;
  colleaguePhoneNumber?: string;
  colleagueSchedule: WeeklySchedule;
}
