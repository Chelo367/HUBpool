const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
  encodedPolyline?: string;
}

function parseGoogleDuration(duration?: string): number {
  if (!duration) return 0;
  return Number(duration.replace("s", ""));
}

export async function computeRoute(
  originAddress: string,
  destinationAddress: string,
  intermediates: string[] = [],
): Promise<RouteResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }

  const response = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { address: originAddress },
      destination: { address: destinationAddress },
      intermediates: intermediates.map((address) => ({ address })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "METRIC",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Routes API ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    routes?: Array<{
      duration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
    }>;
  };

  const route = data.routes?.[0];
  if (!route) throw new Error("Google returned no route.");

  return {
    durationSeconds: parseGoogleDuration(route.duration),
    distanceMeters: route.distanceMeters ?? 0,
    encodedPolyline: route.polyline?.encodedPolyline,
  };
}

export async function computePickupDetour(args: {
  driverOrigin: string;
  passengerOrigin: string;
  hub: string;
  cachedDriverDurationSeconds?: number;
}) {
  const normalDuration =
    args.cachedDriverDurationSeconds ??
    (await computeRoute(args.driverOrigin, args.hub)).durationSeconds;

  const sharedRoute = await computeRoute(args.driverOrigin, args.hub, [
    args.passengerOrigin,
  ]);

  return {
    detourSeconds: Math.max(0, sharedRoute.durationSeconds - normalDuration),
    sharedRoute,
  };
}
