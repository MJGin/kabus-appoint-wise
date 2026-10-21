import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — KABU SlotIn" },
      {
        name: "description",
        content: "Set a new password for your KABU SlotIn School of Law account.",
      },
      { property: "og:title", content: "Choose a new password — KABU SlotIn" },
      {
        property: "og:description",
        content: "Set a new password for your KABU SlotIn School of Law account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // The email link carries either ?code= (PKCE) or a #access_token&…type=recovery
  // hash. Establish the recovery session from it before the form can be used —
  // without this, saving a password fails and the user is stuck.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const code = new URL(window.location.href).searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setReady(true);
        } else {
          setLinkError("That link is invalid or has expired. Ask for a new reset email and try again.");
        }
      } catch {
        if (active) {
          setLinkError("That link is invalid or has expired. Ask for a new reset email and try again.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setError(null);
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("That link has expired. Ask for a new reset email and try again.");
      return;
    }
    setDone(true);
    // The password change revokes sessions, so drop the now-dead recovery
    // session here and send the user to sign in fresh with the new password.
    try {
      await supabase.auth.signOut();
    } catch {
      /* best effort — the sign-in page starts from scratch anyway */
    }
    setTimeout(() => void navigate({ to: "/auth" }), 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 font-sans">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <Logo />
        <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
            Choose a new password
          </h1>
          {done ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Your password has been changed. Sign in with your new password.
            </p>
          ) : linkError ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                {linkError}
              </p>
              <Button
                type="button"
                variant="hero"
                size="lg"
                className="w-full"
                onClick={() => void navigate({ to: "/forgot-password" })}
              >
                Send a new reset email
              </Button>
            </div>
          ) : !ready ? (
            <p className="mt-6 text-sm text-muted-foreground">Checking your reset link…</p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="pw">New password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Confirm new password</Label>
                <Input
                  id="pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  {error}
                </p>
              )}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
