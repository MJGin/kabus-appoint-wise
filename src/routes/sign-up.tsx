import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthShell, Notice } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Create an account — KABU SlotIn" },
      {
        name: "description",
        content: "Students join instantly. Teaching logins need the School Administrator's approval.",
      },
      { property: "og:title", content: "Create an account — KABU SlotIn" },
      {
        property: "og:description",
        content: "Students join instantly. Teaching logins need the School Administrator's approval.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignUpPage,
});

const MIN_PASSWORD = 8;

type Kind = "student" | "teacher";

function SignUpPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);

    if (kind === "teacher") {
      // Teacher: no account is made. Send an application to the Administrator.
      if (fullName.trim().length < 2) return setError("Enter your full name.");
      if (!email.trim()) return setError("Enter your email.");
      setError(null);
      setBusy(true);
      try {
        const { error: reqError } = await supabase.from("teacher_requests").insert({
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
        });
        if (reqError) {
          setError(
            /duplicate|unique|already/i.test(reqError.message)
              ? "An application for this email was already sent."
              : "Could not send the application. Try again in a moment.",
          );
          return;
        }
        setInfo(
          "Application sent. The School Administrator approves teaching logins; once approved you will be given the starting password and can change it after signing in.",
        );
        resetForm();
        return;
      } catch {
        setError("The app could not connect to its database. Refresh the page and try again.");
        return;
      } finally {
        setBusy(false);
      }
    }

    // Student: account is created on the spot, with the name they typed.
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!email.trim()) return setError("Enter your email.");
    if (password.length < MIN_PASSWORD) {
      return setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirm) return setError("The two passwords do not match.");

    setError(null);
    setBusy(true);
    try {
      // Only the name and "I am a student" are sent. A staff login can never be
      // claimed this way: the database refuses self sign-ups for staff emails.
      const { data: created, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim(), requested_role: "student" },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(
          signUpError.status === 429
            ? "Too many attempts. Wait a few minutes, then try again."
            : /registered|already|exists/i.test(signUpError.message)
              ? "That email already has an account. Sign in instead, or use Forgot password."
              : "We could not create that account. Try again in a moment.",
        );
        return;
      }
      if (created.session) {
        await navigate({ to: "/dashboard" });
        return;
      }
      setInfo(
        "Account created. If a confirmation email was sent, open the link in it, then sign in.",
      );
    } catch {
      setError("The app could not connect to its database. Refresh the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  const isTeacher = kind === "teacher";

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Students join right away. Teaching logins need the School Administrator's approval.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2" role="tablist" aria-label="I am a">
        <Button
          type="button"
          variant={isTeacher ? "brandOutline" : "brand"}
          className="justify-center"
          onClick={() => {
            setKind("student");
            resetForm();
            setError(null);
            setInfo(null);
          }}
        >
          Student
        </Button>
        <Button
          type="button"
          variant={isTeacher ? "brand" : "brandOutline"}
          className="justify-center"
          onClick={() => {
            setKind("teacher");
            resetForm();
            setError(null);
            setInfo(null);
          }}
        >
          Teacher
        </Button>
      </div>

      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="full-name">Full name</Label>
          <Input
            id="full-name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="username"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {!isTeacher && (
          <>
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
          </>
        )}

        {isTeacher && (
          <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-muted-foreground">
            No password here: once the Administrator approves your application, their
            <b> Create login</b> button makes your account and you will be given the
            starting password to sign in with.
          </p>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {info && <Notice tone="info">{info}</Notice>}

        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy
            ? isTeacher
              ? "Sending application…"
              : "Creating account…"
            : isTeacher
              ? "Apply for a teaching login"
              : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth" className="font-medium text-secondary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
