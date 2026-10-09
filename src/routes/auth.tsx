import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { identifierToEmail, GENERIC_AUTH_ERROR } from "@/lib/kabuslotin";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — KABU SlotIn" },
      {
        name: "description",
        content:
          "Sign in to KABU SlotIn with your School of Law registration number or your Kabarak University staff email.",
      },
      { property: "og:title", content: "Sign in — KABU SlotIn" },
      {
        property: "og:description",
        content: "Secure access for students, lecturers, the Dean, administration and IT support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function Notice({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground"
          : "rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-foreground"
      }
    >
      {children}
    </p>
  );
}

function AuthPage() {
  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-[1fr_1.05fr]">
      <div className="absolute right-5 top-5 z-10"><ThemeToggle /></div>
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div aria-hidden className="absolute inset-0" style={{ background: "var(--gradient-brand)" }} />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2 text-on-brand/90">
            <ArrowLeft className="size-4" />
            <span className="text-sm">Back to home</span>
          </Link>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-on-brand">
            One account, the right view of the School of Law.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-on-brand/85">
            Students book with their registration number. Staff use their Kabarak email.
          </p>
        </div>
        <p className="relative text-xs text-on-brand/75">
          KABU SlotIn · Kabarak University School of Law
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-block lg:hidden">
            <Logo />
          </Link>

          <SignIn />
        </div>
      </main>
    </div>
  );
}

function SignIn() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || password.length < 8) {
      setError(GENERIC_AUTH_ERROR);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const email = identifierToEmail(identifier);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !data.user) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }
      await navigate({ to: "/dashboard" });
    } catch {
      setError(GENERIC_AUTH_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign in to see your appointments and availability.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Registration number or staff email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="LAW/M/1178/05/26 or name@kabarak.ac.ke"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-secondary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </section>
  );
}