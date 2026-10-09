import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, ShieldCheck, Loader2 } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useFirebaseAuth } from "@/integrations/firebase/hooks";
import { firebaseSignIn, firebaseSignUp, firebaseResetPassword } from "@/integrations/firebase/callable";
import { firebaseSignOut } from "@/integrations/firebase/callable";
import { isDemoAccount } from "@/integrations/firebase/callable";

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

type View = "signin" | "signup" | "forgot";

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
  const { user, loading: authLoading, signIn: firebaseSignInHook, signUp: firebaseSignUpHook, resetPassword: firebaseResetPasswordHook, signOut: firebaseSignOutHook, error: authError, clearError } = useFirebaseAuth();

  // Redirect authenticated users to dashboard
  // Note: We don't redirect here because we need to show the auth page for sign-in/sign-up
  // The dashboard route will handle role-based redirects

  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-[1fr_1.05fr]">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
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

          {view === "signin" && <SignIn onSwitch={setView} />}
          {view === "signup" && <SignUp onSwitch={setView} />}
          {view === "forgot" && <Forgot onSwitch={setView} />}
        </div>
      </main>
    </div>
  );
}

function SignIn({ onSwitch }: { onSwitch: (v: View) => void }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const firebaseSignIn = async (email: string, password: string) => {
    const { firebaseSignIn } = await import("@/integrations/firebase/callable");
    return firebaseSignIn({ email, password });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || password.length < 8) {
      setError("Enter your email and password (at least 8 characters).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await firebaseSignIn(identifier.trim(), password);
      if (!result.success) {
        setError(result.error || "Sign-in failed");
        return;
      }
      // Navigate to dashboard after successful sign-in
      await navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err.message || "Sign-in failed");
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
          <Label htmlFor="identifier">Email</Label>
          <Input
            id="identifier"
            autoComplete="email"
            placeholder="name@kabarak.ac.ke or student@kabarak.ac.ke"
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
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" />
        Administrator and IT Support accounts may require additional verification.
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

  const firebaseSignUp = async (fullName: string, email: string, password: string, role: "student" | "lecturer" | "dean" | "it_support") => {
    const { firebaseSignUp } = await import("@/integrations/firebase/callable");
    return firebaseSignUp({ fullName, email, password, role });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (tab === "student" && !/^LAW\/M\/\d+\/\d{2}\/\d{2}$/i.test(reg.trim())) {
      setError(
        "Use the School of Law format LAW/M/REG NO/MONTH/YEAR, e.g. LAW/M/1178/05/26.",
      );
      return;
    }
    if (tab === "staff" && !email.trim().endsWith("@kabarak.ac.ke")) {
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
      const role = isStudent ? "student" : "lecturer";
      const signUpEmail = isStudent ? reg.trim().toUpperCase() : email.trim().toLowerCase();

      const { firebaseSignUp } = await import("@/integrations/firebase/callable");
      const result = await firebaseSignUp(fullName.trim(), signUpEmail, password, isStudent ? "student" : "lecturer");

      if (!result.success) {
        setError(result.error || "Account creation failed");
        return;
      }
      if (!result.data?.user) {
        setInfo("Check your email to confirm the account, then sign in.");
        return;
      }
      await navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err.message || "The account could not be created. Try again.");
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
        Students register with their registration number. Staff use their university email.
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
              placeholder="LAW/M/1178/05/26"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Format: LAW/M/REG NO/MONTH/YEAR</p>
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
              Any @kabarak.ac.ke email can register as staff (lecturer, dean, or IT support).
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

  const firebaseResetPassword = async (email: string) => {
    const { firebaseResetPassword } = await import("@/integrations/firebase/callable");
    return firebaseResetPassword({ email });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    if (!value.trim()) return;
    try {
      const { firebaseResetPassword } = await import("@/integrations/firebase/callable");
      await firebaseResetPassword(value);
    } catch {
      // Silently handle - don't reveal if account exists
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)] lg:mt-0">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter the email on your account and we'll send reset instructions.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="recover">Email</Label>
          <Input
            id="recover"
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="name@kabarak.ac.ke"
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