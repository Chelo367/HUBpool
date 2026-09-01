"use client";

import Link from "next/link";

export default function AuthRequired() {
  return (
    <div className="card empty authRequired">
      <h3>Sign in to the shared pilot</h3>
      <p className="muted">This page uses the live HUBpool database, so you need an account first.</p>
      <Link className="button" href="/auth">Sign in / create account</Link>
    </div>
  );
}
