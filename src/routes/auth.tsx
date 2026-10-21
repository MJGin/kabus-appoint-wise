import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthShell, Notice } from "@/components/auth/AuthShell";
import { SecondStep, type SecondStepStage } from "@/components/auth/SecondStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — KABU SlotIn" },
      {
        name: "description",
        content: "Sign in to KABU SlotIn with your Kabarak University email and password.",
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
  component: SignInPage,
});

/** Turns a Supabase sign-in failure into a message that says what actually went wrong. */
function explainSignInError(error: {
  code?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
}): string {
  if (error.code === "email_not_confirmed") {
    return "Confirm your email first: open the link we sent you, then sign in.";
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a few minutes, then try again.";
  }
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "Could not reach the sign-in service. Check your internet connection and try again.";
  }
  if (error.code === "invalid_credentials" || error.status === 400) {
    return "That email and password do not match. Check them and try again.";
  }
  return "Sign-in failed. Try again in a moment.";
}

function SignInPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondStep, setSecondStep] = useState<SecondStepStage | null>(null);

  async function goToDashboard() {
    qc.clear();
    await navigate({ to: "/dashboard" });
  }

  /**
   * After a successful password sign-in: Administrator, IT Support and the Dean
   * must also confirm an authenticator-app code. Everyone else goes straight in.
   * The role is read from the database.
   */
  async function afterPassword() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("No session after sign-in");

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role;

    if (role !== "administrator" && role !== "it_support" && role !== "dean") {
      await goToDashboard();
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.[0];
    if (verified) {
      setSecondStep({ kind: "verify", factorId: verified.id });
      return;
    }
    // Clear half-finished enrolments so a fresh one can be started.
    for (const f of factors?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data: enrolled, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "KABU SlotIn",
    });
    if (enrolError || !enrolled) throw enrolError ?? new Error("Could not start the second step");
    setSecondStep({
      kind: "enroll",
      factorId: enrolled.id,
      qr: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Clear any stale session first (e.g. one revoked by a password change),
      // so it can never shadow the fresh sign-in below. Local only and best
      // effort: it never blocks the login attempt itself.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* offline or already signed out — safe to continue */
      }
      // Step 1: check the password with Supabase.
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) {
          setError(explainSignInError(signInError));
          return;
        }
      } catch (err) {
        // Not a wrong password: the app could not talk to Supabase at all (for example its
        // connection settings are missing). Say so instead of blaming the password.
        console.error("[sign-in] could not reach Supabase", err);
        setError(
          "The app could not connect to its database. Refresh the page; if it keeps happening, tell IT Support.",
        );
        return;
      }

      // Step 2: the password was right. Load the account and go to the right place.
      try {
        await afterPassword();
      } catch (err) {
        console.error("[sign-in] signed in but could not load the account", err);
        setError(
          "Your password was accepted, but your account could not be loaded. Refresh the page and sign in again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelSecondStep() {
    await supabase.auth.signOut();
    qc.clear();
    setSecondStep(null);
    setPassword("");
  }

  if (secondStep) {
    return (
      <AuthShell>
        <SecondStep stage={secondStep} onDone={goToDashboard} onCancel={cancelSecondStep} />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Use your Kabarak University email and password.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="name@students.kabu.test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-secondary hover:underline"
            >
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

      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to KABU SlotIn?{" "}
        <Link to="/sign-up" className="font-medium text-secondary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
