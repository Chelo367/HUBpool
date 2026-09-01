export type CommuteRole = "driver" | "passenger" | "either";
export type PrivacyLevel = "exact" | "postcode" | "town" | "meeting_point";
export type RequestStatus = "pending" | "accepted" | "declined";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OrganizationRole = "owner" | "admin" | "member";

export interface DaySchedule {
  enabled: boolean;
  arriveBy: string;
  leaveAt: string;
}

export type WeeklySchedule = Record<Weekday, DaySchedule>;

export interface OrganizationContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  memberRole: OrganizationRole;

  hubId: string;
  hubName: string;
  hubPublicLabel: string;
  hubDestinationConfigured: boolean;
}

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

  organizationId?: string;
  organizationName?: string;

  hubId?: string;
  hubName?: string;
  hubPublicLabel?: string;
  hubDestinationConfigured?: boolean;

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

export interface LiveRouteMatch {
  id: string;

  candidate: DirectoryCoworker;

  ownerDriverDetourMinutes: number | null;
  candidateDriverDetourMinutes: number | null;

  cachedAt: string;
}

export interface RouteRebuildResult {
  rebuilt: boolean;
  cached: boolean;

  googleCalls: number;

  pairsCached?: number;

  warnings?: string[];

  route?: {
    durationMinutes: number;
    distanceKm: number;
  };
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

export interface HubAdminView {
  id: string;

  organizationId: string;
  organizationName: string;

  memberRole: OrganizationRole;

  name: string;
  publicLabel: string;

  destinationInput: string;

  isActive: boolean;
}