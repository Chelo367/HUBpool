"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthRequired from "@/components/AuthRequired";
import WeeklyScheduleEditor from "@/components/WeeklyScheduleEditor";
import { loadProfile, saveProfile } from "@/lib/demo-store";
import { loadLiveProfile, saveLiveProfile } from "@/lib/live-store";
import type { CommuteProfile, CommuteRole, PrivacyLevel } from "@/lib/types";

export default function CommuteProfileForm({ liveMode = false }: { liveMode?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CommuteProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [routeChanged, setRouteChanged] = useState(false);
  const [baselineOrigin, setBaselineOrigin] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loaded = liveMode ? await loadLiveProfile() : loadProfile();
        if (!active) return;
        setProfile(loaded);
        setBaselineOrigin(loaded.originInput.trim().toLowerCase());
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Unable to load profile.";
        if (message.toLowerCase().includes("sign in") || message.toLowerCase().includes("auth")) setNeedsAuth(true);
        else setError(message);
      }
    }
    void load();
    return () => { active = false; };
  }, [liveMode]);

  if (needsAuth) return <AuthRequired />;
  if (!profile) return <div className="card formCard">{error || "Loading commute profile…"}</div>;

  function update<K extends keyof CommuteProfile>(key: K, value: CommuteProfile[K]) {
    setSaved(false);
    if (key === "originInput") {
      setRouteChanged(String(value).trim().toLowerCase() !== baselineOrigin);
    }
    setProfile((current) => current ? { ...current, [key]: value } : current);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError("");

    try {
      const next: CommuteProfile = {
        ...profile,
        availableSeats: profile.role === "passenger" ? 0 : profile.availableSeats,
      };

      if (liveMode) {
        await saveLiveProfile(next);
      } else {
        const originChanged = baselineOrigin !== next.originInput.trim().toLowerCase();
        next.routeCalculatedAt = originChanged || !next.routeCalculatedAt
          ? new Date().toISOString()
          : next.routeCalculatedAt;
        saveProfile(next);
      }

      setProfile(next);
      setBaselineOrigin(next.originInput.trim().toLowerCase());
      setRouteChanged(false);
      setSaved(true);
      setTimeout(() => router.push("/matches"), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card formCard" onSubmit={(event: FormEvent<HTMLFormElement>) => void onSubmit(event)}>
      <div className="sectionHeader compactHeader">
        <div>
          <p className="eyebrow">Your commute {liveMode && <span className="inlineLive">LIVE</span>}</p>
          <h2 style={{ marginBottom: 0 }}>Set the route once. Update the week anytime.</h2>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 24 }}>
        <strong>Cheap by design:</strong> phone and weekly schedule changes never need a Maps call. Only changing your routing origin will invalidate the cached Google route once routing is connected.
      </div>

      {liveMode && (
        <div className="notice liveNotice" style={{ marginBottom: 24 }}>
          <strong>Shared pilot enabled:</strong> this profile is saved in Supabase and can be seen by other authenticated HUBpool testers. Your exact origin and phone are protected separately.
        </div>
      )}

      {error && <div className="notice errorNotice" style={{ marginBottom: 24 }}>{error}</div>}

      <section className="formSection">
        <div className="formSectionTitle">
          <span className="sectionIcon">01</span>
          <div><h3>Profile & private contact</h3><p>Phone is only shared after a carpool request is accepted.</p></div>
        </div>
        <div className="formGrid">
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input id="name" value={profile.displayName} onChange={(e: ChangeEvent<HTMLInputElement>) => update("displayName", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" value={profile.phoneNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => update("phoneNumber", e.target.value)} placeholder="e.g. +34 6XX XXX XXX" />
            <span className="help">Hidden from the match directory. Revealed only to an accepted carpool connection.</span>
          </div>
        </div>
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <span className="sectionIcon">02</span>
          <div><h3>Route profile</h3><p>This is the part that will determine the cached Google route match.</p></div>
        </div>
        <div className="formGrid">
          <div className="field">
            <label htmlFor="role">I can be a…</label>
            <select id="role" value={profile.role} onChange={(e: ChangeEvent<HTMLSelectElement>) => update("role", e.target.value as CommuteRole)}>
              <option value="either">Driver or passenger</option>
              <option value="driver">Driver</option>
              <option value="passenger">Passenger</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="seats">Available seats</label>
            <input id="seats" type="number" min="0" max="8" value={profile.role === "passenger" ? 0 : profile.availableSeats} onChange={(e: ChangeEvent<HTMLInputElement>) => update("availableSeats", Number(e.target.value))} disabled={profile.role === "passenger"} />
          </div>
          <div className="field fieldFull">
            <label htmlFor="origin">Home area / routing origin</label>
            <input id="origin" value={profile.originInput} onChange={(e: ChangeEvent<HTMLInputElement>) => update("originInput", e.target.value)} placeholder="e.g. El Perelló, 46420, or an exact address" required />
            <span className="help">Stored privately. Coworkers only see the public area below.</span>
            {routeChanged && <span className="routeWarning">Route origin changed — when Google is connected, this will invalidate and rebuild your route cache once.</span>}
          </div>
          <div className="field">
            <label htmlFor="area">Public area shown to colleagues</label>
            <input id="area" value={profile.publicArea} onChange={(e: ChangeEvent<HTMLInputElement>) => update("publicArea", e.target.value)} placeholder="e.g. El Perelló" required />
          </div>
          <div className="field">
            <label htmlFor="privacy">Location privacy</label>
            <select id="privacy" value={profile.privacyLevel} onChange={(e: ChangeEvent<HTMLSelectElement>) => update("privacyLevel", e.target.value as PrivacyLevel)}>
              <option value="exact">Exact address (hidden)</option>
              <option value="postcode">Postcode</option>
              <option value="town">Town only</option>
              <option value="meeting_point">Meeting point</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="detour">Maximum pickup detour</label>
            <select id="detour" value={profile.maxDetourMinutes} onChange={(e: ChangeEvent<HTMLSelectElement>) => update("maxDetourMinutes", Number(e.target.value))}>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
            </select>
          </div>
        </div>
      </section>

      <section className="formSection">
        <div className="formSectionTitle scheduleTitle">
          <span className="sectionIcon">03</span>
          <div><h3>This week</h3><p>Change this whenever shifts move. Compatibility updates without recalculating routes.</p></div>
          <span className="zeroCostBadge">0 Maps calls</span>
        </div>
        <WeeklyScheduleEditor value={profile.weeklySchedule} onChange={(weeklySchedule) => update("weeklySchedule", weeklySchedule)} />
      </section>

      <div className="actions formActions">
        <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile & view matches"}</button>
        {saved && <span className="savedNote">Saved ✓</span>}
      </div>
    </form>
  );
}
