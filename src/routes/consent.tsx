import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { ConsentText } from "@/components/consent/ConsentText";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Participation consent form — KABU SlotIn" },
      {
        name: "description",
        content:
          "Read the KABUSlotIn participation consent form: what data is collected, why, where it is processed and your rights.",
      },
      { property: "og:title", content: "Participation consent form — KABU SlotIn" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Link to="/" aria-label="KABU SlotIn home">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <ConsentText />
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          You give or withdraw consent inside the app after you sign in.
        </p>
      </main>
    </div>
  );
}
