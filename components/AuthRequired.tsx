"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthRequiredProps = {
  children: ReactNode;
};

export default function AuthRequired({
  children,
}: AuthRequiredProps) {
  const [authenticated, setAuthenticated] =
    useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setAuthenticated(Boolean(session));
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthenticated(Boolean(session));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (authenticated === null) {
    return (
      <section className="card empty">
        Checking your HUBpool session…
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="card empty">
        <p className="eyebrow">ACCOUNT REQUIRED</p>

        <h2>Sign in to continue</h2>

        <p className="muted">
          HUBpool uses your account to keep your commute,
          organization and carpool connections private.
        </p>

        <div className="actions">
          <Link className="button" href="/auth">
            Sign in or create account
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}