"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import WeeklyScheduleEditor from "@/components/WeeklyScheduleEditor";

import {
  loadLiveProfile,
  saveLiveProfile,
} from "@/lib/live-store";

import type {
  CommuteProfile,
  CommuteRole,
  PrivacyLevel,
} from "@/lib/types";

export default function CommuteProfileForm() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<CommuteProfile | null>(null);

  const [saved, setSaved] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [routeChanged, setRouteChanged] =
    useState(false);

  const [baselineOrigin, setBaselineOrigin] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const loaded =
          await loadLiveProfile();

        if (!active) return;

        setProfile(loaded);

        setBaselineOrigin(
          loaded.originInput
            .trim()
            .toLowerCase()
        );
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load profile."
        );
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (!profile) {
    return (
      <div className="card formCard">
        {error ||
          "Loading commute profile…"}
      </div>
    );
  }

  function update<
    K extends keyof CommuteProfile
  >(
    key: K,
    value: CommuteProfile[K]
  ) {
    setSaved(false);

    if (key === "originInput") {
      setRouteChanged(
        String(value)
          .trim()
          .toLowerCase() !==
          baselineOrigin
      );
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );
  }

  async function onSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!profile) return;

    setBusy(true);
    setError("");

    try {
      const next: CommuteProfile = {
        ...profile,

        availableSeats:
          profile.role ===
          "passenger"
            ? 0
            : profile.availableSeats,
      };

      await saveLiveProfile(next);

      setProfile(next);

      setBaselineOrigin(
        next.originInput
          .trim()
          .toLowerCase()
      );

      setRouteChanged(false);
      setSaved(true);

      setTimeout(() => {
        router.push("/matches");
      }, 450);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save profile."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card formCard"
      onSubmit={(
        event: FormEvent<HTMLFormElement>
      ) => void onSubmit(event)}
    >
      <div className="sectionHeader compactHeader">
        <div>
          <p className="eyebrow">
            YOUR COMMUTE{" "}
            <span className="inlineLive">
              LIVE
            </span>
          </p>

          <h2
            style={{
              marginBottom: 0,
            }}
          >
            Set the route once. Update
            the week anytime.
          </h2>
        </div>
      </div>

      {profile.organizationName &&
        profile.hubName && (
          <div
            className="notice liveNotice"
            style={{
              marginBottom: 24,
            }}
          >
            <strong>
              {profile.organizationName}
            </strong>

            <div
              style={{
                marginTop: 6,
              }}
            >
              Your commute destination:
              {" "}
              <strong>
                {profile.hubName}
              </strong>

              {profile.hubPublicLabel
                ? ` · ${profile.hubPublicLabel}`
                : ""}
            </div>

            {!profile.hubDestinationConfigured && (
              <div
                style={{
                  marginTop: 8,
                }}
              >
                Geographic matching is
                waiting for an organization
                admin to configure this
                HUB&apos;s routing destination.
              </div>
            )}
          </div>
        )}

      <div
        className="notice"
        style={{
          marginBottom: 24,
        }}
      >
        <strong>
          Cheap by design:
        </strong>{" "}
        phone numbers and weekly schedule
        changes never require a Maps call.
        Only changing your routing origin
        invalidates your cached geographic
        route.
      </div>

      <div
        className="notice liveNotice"
        style={{
          marginBottom: 24,
        }}
      >
        <strong>
          Shared account enabled:
        </strong>{" "}
        your profile is stored in HUBpool&apos;s
        shared database. Coworkers in your
        HUB can see your public area and
        commute availability, but your
        private routing origin and phone
        number remain protected.
      </div>

      {error && (
        <div
          className="notice errorNotice"
          style={{
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      <section className="formSection">
        <div className="formSectionTitle">
          <span className="sectionIcon">
            01
          </span>

          <div>
            <h3>
              Profile & private contact
            </h3>

            <p>
              Your phone is only shared
              after a carpool connection is
              accepted.
            </p>
          </div>
        </div>

        <div className="formGrid">
          <div className="field">
            <label htmlFor="name">
              Display name
            </label>

            <input
              id="name"
              value={profile.displayName}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                update(
                  "displayName",
                  event.target.value
                )
              }
              required
            />
          </div>

          <div className="field">
            <label htmlFor="phone">
              Phone number
            </label>

            <input
              id="phone"
              type="tel"
              value={profile.phoneNumber}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                update(
                  "phoneNumber",
                  event.target.value
                )
              }
              placeholder="e.g. +34 6XX XXX XXX"
            />

            <span className="help">
              Hidden from the match
              directory. Revealed only after
              a carpool connection is
              accepted.
            </span>
          </div>
        </div>
      </section>

      <section className="formSection">
        <div className="formSectionTitle">
          <span className="sectionIcon">
            02
          </span>

          <div>
            <h3>Route profile</h3>

            <p>
              This location is used to build
              your cached geographic match
              with coworkers travelling to
              the same HUB.
            </p>
          </div>
        </div>

        <div className="formGrid">
          <div className="field">
            <label htmlFor="role">
              I can be a…
            </label>

            <select
              id="role"
              value={profile.role}
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                update(
                  "role",
                  event.target
                    .value as CommuteRole
                )
              }
            >
              <option value="either">
                Driver or passenger
              </option>

              <option value="driver">
                Driver
              </option>

              <option value="passenger">
                Passenger
              </option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="seats">
              Available seats
            </label>

            <input
              id="seats"
              type="number"
              min="0"
              max="8"
              value={
                profile.role ===
                "passenger"
                  ? 0
                  : profile.availableSeats
              }
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                update(
                  "availableSeats",
                  Number(
                    event.target.value
                  )
                )
              }
              disabled={
                profile.role ===
                "passenger"
              }
            />
          </div>

          <div className="field fieldFull">
            <label htmlFor="origin">
              Home area / routing origin
            </label>

            <input
              id="origin"
              value={profile.originInput}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                update(
                  "originInput",
                  event.target.value
                )
              }
              placeholder="e.g. Valencia, 46001, or an exact address"
              required
            />

            <span className="help">
              Stored privately. Coworkers
              only see the public area
              below.
            </span>

            {routeChanged && (
              <span className="routeWarning">
                Routing origin changed —
                your cached geographic match
                will need to be rebuilt once.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="area">
              Public area shown to
              colleagues
            </label>

            <input
              id="area"
              value={profile.publicArea}
              onChange={(
                event: ChangeEvent<HTMLInputElement>
              ) =>
                update(
                  "publicArea",
                  event.target.value
                )
              }
              placeholder="e.g. Valencia"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="privacy">
              Location privacy
            </label>

            <select
              id="privacy"
              value={profile.privacyLevel}
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                update(
                  "privacyLevel",
                  event.target
                    .value as PrivacyLevel
                )
              }
            >
              <option value="exact">
                Exact address (hidden)
              </option>

              <option value="postcode">
                Postcode
              </option>

              <option value="town">
                Town only
              </option>

              <option value="meeting_point">
                Meeting point
              </option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="detour">
              Maximum pickup detour
            </label>

            <select
              id="detour"
              value={
                profile.maxDetourMinutes
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                update(
                  "maxDetourMinutes",
                  Number(
                    event.target.value
                  )
                )
              }
            >
              <option value="5">
                5 minutes
              </option>

              <option value="10">
                10 minutes
              </option>

              <option value="15">
                15 minutes
              </option>
            </select>
          </div>
        </div>
      </section>

      <section className="formSection">
        <div className="formSectionTitle scheduleTitle">
          <span className="sectionIcon">
            03
          </span>

          <div>
            <h3>This week</h3>

            <p>
              Change this whenever shifts
              move. Schedule compatibility
              updates without recalculating
              geographic routes.
            </p>
          </div>

          <span className="zeroCostBadge">
            0 Maps calls
          </span>
        </div>

        <WeeklyScheduleEditor
          value={
            profile.weeklySchedule
          }
          onChange={(
            weeklySchedule
          ) =>
            update(
              "weeklySchedule",
              weeklySchedule
            )
          }
        />
      </section>

      <div className="actions formActions">
        <button
          className="button"
          type="submit"
          disabled={busy}
        >
          {busy
            ? "Saving…"
            : "Save profile & view matches"}
        </button>

        {saved && (
          <span className="savedNote">
            Saved ✓
          </span>
        )}
      </div>
    </form>
  );
}