"use client";

import { useEffect, useState } from "react";
import AuthRequired from "@/components/AuthRequired";
import type { CommuteProfile, LiveCarpoolRequestView, RequestStatus } from "@/lib/types";
import { loadLiveProfile, loadLiveRequests, updateLiveRequestStatus, withdrawLiveRequest } from "@/lib/live-store";
import { formatDayList, getCompatibleDays } from "@/lib/schedule";

export default function LiveRequestList() {
  const [requests, setRequests] = useState<LiveCarpoolRequestView[]>([]);
  const [me, setMe] = useState<CommuteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [profile, rows] = await Promise.all([loadLiveProfile(), loadLiveRequests()]);
      setMe(profile);
      setRequests(rows);
      setNeedsAuth(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load requests.";
      if (message.toLowerCase().includes("sign in") || message.toLowerCase().includes("auth")) setNeedsAuth(true);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function setStatus(id: string, status: RequestStatus) {
    setError("");
    try {
      await updateLiveRequestStatus(id, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update request.");
    }
  }

  async function withdraw(id: string) {
    setError("");
    try {
      await withdrawLiveRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to withdraw request.");
    }
  }

  if (loading) return <div className="card empty">Loading real carpool connections…</div>;
  if (needsAuth) return <AuthRequired/>;
  if (!requests.length) return <div className="card empty">No carpool requests yet. Pick a coworker from Matches and send one.</div>;

  return (
    <>
      {error && <div className="notice errorNotice">{error}</div>}
      <div className="matchList">
        {requests.map((request) => {
          const compatibleDays = me ? getCompatibleDays(me.weeklySchedule, request.colleagueSchedule) : [];
          const accepted = request.status === "accepted";

          return (
            <article className="card requestRow" key={request.id}>
              <div className="requestContent">
                <div className="matchTop">
                  <h3 style={{ marginBottom: 0 }}>{request.colleagueName}</h3>
                  <span className={`status status-${request.status}`}>{request.status}</span>
                  <span className="badge">{request.direction === "incoming" ? "Incoming" : "Sent by you"}</span>
                </div>
                <p className="muted" style={{ marginBottom: 0 }}>{request.message}</p>

                {accepted && (
                  <div className="connectionPanel">
                    <div className="connectionHeading">
                      <span className="connectionIcon">✓</span>
                      <div>
                        <strong>Connection unlocked</strong>
                        <span>The database now allows both of you to see each other&apos;s private phone number.</span>
                      </div>
                    </div>
                    <div className="connectionGrid">
                      <div><span className="miniLabel">Phone</span><strong>{request.colleaguePhoneNumber || "No phone added yet"}</strong></div>
                      <div><span className="miniLabel">Compatible this week</span><strong>{formatDayList(compatibleDays)}</strong></div>
                      <div><span className="miniLabel">Public pickup area</span><strong>{request.colleaguePublicArea}</strong></div>
                    </div>
                    <p className="contactHint">Call or message each other to agree the exact pickup point and last-minute details. HUBpool does not need to expose either person&apos;s home address.</p>
                  </div>
                )}
              </div>

              {request.status === "pending" && request.direction === "incoming" && (
                <div className="actions requestActions">
                  <button className="button buttonSecondary" onClick={() => void setStatus(request.id, "accepted")}>Accept</button>
                  <button className="button buttonGhost" onClick={() => void setStatus(request.id, "declined")}>Decline</button>
                </div>
              )}

              {request.status === "pending" && request.direction === "outgoing" && (
                <div className="actions requestActions">
                  <button className="button buttonGhost" onClick={() => void withdraw(request.id)}>Withdraw</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
