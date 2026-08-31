"use client";

import { useEffect, useState } from "react";
import type { CarpoolRequest, CommuteProfile, RequestStatus } from "@/lib/types";
import { DEMO_COLLEAGUES } from "@/lib/demo-data";
import { loadProfile, loadRequests, saveRequests } from "@/lib/demo-store";
import { formatDayList, getCompatibleDays } from "@/lib/schedule";

export default function RequestList() {
  const [requests, setRequests] = useState<CarpoolRequest[]>([]);
  const [me, setMe] = useState<CommuteProfile | null>(null);

  useEffect(() => {
    setRequests(loadRequests());
    setMe(loadProfile());
  }, []);

  function setStatus(id: string, status: RequestStatus) {
    const next = requests.map((request) => request.id === id ? { ...request, status } : request);
    setRequests(next);
    saveRequests(next);
  }

  if (!requests.length) {
    return <div className="card empty">No carpool requests yet. Pick a match and send one.</div>;
  }

  return (
    <div className="matchList">
      {requests.map((request) => {
        const colleague = DEMO_COLLEAGUES.find((person) => person.id === request.targetUserId);
        const compatibleDays = me && colleague ? getCompatibleDays(me.weeklySchedule, colleague.weeklySchedule) : [];

        return (
          <article className="card requestRow" key={request.id}>
            <div className="requestContent">
              <div className="matchTop">
                <h3 style={{ marginBottom: 0 }}>{request.targetUserName}</h3>
                <span className={`status status-${request.status}`}>{request.status}</span>
              </div>
              <p className="muted" style={{ marginBottom: 0 }}>{request.message}</p>

              {request.status === "accepted" && colleague && (
                <div className="connectionPanel">
                  <div className="connectionHeading">
                    <span className="connectionIcon">✓</span>
                    <div>
                      <strong>Connection unlocked</strong>
                      <span>Only accepted carpools reveal private contact details.</span>
                    </div>
                  </div>
                  <div className="connectionGrid">
                    <div><span className="miniLabel">Phone</span><strong>{colleague.phoneNumber}</strong></div>
                    <div><span className="miniLabel">Compatible this week</span><strong>{formatDayList(compatibleDays)}</strong></div>
                    <div><span className="miniLabel">Public pickup area</span><strong>{colleague.publicArea}</strong></div>
                  </div>
                  <p className="contactHint">Use the phone number to agree on the exact pickup point and any last-minute schedule details. The exact home address does not need to live in HUBpool.</p>
                </div>
              )}
            </div>

            {request.status === "pending" && (
              <div className="actions requestActions">
                <button className="button buttonSecondary" onClick={() => setStatus(request.id, "accepted")}>Simulate accept</button>
                <button className="button buttonGhost" onClick={() => setStatus(request.id, "declined")}>Decline</button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
