import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  ShieldCheck,
  Clock3,
  GraduationCap,
  Gavel,
  Settings2,
  LifeBuoy,
  Lock,
  KeyRound,
  FileClock,
  CheckCircle2,
} from "lucide-react";

import heroImage from "@/assets/hero-campus.jpg";
import { Logo } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KABUSLotIn — Appointments for Kabarak School of Law" },
      {
        name: "description",
        content:
          "Book, approve and track lecturer appointments at Kabarak University School of Law. Timetable-aware slots, role-based access and a full activity trail.",
      },
      { property: "og:title", content: "KABUSLotIn — Appointments for Kabarak School of Law" },
      {
        property: "og:description",
        content:
          "Timetable-aware appointment booking for students, lecturers, the Dean, administration and IT support.",
      },
    ],
  }),
  component: Landing,
});

const roles = [
  {
    icon: GraduationCap,
    name: "Student",
    body: "Sign in with your LAW/ registration number, browse lecturer availability, book an open slot with your reason, and track your own appointments only.",
  },
  {
    icon: CalendarCheck,
    name: "Lecturer",
    body: "Your own calendar from the uploaded timetable, incoming requests with the student's reason, accept, decline, reschedule and add make-up sessions.",
  },
  {
    icon: Gavel,
    name: "Dean",
    body: "A school-wide, view-only picture of schedules, make-up sessions and appointment activity — never the private reason a student wrote.",
  },
  {
    icon: Settings2,
    name: "School Administrator",
    body: "Upload the semester timetable, set the semester start and exam dates, manage the approved staff list and review usage summaries.",
  },
  {
    icon: LifeBuoy,
    name: "IT Support",
    body: "System health, error reports, the technical log and basic account details for resets — with appointment reasons permanently out of reach.",
  },
];

const steps = [
  {
    n: "01",
    title: "Administration uploads the semester",
    body: "Units, year groups, lecturers, teaching days and the three daily blocks — plus the semester start date and exam schedule from week eleven.",
  },
  {
    n: "02",
    title: "Students book inside real availability",
    body: "Only a lecturer's timetabled block, a make-up session or exam-period availability can be booked. Wednesday 11:00–14:00 Chapel is refused outright.",
  },
  {
    n: "03",
    title: "Lecturers decide, everything is logged",
    body: "Accept, decline or reschedule to a day they are actually in school. Every decision is written to an activity log with who and exactly when.",
  },
];

const security = [
  { icon: Lock, title: "Locked at the database", body: "Every table denies by default; rules are enforced in the data layer, not the screen." },
  { icon: KeyRound, title: "Second step for sensitive roles", body: "Administrator and IT Support confirm identity beyond a password at sign-in." },
  { icon: FileClock, title: "Full activity trail", body: "Bookings, timetable uploads, exam dates and credential resets are all recorded." },
  { icon: ShieldCheck, title: "Private reasons stay private", body: "Only the student who wrote it and the staff member it was sent to can read it." },
];

const blocks = ["08:00 – 11:00", "11:00 – 14:00", "14:00 – 17:00"];

function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--gradient-hero)" }}
          />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <CheckCircle2 className="size-3.5" /> Kabarak University · School of Law
              </span>
              <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-brand-ink md:text-6xl">
                Make appointments with your lecturers;
                <span className="text-primary"> make it easier to interact.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                KABUSLotIn turns the semester timetable into bookable time. When a lecturer is
                free, students can request appointments, and the lecturers can answer with a click
                on their dashboard.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild variant="hero" size="lg">
                  <Link to="/auth">Sign in to your account</Link>
                </Button>
                <Button asChild variant="brandOutline" size="lg">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
                {[
                  ["3", "daily blocks"],
                  ["5", "account types"],
                  ["0", "unlogged changes"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-border bg-card px-3 py-3">
                    <dt className="font-display text-2xl font-semibold text-primary">{v}</dt>
                    <dd className="text-xs text-muted-foreground">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative">
              <img
                src={heroImage}
                alt="Students and faculty at the School of Law"
                width={1600}
                height={1104}
                className="w-full rounded-2xl border border-border object-cover shadow-[var(--shadow-lift)]"
              />
              <div className="absolute -bottom-6 left-4 right-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] md:left-8 md:right-auto md:w-72">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Normal teaching time in a day
                </p>
                <ul className="mt-2 space-y-1.5">
                  {blocks.map((b, i) => (
                    <li key={b} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Clock3 className="size-4 text-primary" /> {b}
                      </span>
                      <span
                        className={
                          i === 1
                            ? "rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                            : "rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                        }
                      >
                        {i === 1 ? "Pending" : "Open"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20 md:py-28">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">
            How booking actually works
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Availability is never typed in twice. It is derived from the timetable the school
            already publishes.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <article
                key={s.n}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <span className="font-display text-sm font-semibold text-secondary">{s.n}</span>
                <h3 className="font-display mt-3 text-lg font-semibold text-brand-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            <strong className="font-semibold">Chapel time is protected.</strong> No appointment,
            make-up session or exam can exist on a Wednesday between 11:00 and 14:00 — the attempt
            is refused, not merely flagged.
          </p>
        </section>

        {/* Users */}
        <section id="roles" className="border-y border-border bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-28">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">
              Users
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Each system user can see exactly what they need and nothing beyond, just to keep you
              safe.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((r) => (
                <article
                  key={r.name}
                  className="rounded-2xl border border-border bg-background p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary/12 text-secondary">
                    <r.icon className="size-5" />
                  </span>
                  <h3 className="font-display mt-4 text-lg font-semibold text-brand-ink">
                    {r.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="mx-auto w-full max-w-6xl px-5 py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">
                Security precautions
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nothing is reachable without signing in, sign-in attempts and bookings are rate
                limited, and error messages never reveal whether an account exists.
              </p>
              <Button asChild variant="hero" size="lg" className="mt-7">
                <Link to="/auth">Get started</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {security.map((s) => (
                <div key={s.title} className="rounded-2xl border border-border bg-card p-5">
                  <s.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold text-brand-ink">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <Logo />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Kabarak University School of Law. KABUSLotIn™ is a
            trademark of Kabarak University.
          </p>
        </div>
      </footer>
    </div>
  );
}
