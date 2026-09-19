import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type View = "signin" | "signup" | "forgot";

const REG_PATTERN = /^LAW\/.+/i;
const STAFF_EMAIL = /@kabarak\.ac\.ke$/i;

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
      {/* Brand panel */}
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
          KABUSLotIn™ · Kabarak University School of Law
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-block lg:hidden">
            <Logo />
          </Link>

          {view === "signin" && <SignIn onSwitch={setView} />}
          {view === "signup" && <SignUp onSwitch={setView} />}
          {view === "forgot" && <Forgot onSwitch={setView} />}
        </div>
      </main>
    </div>
  );
}

function PendingBackendNotice() {
  return (
    <Notice tone="info">
      Accounts are not live yet — the secure database for KABUSLotIn is still being set up. The
      sign-in rules shown here are already in place.
    </Notice>
  );
}

function SignIn({ onSwitch }: { onSwitch: (v: View) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(false);
    if (!identifier.trim() || password.length < 8) {
      setError("Enter your registration number or staff email and your password.");
      return;
    }
    setError(null);
    setSubmitted(true);
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
        {submitted && <PendingBackendNotice />}

        <Button type="submit" variant="hero" className="w-full" size="lg">
          Sign in
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

function SignUp({ onSwitch }: { onSwitch: (v: View) => void }) {
  const [tab, setTab] = useState("student");
  const [reg, setReg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(false);
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
    setSubmitted(true);
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
          {submitted && <PendingBackendNotice />}

          <Button type="submit" variant="hero" className="w-full" size="lg">
            Create account
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

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter the registration number or staff email on your account and we'll send reset
        instructions.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
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
