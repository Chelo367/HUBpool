"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace("/onboarding");
    }
    void checkSession();
  }, [configured, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });
        if (error) throw error;

        if (data.session) {
          router.push("/onboarding");
          router.refresh();
        } else {
          setMessage("Account created. Check your email if confirmation is enabled in Supabase.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push("/matches");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main>
        <div className="card authCard">
          <p className="eyebrow">Demo mode</p>
          <h1 className="pageTitle authTitle">Supabase is not connected yet.</h1>
          <p className="lede">Add the two NEXT_PUBLIC_SUPABASE variables to enable real accounts. Until then, the rest of HUBpool continues to work as the browser-only demo.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="authShell">
        <section className="authIntro">
          <p className="eyebrow eyebrowOnDark">HUBpool pilot</p>
          <h1>Real coworkers.<br />One shared HUB.</h1>
          <p className="lede ledeOnDark">Sign in to the shared pilot. Your exact routing origin and phone number remain private.</p>
          <div className="heroPromise">
            <span>Authenticated coworker directory</span>
            <span>Private contact details</span>
            <span>Weekly schedule matching</span>
          </div>
        </section>

        <form className="card authCard" onSubmit={submit}>
          <div className="authTabs">
            <button type="button" className={mode === "signin" ? "authTab authTabActive" : "authTab"} onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button>
            <button type="button" className={mode === "signup" ? "authTab authTabActive" : "authTab"} onClick={() => { setMode("signup"); setMessage(""); }}>Create account</button>
          </div>

          <div>
            <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Join the pilot"}</p>
            <h2>{mode === "signin" ? "Sign in to HUBpool" : "Create your HUBpool account"}</h2>
          </div>

          {mode === "signup" && (
            <div className="field">
              <label htmlFor="displayName">Display name</label>
              <input id="displayName" value={displayName} onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} placeholder="e.g. Mariano" required />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} autoComplete="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" minLength={6} value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
            <span className="help">For the pilot, use at least 6 characters. Supabase handles password storage and authentication.</span>
          </div>

          {message && <div className="notice">{message}</div>}

          <button className="button" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
