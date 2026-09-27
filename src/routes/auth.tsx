import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { checkSignInAllowed, recordSignInResult } from "@/lib/auth.functions";
import {
  GENERIC_AUTH_ERROR,
  REG_PATTERN,
  STAFF_EMAIL,
  identifierToEmail,
  regToEmail,
} from "@/lib/kabuslotin";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — KABUSLotIn" },
      {
        name: "description",
        content:
          "Sign in to KABUSLotIn with your School of Law registration number or your Kabarak University staff email.",
      },
      { property: "og:title", content: "Sign in — KABUSLotIn" },
      {
        property: "og:description",
        content: "Secure access for students, lecturers, the Dean, administration and IT support.",
      },
    ],
  }),
  component: AuthPage,
});

type View = "signin" | "signup" | "forgot" | "second-step";

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
  const [view, setView] = useState<View>("signin");

  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div aria-hidden className="absolute inset-0" style={{ background: "var(--gradient-brand)" }} />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2 text-primary-foreground/90">
            <ArrowLeft className="size-4" />
            <span className="text-sm">Back to home</span>
          </Link>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-primary-foreground">
            One account, the right view of the School of Law.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/85">
            Students book with their registration number. Staff use their Kabarak email. Sensitive
            roles confirm a second step at sign-in.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/75">
          KABUSLotIn · Kabarak University School of Law
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-block lg:hidden">
            <Logo />
          </Link>

          {view === "signin" && <SignIn onSwitch={setView} />}
          {view === "signup" && <SignUp onSwitch={setView} />}
          {view === "forgot" && <Forgot onSwitch={setView} />}
          {view === "second-step" && <SecondStep />}
        </div>
      </main>
    </div>
  );
}

async function needsSecondStep(userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "administrator" || data?.role === "it_support";
}

function SignIn({ onSwitch }: { onSwitch: (v: View) => void }) {
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
      const allowed = await checkSignInAllowed({ data: { identifier: identifier.trim() } });
      if (!allowed.allowed) {
        setError("Too many attempts. Try again in a few minutes.");
        return;
      }
      const email = identifierToEmail(identifier);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      await recordSignInResult({
        data: { identifier: identifier.trim(), succeeded: !signInError },
      });
      if (signInError || !data.user) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }
      if (await needsSecondStep(data.user.id)) {
        onSwitch("second-step");
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
            placeholder="LAW/1234/2024 or name@kabarak.ac.ke"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => onSwitch("forgot")}
              className="text-xs font-medium text-secondary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy ? "Checking…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" />
        Administrator and IT Support accounts are asked for a second step after this.
      </p>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        New here?{" "}
        <button
          type="button"
          onClick={() => onSwitch("signup")}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </button>
      </p>
    </section>
  );
}

function SecondStep() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setEnrolling(false);
      } else {
        const unverified = factors?.totp?.find((f) => String(f.status) !== "verified");
        if (unverified) await supabase.auth.mfa.unenroll({ factorId: unverified.id });
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `KABUSLotIn ${Date.now()}`,
        });
        if (enrollError || !data) throw enrollError ?? new Error("enroll");
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setEnrolling(true);
      }
      setStarted(true);
    } catch {
      setError("The second step could not be started. Try signing in again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) throw challengeError ?? new Error("challenge");
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError("That code was not accepted.");
        return;
      }
      await navigate({ to: "/dashboard" });
    } catch {
      setError("That code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        One more step
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        This account confirms its identity with a six-digit code from an authenticator app.
      </p>

      {!started ? (
        <Button className="mt-6 w-full" variant="hero" size="lg" onClick={begin} disabled={busy}>
          {busy ? "Preparing…" : "Continue"}
        </Button>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={verify}>
          {enrolling && qr && (
            <div className="rounded-xl border border-border bg-background p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Scan this once with your authenticator app, then enter the code it shows.
              </p>
              <img src={qr} alt="Set-up code" className="mx-auto mt-3 size-44" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="otp">Six-digit code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Confirm and continue"}
          </Button>
        </form>
      )}
      {!started && error && <div className="mt-4">{<Notice tone="error">{error}</Notice>}</div>}
    </section>
  );
}

function SignUp({ onSwitch }: { onSwitch: (v: View) => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("student");
  const [fullName, setFullName] = useState("");
  const [reg, setReg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (tab === "student" && !REG_PATTERN.test(reg.trim())) {
      setError('Registration numbers for the School of Law must start with "LAW/".');
      return;
    }
    if (tab === "staff" && !STAFF_EMAIL.test(email.trim())) {
      setError("Use your university email ending in @kabarak.ac.ke.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const isStudent = tab === "student";
      const signUpEmail = isStudent ? regToEmail(reg) : email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signUpEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName.trim(),
            reg_number: isStudent ? reg.trim().toUpperCase() : null,
            requested_role: isStudent ? "student" : "staff",
          },
        },
      });
      if (signUpError) {
        setError(
          /approved|allow|not permitted|Database error/i.test(signUpError.message)
            ? "This account cannot be created. Staff accounts only work for emails the Administrator has approved."
            : signUpError.message,
        );
        return;
      }
      if (!data.session) {
        setInfo("Check your email to confirm the account, then sign in.");
        return;
      }
      await navigate({ to: "/dashboard" });
    } catch {
      setError("The account could not be created. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Students register themselves. Staff accounts only work for emails the Administrator has
        already approved.
      </p>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Chebet"
            />
          </div>

          <TabsContent value="student" className="m-0 space-y-1.5">
            <Label htmlFor="reg">Registration number</Label>
            <Input
              id="reg"
              placeholder="LAW/1234/2024"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Must begin with LAW/</p>
          </TabsContent>

          <TabsContent value="staff" className="m-0 space-y-1.5">
            <Label htmlFor="email">University email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@kabarak.ac.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lecturer, Dean and IT Support accounts must already appear on the approved list.
            </p>
          </TabsContent>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="info">{info}</Notice>}

          <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
      </Tabs>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <button
          type="button"
          onClick={() => onSwitch("signin")}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </button>
      </p>
    </section>
  );
}

function Forgot({ onSwitch }: { onSwitch: (v: View) => void }) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    if (!value.trim()) return;
    await supabase.auth
      .resetPasswordForEmail(identifierToEmail(value), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      .catch(() => undefined);
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter the registration number or staff email on your account and we'll send reset
        instructions.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="recover">Registration number or staff email</Label>
          <Input
            id="recover"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="LAW/1234/2024 or name@kabarak.ac.ke"
          />
        </div>

        {sent && (
          <Notice tone="info">
            If that account exists, reset instructions are on their way. For security we never
            confirm whether an account was found.
          </Notice>
        )}

        <Button type="submit" variant="hero" className="w-full" size="lg">
          <Mail className="size-4" /> Send reset instructions
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => onSwitch("signin")}
          className="font-medium text-primary hover:underline"
        >
          Back to sign in
        </button>
      </p>
    </section>
  );
}
