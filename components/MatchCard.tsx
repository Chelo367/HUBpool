"use client";

import { useEffect, useState } from "react";
import type { CachedMatch, CarpoolRequest, CommuteProfile } from "@/lib/types";
import { loadProfile, loadRequests, saveRequests } from "@/lib/demo-store";
import { formatDayList, getCompatibleDays, scheduleCompatibilityPercent } from "@/lib/schedule";

export default function MatchCard({ match }: { match: CachedMatch }) {
  const [me, setMe] = useState<CommuteProfile | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMe(loadProfile());
    setSent(loadRequests().some((r) => r.targetUserId === match.candidate.id && r.status !== "declined"));
  }, [match.candidate.id]);

  function requestCarpool() {
    const currentUser = loadProfile();
    const existing = loadRequests();
    if (existing.some((r) => r.targetUserId === match.candidate.id && r.status === "pending")) {
      setSent(true);
      return;
    }

    const request: CarpoolRequest = {
      id: crypto.randomUUID(),
      requesterId: currentUser.id,
      requesterName: currentUser.displayName,
      targetUserId: match.candidate.id,
      targetUserName: match.candidate.displayName,
      message: `Hi ${match.candidate.displayName}! HUBpool thinks our commute is a good match. Want to arrange a carpool?`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    saveRequests([request, ...existing]);
    setSent(true);
  }

  const badgeClass = match.label === "Excellent" ? "badgeExcellent" : match.label === "Good" ? "badgeGood" : "badgePossible";
  const compatibleDays = me ? getCompatibleDays(me.weeklySchedule, match.candidate.weeklySchedule) : [];
  const scheduleScore = me ? scheduleCompatibilityPercent(me.weeklySchedule, match.candidate.weeklySchedule) : 0;

  return (
    <article className="card matchCard">
      <div>
        <div className="matchTop">
          <h3 style={{ marginBottom: 0 }}>{match.candidate.displayName}</h3>
          <span className={`badge ${badgeClass}`}>{match.label} route</span>
          <span className="badge">📍 {match.candidate.publicArea}</span>
        </div>

        <div className="matchMeta">
          <span>🚗 {match.candidate.role === "either" ? "Driver or passenger" : match.candidate.role}</span>
          <span>💺 {match.candidate.availableSeats} seat{match.candidate.availableSeats === 1 ? "" : "s"}</span>
          <span>↪ +{match.detourMinutes} min pickup detour</span>
        </div>

        <div className="scheduleMatchStrip">
          <div>
            <span className="miniLabel">This week</span>
            <strong>{formatDayList(compatibleDays)}</strong>
          </div>
          <span className={`scheduleScore ${scheduleScore >= 70 ? "scheduleStrong" : scheduleScore >= 35 ? "scheduleMedium" : "scheduleWeak"}`}>
            {scheduleScore}% schedule fit
          </span>
        </div>

        <div className="privacyLine">🔒 Phone number and exact pickup details stay hidden until the request is accepted.</div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button className="button" onClick={requestCarpool} disabled={sent}>{sent ? "Request sent ✓" : "Request carpool"}</button>
        </div>
      </div>

      <div className="score">
        <strong>{match.routeCompatibility}%</strong>
        <span>route compatibility</span>
      </div>
    </article>
  );
}
