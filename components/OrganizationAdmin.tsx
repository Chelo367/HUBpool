"use client";

import { useEffect, useState } from "react";
import {
  getCurrentOrganization,
  updateHubSettings,
  type CurrentOrganization,
} from "@/lib/live-store";

export default function OrganizationAdmin() {
  const [organization, setOrganization] =
    useState<CurrentOrganization | null>(null);

  const [hubName, setHubName] = useState("");
  const [publicLabel, setPublicLabel] = useState("");
  const [destinationInput, setDestinationInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadOrganization() {
    setLoading(true);
    setError("");

    try {
      const current = await getCurrentOrganization();

      setOrganization(current);

      if (current) {
        setHubName(current.hub_name ?? "");
        setPublicLabel(current.hub_public_label ?? "");
        setDestinationInput(current.hub_destination_input ?? "");
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "We couldn't load your organization."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrganization();
  }, []);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organization) return;

    const cleanHubName = hubName.trim();
    const cleanPublicLabel = publicLabel.trim();
    const cleanDestination = destinationInput.trim();

    if (!cleanHubName) {
      setError("The HUB needs a name.");
      return;
    }

    if (!cleanPublicLabel) {
      setError("Add a public location for the HUB.");
      return;
    }

    if (!cleanDestination) {
      setError("Add the routing destination for this HUB.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateHubSettings({
        hubId: organization.hub_id,
        name: cleanHubName,
        publicLabel: cleanPublicLabel,
        destinationInput: cleanDestination,
      });

      setMessage("HUB settings saved.");

      await loadOrganization();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save the HUB settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="eyebrow">ORGANIZATION</p>
        <h2>Loading organization settings…</h2>
      </section>
    );
  }

  if (!organization) {
    return (
      <section className="panel">
        <p className="eyebrow">ORGANIZATION</p>

        <h2>No organization found</h2>

        <p className="muted">
          Join an organization before managing a HUB.
        </p>
      </section>
    );
  }

  const canManage =
    organization.member_role === "owner" ||
    organization.member_role === "admin";

  if (!canManage) {
    return (
      <div className="stack">
        <section className="panel">
          <p className="eyebrow">YOUR ORGANIZATION</p>

          <h1>{organization.organization_name}</h1>

          <div className="organization-summary-grid">
            <div>
              <span className="muted small">HUB</span>
              <strong>{organization.hub_name}</strong>
            </div>

            <div>
              <span className="muted small">Location</span>
              <strong>
                {organization.hub_public_label || "Not configured"}
              </strong>
            </div>

            <div>
              <span className="muted small">Your role</span>
              <strong>{organization.member_role}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">HUB SETTINGS</p>

          <h2>Managed by your organization</h2>

          <p className="muted">
            Organization owners and administrators can change the central HUB
            destination.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">ORGANIZATION ADMIN</p>
            <h1>{organization.organization_name}</h1>
          </div>

          <span className="status-pill success">
            {organization.member_role}
          </span>
        </div>

        <p className="muted">
          HUB settings belong to the organization, not to the HUBpool
          deployment. Changing the destination automatically invalidates old
          geographic route caches for this HUB.
        </p>
      </section>

      <form className="panel stack" onSubmit={handleSave}>
        <div>
          <p className="eyebrow">CENTRAL HUB</p>
          <h2>Commute destination</h2>
        </div>

        <label className="field">
          <span>HUB name</span>

          <input
            type="text"
            value={hubName}
            onChange={(event) => setHubName(event.target.value)}
            placeholder="e.g. Valencia Excellence Hub"
          />

          <small>
            The internal name employees will see inside HUBpool.
          </small>
        </label>

        <label className="field">
          <span>Public location</span>

          <input
            type="text"
            value={publicLabel}
            onChange={(event) => setPublicLabel(event.target.value)}
            placeholder="e.g. Valencia"
          />

          <small>
            A simple location label. This does not need to be the exact office
            address.
          </small>
        </label>

        <label className="field">
          <span>Routing destination</span>

          <input
            type="text"
            value={destinationInput}
            onChange={(event) => setDestinationInput(event.target.value)}
            placeholder="Exact office address, postcode or Google-recognizable location"
          />

          <small>
            This is the destination HUBpool will later send to Google Routes.
            Employees do not need to see the exact value.
          </small>
        </label>

        <div className="callout">
          <strong>Route cache rule</strong>

          <p>
            Changing schedules, seats or phone numbers does not affect Google
            routing. Changing this HUB destination marks only this HUB&apos;s
            geographic cache as stale.
          </p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {message ? <p className="form-success">{message}</p> : null}

        <button
          type="submit"
          className="primary-button"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save HUB settings"}
        </button>
      </form>

      <section className="panel">
        <p className="eyebrow">MEMBERSHIP</p>

        <div className="organization-summary-grid">
          <div>
            <span className="muted small">Organization</span>
            <strong>{organization.organization_name}</strong>
          </div>

          <div>
            <span className="muted small">Organization slug</span>
            <strong>{organization.organization_slug}</strong>
          </div>

          <div>
            <span className="muted small">Your role</span>
            <strong>{organization.member_role}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}