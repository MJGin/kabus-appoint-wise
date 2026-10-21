import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — KABU SlotIn" },
      {
        name: "description",
        content: "Reset your KABU SlotIn School of Law account password.",
      },
      { property: "og:title", content: "Reset your password — KABU SlotIn" },
      {
        property: "og:description",
        content: "Reset your KABU SlotIn School of Law account password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    if (!value.trim()) return;
    await supabase.auth
      .resetPasswordForEmail(value.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      .catch(() => undefined);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 font-sans">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Logo />
        <section className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
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
                value={value}
                onChange={(e) => setValue(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="name@students.kabu.test"
              />
            </div>

            {sent && (
              <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm">
                If that account exists, reset instructions are on their way. For security we never
                confirm whether an account was found.
              </p>
            )}

            <Button type="submit" variant="hero" className="w-full" size="lg">
              Send reset instructions
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
