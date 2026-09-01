"use client";

import { useEffect, useState } from "react";
import {
  getCurrentOrganization,
  joinOrganizationByCode,
  type CurrentOrganization,
} from "@/lib/live-store";

type OrganizationGateProps = {
  children: React.ReactNode;
};

export default function OrganizationGate({
  children,
}: OrganizationGateProps) {
  const [organization, setOrganization] =
    useState<CurrentOrganization | null>(null);

  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function loadOrganization() {
    setLoading(true);

    try {
      const current = await getCurrentOrganization();
      setOrganization(current);
    } catch (err) {
      console.error(err);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrganization();
  }, []);

  async function handleJoin() {
    const code = joinCode.trim();

    if (!code) {
      setError("Enter your organization join code.");
      return;
    }

    setError("");
    setJoining(true);

    try {
      await joinOrganizationByCode(code);
      await loadOrganization();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't join that organization."
      );
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="eyebrow">ORGANIZATION</p>
        <h2>Loading your workplace…</h2>
      </section>
    );
  }

  if (organization) {
    return <>{children}</>;
  }

  return (
    <section className="panel organization-gate">
      <p className="eyebrow">WELCOME TO HUBPOOL</p>

      <h1>Which workplace are you commuting to?</h1>

      <p className="muted">
        Your organization keeps coworkers, routes and carpool requests inside
        the correct workplace.
      </p>

      <label className="field">
        <span>Organization join code</span>

        <input
          type="text"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value)}
          placeholder="e.g. COMPANY-XXXXXXXX"
          autoComplete="off"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button
        type="button"
        className="primary-button"
        onClick={handleJoin}
        disabled={joining}
      >
        {joining ? "Joining…" : "Join organization"}
      </button>

      <p className="muted small">
        Ask your workplace administrator for the HUBpool join code.
      </p>
    </section>
  );
}