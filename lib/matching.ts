export function compatibilityFromDetour(
  detourMinutes: number,
  maxDetourMinutes: number,
): number {
  if (detourMinutes <= 0) return 100;
  const ceiling = Math.max(1, maxDetourMinutes);
  const ratio = Math.min(detourMinutes / ceiling, 1);
  return Math.max(60, Math.round(100 - ratio * 40));
}

export function matchLabel(detourMinutes: number) {
  if (detourMinutes <= 5) return "Excellent" as const;
  if (detourMinutes <= 10) return "Good" as const;
  return "Possible" as const;
}
