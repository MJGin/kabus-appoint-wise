import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { signInWithThrottle } from "@/lib/auth.functions";
import { GENERIC_AUTH_ERROR, REG_PATTERN, STAFF_EMAIL, regToEmail } from "@/lib/kabuslotin";

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

const MIN_PASSWORD = 10;

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "var(--gradient-brand)" }}
        />
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

          <AuthFlow />
        </div>
      </main>
    </div>
  );
}

type Stage =
  | { kind: "credentials" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string };

function AuthFlow() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>({ kind: "credentials" });

  /**
   * Runs once a real session exists. Administrator and IT Support must also pass a second step
   * (authenticator-app code) before the dashboard opens; everyone else goes straight in.
   */
  async function afterSignIn() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("No session");

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role;

    if (role === "administrator" || role === "it_support") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.[0];
      if (verified) {
        setStage({ kind: "verify", factorId: verified.id });
        return;
      }
      // Clear half-finished enrolments so a fresh one can be started.
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "KABU SlotIn",
      });
      if (error || !enrolled) throw error ?? new Error("Could not start the second step");
      setStage({
        kind: "enroll",
        factorId: enrolled.id,
        qr: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
      return;
    }

    qc.clear();
    await navigate({ to: "/dashboard" });
  }

  async function cancelToSignIn() {
    await supabase.auth.signOut();
    qc.clear();
    setStage({ kind: "credentials" });
  }

  async function secondStepDone() {
    qc.clear();
    await navigate({ to: "/dashboard" });
  }

  if (stage.kind === "credentials") return <Credentials onSignedIn={afterSignIn} />;
  return <SecondStep stage={stage} onDone={secondStepDone} onCancel={cancelToSignIn} />;
}

function Credentials({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      {mode === "signin" ? <SignIn onSignedIn={onSignedIn} /> : <SignUp onSignedIn={onSignedIn} />}
      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New to KABU SlotIn?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-secondary hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </section>
  );
}

function SignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
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
      const result = await signInWithThrottle({ data: { identifier, password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (sessionError) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }
      await onSignedIn();
    } catch {
      setError(GENERIC_AUTH_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
    </>
  );
}

type StaffRole = "lecturer" | "dean" | "it_support";

function SignUp({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [kind, setKind] = useState<"student" | "staff">("student");
  const [fullName, setFullName] = useState("");
  const [reg, setReg] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("lecturer");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);

    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (kind === "student" && !REG_PATTERN.test(reg.trim())) {
      return setError("Use your School of Law registration number, for example LAW/M/1178/05/26.");
    }
    if (kind === "staff" && !STAFF_EMAIL.test(staffEmail.trim())) {
      return setError("Staff accounts need a university email ending in @kabarak.ac.ke.");
    }
    if (password.length < MIN_PASSWORD) {
      return setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirm) return setError("The two passwords do not match.");

    setError(null);
    setBusy(true);
    try {
      const email = kind === "student" ? regToEmail(reg) : staffEmail.trim().toLowerCase();
      const data =
        kind === "student"
          ? { role: "student", full_name: fullName.trim(), reg_number: reg.trim().toUpperCase() }
          : { role: staffRole, full_name: fullName.trim() };

      const { data: created, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (signUpError) {
        setError(
          kind === "staff"
            ? "We could not create that account. Check your details, and make sure the School Administrator has approved your email."
            : "We could not create that account. Check your registration number and try again.",
        );
        return;
      }
      if (created.session) {
        await onSignedIn();
        return;
      }
      setInfo(
        "Account created. If a confirmation email was sent, open the link in it, then sign in.",
      );
    } catch {
      setError("We could not create that account. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Students use their registration number. Staff need an email the School Administrator has
        approved. Administrator accounts cannot be created here.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="kind">I am a</Label>
          <select
            id="kind"
            className={fieldClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as "student" | "staff")}
          >
            <option value="student">Student</option>
            <option value="staff">Staff member</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="full-name">Full name</Label>
          <Input
            id="full-name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        {kind === "student" ? (
          <div className="space-y-1.5">
            <Label htmlFor="reg">Registration number</Label>
            <Input
              id="reg"
              autoComplete="username"
              placeholder="LAW/M/1178/05/26"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Account type</Label>
              <select
                id="staff-role"
                className={fieldClass}
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
              >
                <option value="lecturer">Lecturer</option>
                <option value="dean">Dean</option>
                <option value="it_support">IT Support</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">University email</Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="username"
                placeholder="name@kabarak.ac.ke"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="new-password">Password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {info && <Notice tone="info">{info}</Notice>}

        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </>
  );
}

function SecondStep({
  stage,
  onDone,
  onCancel,
}: {
  stage: Extract<Stage, { kind: "enroll" | "verify" }>;
  onDone: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: stage.factorId });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: stage.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) {
        setError("That code was not accepted. Check it and try again.");
        return;
      }
      await onDone();
    } catch {
      setError("That code was not accepted. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <div className="flex items-center gap-2 text-brand-ink">
        <ShieldCheck className="size-5 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-semibold tracking-tight">Second step</h1>
      </div>

      {stage.kind === "enroll" ? (
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            This account needs a second step at every sign-in. Scan the code with an authenticator
            app (Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit code
            it shows.
          </p>
          <img
            src={stage.qr}
            alt="Authenticator app setup code"
            className="mx-auto size-44 rounded-lg border border-border bg-white p-2"
          />
          <p>
            Cannot scan? Enter this key in the app instead:{" "}
            <code className="break-all rounded bg-muted px-1.5 py-0.5 text-foreground">
              {stage.secret}
            </code>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">6-digit code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy ? "Checking…" : stage.kind === "enroll" ? "Turn on and continue" : "Continue"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:underline"
          onClick={() => void onCancel()}
        >
          Cancel and sign out
        </button>
      </form>
    </section>
  );
}
