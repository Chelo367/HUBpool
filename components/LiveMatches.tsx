"use client";

import { useEffect, useMemo, useState } from "react";

import {
  loadLiveCoworkers,
  loadLiveProfile,
  loadLiveRouteMatches,
  sendLiveRequest,
} from "@/lib/live-store";

import {
  formatDayList,
  getCompatibleDays,
  scheduleCompatibilityPercent,
} from "@/lib/schedule";

import type {
  CommuteProfile,
  DirectoryCoworker,
  LiveRouteMatch,
} from "@/lib/types";

/* =========================================================
   ROUTE HELPERS
========================================================= */

function canDrive(
  profile: Pick<CommuteProfile, "role">
) {
  return (
    profile.role === "driver" ||
    profile.role === "either"
  );
}

function canRide(
  profile: Pick<CommuteProfile, "role">
) {
  return (
    profile.role === "passenger" ||
    profile.role === "either"
  );
}

function scoreForDetour(detour: number) {
  return Math.max(
    0,
    Math.min(
      100,
      100 - detour * 2
    )
  );
}

function labelForDetour(detour: number) {
  if (detour <= 5) {
    return "Excellent";
  }

  if (detour <= 10) {
    return "Good";
  }

  return "Possible";
}

function chooseBestRoute(
  me: CommuteProfile,
  match: LiveRouteMatch
) {
  const coworker =
    match.candidate;

  const options: Array<{
    driverId: string;
    detour: number;
  }> = [];

  /*
   * OPTION A
   * I drive and pick the coworker up.
   */
  if (
    match.ownerDriverDetourMinutes != null &&
    canDrive(me) &&
    canRide(coworker) &&
    match.ownerDriverDetourMinutes <=
      me.maxDetourMinutes
  ) {
    options.push({
      driverId: me.id,
      detour:
        match.ownerDriverDetourMinutes,
    });
  }

  /*
   * OPTION B
   * Coworker drives and picks me up.
   */
  if (
    match.candidateDriverDetourMinutes != null &&
    canDrive(coworker) &&
    canRide(me) &&
    match.candidateDriverDetourMinutes <=
      coworker.maxDetourMinutes
  ) {
    options.push({
      driverId:
        coworker.id,

      detour:
        match.candidateDriverDetourMinutes,
    });
  }

  options.sort(
    (a, b) =>
      a.detour - b.detour
  );

  return options[0] ?? null;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function LiveMatches() {
  const [me, setMe] =
    useState<CommuteProfile | null>(
      null
    );

  const [coworkers, setCoworkers] =
    useState<DirectoryCoworker[]>(
      []
    );

  const [
    routeMatches,
    setRouteMatches,
  ] =
    useState<LiveRouteMatch[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [sent, setSent] =
    useState<Record<string, boolean>>(
      {}
    );

  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        profile,
        sameHubCoworkers,
        geographicMatches,
      ] = await Promise.all([
        loadLiveProfile(),
        loadLiveCoworkers(),
        loadLiveRouteMatches(),
      ]);

      setMe(profile);
      setCoworkers(
        sameHubCoworkers
      );

      setRouteMatches(
        geographicMatches
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your matches."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /* =========================================================
     MAP ROUTE MATCHES BY COWORKER
  ========================================================= */

  const routeMatchMap =
    useMemo(() => {
      return new Map(
        routeMatches.map(
          (match) => [
            match.candidate.id,
            match,
          ]
        )
      );
    }, [routeMatches]);

  /* =========================================================
     BUILD DISPLAY CANDIDATES
  ========================================================= */

  const candidates =
    useMemo(() => {
      if (!me) {
        return [];
      }

      return coworkers
        .map((coworker) => {
          const routeMatch =
            routeMatchMap.get(
              coworker.id
            );

          const compatibleDays =
            getCompatibleDays(
              me.weeklySchedule,
              coworker.weeklySchedule
            );

          const scheduleScore =
            scheduleCompatibilityPercent(
              me.weeklySchedule,
              coworker.weeklySchedule
            );

          /*
           * Geography does not exist yet.
           *
           * This coworker can still be shown
           * during the multi-user pilot.
           */
          if (!routeMatch) {
            return {
              coworker,

              routeMatch:
                null as LiveRouteMatch | null,

              route:
                null as {
                  driverId: string;
                  detour: number;
                } | null,

              routeScore:
                null as number | null,

              routeLabel:
                "Pending",

              compatibleDays,

              scheduleScore,
            };
          }

          const route =
            chooseBestRoute(
              me,
              routeMatch
            );

          /*
           * We have geographic data,
           * but current driver/passenger
           * preferences do not allow a
           * viable carpool.
           */
          if (!route) {
            return {
              coworker,

              routeMatch,

              route:
                null as {
                  driverId: string;
                  detour: number;
                } | null,

              routeScore:
                null as number | null,

              routeLabel:
                "No current route",

              compatibleDays,

              scheduleScore,
            };
          }

          return {
            coworker,

            routeMatch,

            route,

            routeScore:
              scoreForDetour(
                route.detour
              ),

            routeLabel:
              labelForDetour(
                route.detour
              ),

            compatibleDays,

            scheduleScore,
          };
        })
        .sort((a, b) => {
          /*
           * Real geographic matches first.
           */
          if (
            a.routeScore != null &&
            b.routeScore == null
          ) {
            return -1;
          }

          if (
            a.routeScore == null &&
            b.routeScore != null
          ) {
            return 1;
          }

          if (
            a.routeScore != null &&
            b.routeScore != null
          ) {
            const routeDifference =
              b.routeScore -
              a.routeScore;

            if (
              routeDifference !== 0
            ) {
              return routeDifference;
            }
          }

          return (
            b.scheduleScore -
            a.scheduleScore
          );
        });
    }, [
      coworkers,
      me,
      routeMatchMap,
    ]);

  /* =========================================================
     SEND REQUEST
  ========================================================= */

  async function request(
    coworker: DirectoryCoworker
  ) {
    setError("");
    setNotice("");

    try {
      const result =
        await sendLiveRequest(
          coworker
        );

      if (
        result.alreadyExists
      ) {
        setNotice(
          `You already have an active request or connection with ${coworker.displayName}.`
        );

        return;
      }

      setSent((current) => ({
        ...current,
        [coworker.id]:
          true,
      }));

      setNotice(
        `Carpool request sent to ${coworker.displayName} ✓`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send carpool request."
      );
    }
  }

  /* =========================================================
     STATES
  ========================================================= */

  if (loading) {
    return (
      <div className="card empty">
        Loading coworkers in your
        HUB…
      </div>
    );
  }

  if (error && !me) {
    return (
      <div className="card empty">
        <h3>
          We couldn&apos;t load your
          matches.
        </h3>

        <p className="muted">
          {error}
        </p>
      </div>
    );
  }

  if (!me) {
    return null;
  }

  if (
    !me.organizationId ||
    !me.hubId
  ) {
    return (
      <div className="card empty">
        <h3>
          Join your organization first
        </h3>

        <p className="muted">
          Your organization and HUB
          determine which coworkers
          HUBpool is allowed to show
          you.
        </p>

        <a
          className="button"
          href="/onboarding"
        >
          Join organization
        </a>
      </div>
    );
  }

  if (!me.originInput) {
    return (
      <div className="card empty">
        <h3>
          Set up your commute first
        </h3>

        <p className="muted">
          Add your origin, public
          area, commute role and
          weekly schedule before
          finding coworkers.
        </p>

        <a
          className="button"
          href="/onboarding"
        >
          Set up my commute
        </a>
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
      <div className="notice pilotNotice">
        <strong>
          {me.organizationName}
          {" · "}
          {me.hubName}
        </strong>

        <div
          style={{
            marginTop: 6,
          }}
        >
          Only coworkers assigned to
          this HUB can appear here.
        </div>
      </div>

      {!me.hubDestinationConfigured && (
        <div className="notice">
          <strong>
            Geographic matching is
            not active yet.
          </strong>

          {" "}
          Your organization admin
          still needs to configure the
          HUB&apos;s routing
          destination. Schedule
          compatibility remains fully
          available.
        </div>
      )}

      {me.hubDestinationConfigured &&
        !routeMatches.length && (
          <div className="notice liveNotice">
            <strong>
              Geographic matching
              ready for V4 Routes.
            </strong>

            {" "}
            HUBpool already knows your
            organization and HUB.
            Google route caching is the
            next layer we will enable.
          </div>
        )}

      {notice && (
        <div className="notice liveNotice">
          {notice}
        </div>
      )}

      {error && (
        <div className="notice errorNotice">
          {error}
        </div>
      )}

      {!candidates.length ? (
        <div className="card empty">
          <h3>
            No coworkers here yet.
          </h3>

          <p className="muted">
            Once another employee
            joins this HUB and creates
            a commute profile, they
            will appear here.
          </p>
        </div>
      ) : (
        <div className="matchList">
          {candidates.map(
            ({
              coworker,
              route,
              routeScore,
              routeLabel,
              compatibleDays,
              scheduleScore,
            }) => (
              <article
                className="card matchCard liveMatchCard"
                key={coworker.id}
              >
                <div>
                  <div className="matchTop">
                    <h3
                      style={{
                        marginBottom: 0,
                      }}
                    >
                      {
                        coworker.displayName
                      }
                    </h3>

                    <span className="badge">
                      📍{" "}
                      {
                        coworker.publicArea
                      }
                    </span>

                    {route ? (
                      <span className="badge badgeLive">
                        Cached route ✓
                      </span>
                    ) : (
                      <span className="badge">
                        Geography pending
                      </span>
                    )}
                  </div>

                  <div className="matchMeta">
                    {route ? (
                      <>
                        <span>
                          🚗{" "}
                          {route.driverId ===
                          me.id
                            ? "You drive"
                            : `${coworker.displayName} drives`}
                        </span>

                        <span>
                          ↪ +
                          {
                            route.detour
                          }{" "}
                          min pickup
                          detour
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          🚗{" "}
                          {coworker.role ===
                          "either"
                            ? "Driver or passenger"
                            : coworker.role ===
                              "driver"
                            ? "Driver"
                            : "Passenger"}
                        </span>

                        {coworker.role !==
                          "passenger" && (
                          <span>
                            💺{" "}
                            {
                              coworker.availableSeats
                            }{" "}
                            seat
                            {coworker.availableSeats ===
                            1
                              ? ""
                              : "s"}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="scheduleMatchStrip">
                    <div>
                      <span className="miniLabel">
                        Compatible this
                        week
                      </span>

                      <strong>
                        {formatDayList(
                          compatibleDays
                        )}
                      </strong>
                    </div>

                    <span
                      className={`scheduleScore ${
                        scheduleScore >= 70
                          ? "scheduleStrong"
                          : scheduleScore >=
                            35
                          ? "scheduleMedium"
                          : "scheduleWeak"
                      }`}
                    >
                      {scheduleScore}%
                      schedule fit
                    </span>
                  </div>

                  <div className="privacyLine">
                    🔒 Exact origins stay
                    private. Phone
                    numbers unlock only
                    after an accepted
                    connection.
                  </div>

                  <div
                    className="actions"
                    style={{
                      marginTop: 18,
                    }}
                  >
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        void request(
                          coworker
                        )
                      }
                      disabled={
                        sent[
                          coworker.id
                        ]
                      }
                    >
                      {sent[
                        coworker.id
                      ]
                        ? "Request sent ✓"
                        : "Request carpool"}
                    </button>
                  </div>
                </div>

                <div className="score">
                  {routeScore != null ? (
                    <>
                      <strong>
                        {routeScore}%
                      </strong>

                      <span>
                        {routeLabel} route
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>
                        {scheduleScore}%
                      </strong>

                      <span>
                        Schedule match
                      </span>
                    </>
                  )}
                </div>
              </article>
            )
          )}
        </div>
      )}
    </>
  );
}