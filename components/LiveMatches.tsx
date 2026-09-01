"use client";

import { useEffect, useMemo, useState } from "react";
import AuthRequired from "@/components/AuthRequired";
import type { CommuteProfile, DirectoryCoworker } from "@/lib/types";
import { loadLiveCoworkers, loadLiveProfile, sendLiveRequest } from "@/lib/live-store";
import { formatDayList, getCompatibleDays, scheduleCompatibilityPercent } from "@/lib/schedule";

function canDrive(profile: CommuteProfile) {
  return profile.role === "driver" || profile.role === "either";
}

function canRide(profile: CommuteProfile) {
  return profile.role === "passenger" || profile.role === "either";
}

function rolesCompatible(me: CommuteProfile, coworker: DirectoryCoworker) {
  return (canDrive(me) && canRide(coworker)) || (canDrive(coworker) && canRide(me));
}

export default function LiveMatches() {
  const [me, setMe] = useState<CommuteProfile | null>(null);
  const [coworkers, setCoworkers] = useState<DirectoryCoworker[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [profile, directory] = await Promise.all([loadLiveProfile(), loadLiveCoworkers()]);
      setMe(profile);
      setCoworkers(directory);
      setNeedsAuth(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load coworkers.";
      if (message.toLowerCase().includes("sign in") || message.toLowerCase().includes("auth")) {
        setNeedsAuth(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const candidates = useMemo(() => {
    if (!me) return [];
    return coworkers
      .filter((coworker) => rolesCompatible(me, coworker))
      .map((coworker) => ({
        coworker,
        compatibleDays: getCompatibleDays(me.weeklySchedule, coworker.weeklySchedule),
        scheduleScore: scheduleCompatibilityPercent(me.weeklySchedule, coworker.weeklySchedule),
      }))
      .sort((a, b) => b.scheduleScore - a.scheduleScore);
  }, [coworkers, me]);

  async function request(coworker: DirectoryCoworker) {
    setError("");
    try {
      const result = await sendLiveRequest(coworker);
      setSent((current) => ({ ...current, [coworker.id]: true }));
      if (result.alreadyExists) setError(`You already have an active connection or request with ${coworker.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send request.");
    }
  }

  if (loading) return <div className="card empty">Loading the shared coworker directory…</div>;
  if (needsAuth) return <AuthRequired />;
  if (!me?.originInput) {
    return (
      <div className="card empty authRequired">
        <h3>Set up your commute first</h3>
        <p className="muted">Your shared profile needs an area, role, and weekly schedule before HUBpool can compare you with coworkers.</p>
        <a className="button" href="/onboarding">Set up my commute</a>
      </div>
    );
  }

  return (
    <>
      <div className="notice pilotNotice">
        <strong>V3 live pilot:</strong> these are real registered coworkers, sorted by current schedule fit. Google route filtering is intentionally the next milestone, so HUBpool is not claiming a detour score yet.
      </div>

      {error && <div className="notice errorNotice">{error}</div>}

      {!candidates.length ? (
        <div className="card empty">
          <h3>No compatible coworkers registered yet.</h3>
          <p className="muted">Ask your test mate to create an account and save their commute profile. When they do, they will appear here automatically.</p>
        </div>
      ) : (
        <div className="matchList">
          {candidates.map(({ coworker, compatibleDays, scheduleScore }) => (
            <article className="card matchCard liveMatchCard" key={coworker.id}>
              <div>
                <div className="matchTop">
                  <h3 style={{ marginBottom: 0 }}>{coworker.displayName}</h3>
                  <span className="badge">📍 {coworker.publicArea}</span>
                  <span className="badge badgeLive">Live coworker</span>
                </div>

                <div className="matchMeta">
                  <span>🚗 {coworker.role === "either" ? "Driver or passenger" : coworker.role}</span>
                  {coworker.role !== "passenger" && <span>💺 {coworker.availableSeats} seat{coworker.availableSeats === 1 ? "" : "s"}</span>}
                  <span>↪ Up to {coworker.maxDetourMinutes} min detour</span>
                </div>

                <div className="scheduleMatchStrip">
                  <div>
                    <span className="miniLabel">Compatible this week</span>
                    <strong>{formatDayList(compatibleDays)}</strong>
                  </div>
                  <span className={`scheduleScore ${scheduleScore >= 70 ? "scheduleStrong" : scheduleScore >= 35 ? "scheduleMedium" : "scheduleWeak"}`}>
                    {scheduleScore}% schedule fit
                  </span>
                </div>

                <div className="privacyLine">🔒 Phone and private routing origin are hidden. Phone unlocks only after the other person accepts.</div>

                <div className="actions" style={{ marginTop: 18 }}>
                  <button className="button" onClick={() => void request(coworker)} disabled={sent[coworker.id]}>
                    {sent[coworker.id] ? "Request sent ✓" : "Request carpool"}
                  </button>
                </div>
              </div>

              <div className="score pendingScore">
                <strong>—</strong>
                <span>route score in V4</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
