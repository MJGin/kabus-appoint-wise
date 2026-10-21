import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";

/** One simple centred card used by the sign-in and sign-up pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10 font-sans text-foreground">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <Link to="/" aria-label="KABU SlotIn home">
        <Logo />
      </Link>
      <main className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
        {children}
      </main>
      <p className="mt-6 text-xs text-muted-foreground">
        KABU SlotIn · Kabarak University School of Law
      </p>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
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
