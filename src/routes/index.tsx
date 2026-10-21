import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
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
} from "lucide-react";

import heroImage from "@/assets/kabarak-law-hero.jpg";
import { Logo } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { ScrollFade } from "@/components/brand/ScrollFade";
import { resetCookieConsent } from "@/components/brand/CookieConsent";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KABU SlotIn — Kabarak University School of Law Appointments" },
      {
        name: "description",
        content:
          "Book, approve and track lecturer appointments at Kabarak University School of Law. Timetable-aware slots, role-based access and a full activity trail.",
      },
      { property: "og:title", content: "KABU SlotIn — Kabarak University School of Law Appointments" },
      {
        property: "og:description",
        content:
          "Timetable-aware appointment booking for students, lecturers, the Dean, administration and IT support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const roles = [
  {
    icon: GraduationCap,
    name: "Student",
    body: "Sign in with your university email, pick a lecturer and see their week: green is real availability, red is not. Tap a green time, choose your own start and length — 15 minutes up to 3 hours — write a private reason and book. Requests you save while offline send themselves when you're back online.",
  },
  {
    icon: CalendarCheck,
    name: "Lecturer",
    body: "See every incoming request with the student's name and reason, accept, decline or move it to a date you are actually in school, add make-up sessions beyond your timetable, and keep your profile — photo, office, About — current, because it is what students see when booking.",
  },
  {
    icon: Gavel,
    name: "Dean",
    body: "A school-wide, read-only picture: the timetable calendar, every lecturer's teaching schedules, make-up sessions, and appointment activity with times and outcomes only — the private reasons students write are never shown to oversight.",
  },
  {
    icon: Settings2,
    name: "School Administrator",
    body: "Approves staff and student emails by name, mints logins for them, sets semester and exam dates, uploads the teaching timetable unit by unit with day and block, books exam slots with venues, switches the active semester and reviews usage summaries — plus recovering a lost authenticator.",
  },
  {
    icon: LifeBuoy,
    name: "IT Support",
    body: "A service dashboard: error reports to resolve, the technical log, system-health counters (open errors, locked sign-ins, accounts) and the basic account list needed to help with password resets — with appointment reasons permanently out of reach.",
  },
];

const steps = [
  {
    n: "01",
    title: "The school publishes the semester",
    body: "The Administrator approves staff and student emails, sets the semester and exam dates, and uploads the teaching timetable — each unit with its teaching day and one of the three daily blocks. Availability then exists in the database, not in anybody's memory.",
  },
  {
    n: "02",
    title: "Students tap a green time",
    body: "Green means exactly the lecturer's timetabled window that day — plus any make-up or exam time they added; red means not available. Two taps choose how long (15 minutes to 3 hours) and when it starts; a private reason goes to the lecturer alone.",
  },
  {
    n: "03",
    title: "Lecturers decide, everything is logged",
    body: "Accept, decline, or reschedule to another day and period; the student sees the answer on their dashboard and in the notification bell. Offline decisions send when you reconnect. Oversight sees times and outcomes only — reasons stay between student and lecturer.",
  },
];

const security = [
  { icon: Lock, title: "Locked at the database", body: "Every table denies by default; rules are enforced in the data layer, not the screen." },
  { icon: KeyRound, title: "Second step for sensitive roles", body: "Administrator, IT Support and the Dean confirm a six-digit code from their authenticator app at sign-in — a password alone never opens those areas." },
  { icon: FileClock, title: "Full activity trail", body: "Bookings, timetable uploads, exam dates and credential resets are all recorded." },
  { icon: ShieldCheck, title: "Private reasons stay private", body: "Only the student who wrote it and the staff member it was sent to can read it." },
];

const blocks = ["08:00 – 11:00", "11:00 – 14:00", "14:00 – 17:00"];

