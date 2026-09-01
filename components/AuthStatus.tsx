"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { signOutLiveUser } from "@/lib/live-store";

export default function AuthStatus() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!configured) {
      setLoaded(true);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    async function loadSession() {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      setLoaded(true);
    }
    void loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setEmail(session?.user.email ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [configured]);

  async function signOut() {
    await signOutLiveUser();
    setEmail(null);
    router.push("/");
    router.refresh();
  }

  if (!loaded) return <span className="modePill">Connecting…</span>;
  if (!configured) return <span className="modePill modeDemo">Demo mode</span>;
  if (!email) return <Link className="navAuthLink" href="/auth">Sign in</Link>;

  return (
    <div className="authStatus">
      <span className="modePill modeLive">Live</span>
      <span className="authEmail">{email}</span>
      <button className="navAuthButton" type="button" onClick={signOut}>Sign out</button>
    </div>
  );
}