function Landing() {
  // Password-reset (and similar) links sometimes land on "/" instead of their
  // page when the dashboard's redirect list falls back to the Site URL. The
  // address still carries the token, so forward it to /reset-password intact.
  useEffect(() => {
    const { search, hash } = window.location;
    const isRecovery =
      /(^|[&#])type=recovery([&#]|$)/.test(hash) ||
      /(^|[&#])type=recovery([&#]|$)/.test(search) ||
      /[?&]code=/.test(search);
    if (isRecovery) {
      window.location.replace(`/reset-password${search}${hash}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />

      <ScrollFade>
      <main>
        {/* Hero — full-width campus banner. Branding stays in the photo; no overlay copy. */}
        <section className="relative overflow-hidden">
          <img
            src={heroImage}
            alt="Kabarak University School of Law campus"
            width={1376}
            height={768}
            className="scroll-fade-item h-auto max-h-[75vh] w-full object-cover object-center"
            fetchPriority="high"
          />

          {/* Messaging sits below the banner, not on it */}
          <div className="border-b border-border bg-card/80">
            <div className="mx-auto w-full max-w-6xl px-5 py-12 md:py-16">
              <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
                <div>
                  <h1 className="scroll-fade-item font-display max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-brand-ink md:text-5xl">
                    Make appointments with your lecturers;
                    <span className="text-primary"> make it easier to interact.</span>
                  </h1>
                  <p data-stagger="1" className="scroll-fade-item mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                    KABU SlotIn turns the semester timetable into bookable time: students tap a
                    lecturer's green window, choose how long they need and why, and the lecturer
                    answers from their own dashboard.
                  </p>
                  <div data-stagger="2" className="scroll-fade-item mt-8 flex flex-wrap items-center gap-3">
                    <Button asChild variant="hero" size="lg">
                      <Link to="/auth">Sign in to your account</Link>
                    </Button>
                    <Button asChild variant="brandOutline" size="lg">
                      <a href="#how">See how it works</a>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <dl className="grid grid-cols-3 gap-3">
                    {[
                      ["3", "daily blocks"],
                      ["5", "account types"],
                      ["0", "unlogged changes"],
                    ].map(([v, l], index) => (
                      <div key={l} data-stagger={String(index)} className="scroll-fade-item rounded-xl border border-border bg-background px-3 py-3">
                        <dt className="font-display text-2xl font-semibold text-primary">{v}</dt>
                        <dd className="text-xs text-muted-foreground">{l}</dd>
                      </div>
                    ))}
                  </dl>
                  <div data-stagger="3" className="scroll-fade-item rounded-xl border border-border bg-background p-4">
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
                            {i === 1 ? "Chapel" : "Open"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20 md:py-28">
          <h2 className="scroll-fade-item font-display text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">
            How booking actually works
          </h2>
          <p data-stagger="1" className="scroll-fade-item mt-3 max-w-2xl text-muted-foreground">
            Availability is never typed in twice. It is derived from the timetable the school
            already publishes.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((s, index) => (
              <article
                key={s.n}
                data-stagger={String(index)}
                className="scroll-fade-item rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <span className="font-display text-sm font-semibold text-secondary">{s.n}</span>
                <h3 className="font-display mt-3 text-lg font-semibold text-brand-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </div>
          <p className="scroll-fade-item mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            <strong className="font-semibold">Chapel time is protected.</strong> No appointment,
            make-up session or exam can exist on a Wednesday between 11:00 and 14:00 — the attempt
            is refused, not merely flagged.
          </p>
        </section>

        {/* Users */}
        <section id="roles" className="border-y border-border bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-28">
            <h2 className="scroll-fade-item font-display text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">
              Users
            </h2>
            <p data-stagger="1" className="scroll-fade-item mt-3 max-w-2xl text-muted-foreground">
              Each system user can see exactly what they need and nothing beyond, just to keep you
              safe.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((r, index) => (
                <article
                  key={r.name}
                  data-stagger={String(index % 3)}
                  className="scroll-fade-item rounded-2xl border border-border bg-background p-6 transition-shadow hover:shadow-[var(--shadow-soft)]"
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
              <h2 className="scroll-fade-item font-display text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">
                Security precautions
              </h2>
              <p data-stagger="1" className="scroll-fade-item mt-4 text-muted-foreground">
                Nothing is reachable without signing in, sign-in attempts and bookings are rate
                limited, and error messages never reveal whether an account exists.
              </p>
              <div data-stagger="2" className="scroll-fade-item mt-7">
                <Button asChild variant="hero" size="lg">
                  <Link to="/auth">Get started</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {security.map((s, index) => (
                <div key={s.title} data-stagger={String(index % 2)} className="scroll-fade-item rounded-2xl border border-border bg-card p-5">
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
          <div className="flex flex-col gap-2 md:items-end">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Kabarak University School of Law. KABU SlotIn is built for
              the School of Law community.{" "}
              <Link to="/consent" className="font-medium text-secondary hover:underline">
                Consent form
              </Link>
            </p>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline md:text-right"
              onClick={() => resetCookieConsent()}
            >
              Cookie settings
            </button>
          </div>
        </div>
      </footer>
      </ScrollFade>
    </div>
  );
}
