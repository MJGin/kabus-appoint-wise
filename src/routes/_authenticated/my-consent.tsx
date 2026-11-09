import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { ConsentText } from "@/components/consent/ConsentText";
import { WithdrawConsentButton } from "@/components/consent/WithdrawConsentButton";
import { hasCurrentConsent, useMyConsent } from "@/lib/consent";
import { formatMoment } from "@/lib/kabuslotin";

export const Route = createFileRoute("/_authenticated/my-consent")({
  head: () => ({ meta: [{ title: "My consent — KABU SlotIn" }] }),
  component: MyConsentPage,
});

const LABEL: Record<string, string> = {
  consent: "You consented",
  decline: "You did not consent",
  withdraw: "You withdrew your consent",
};

function MyConsentPage() {
  const consent = useMyConsent();
  const row = consent.data;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Link to="/dashboard" aria-label="Back to dashboard">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-5 px-5 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
            My consent
          </h1>
          {consent.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : !row ? (
            <p className="mt-3 text-sm text-muted-foreground">
              You have not answered the consent form yet.
            </p>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">
                  {LABEL[row.decision]}
                  {row.decision === "consent" &&
                    !hasCurrentConsent(row) &&
                    " (older version of the form)"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Recorded</dt>
                <dd className="font-medium">{formatMoment(row.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Signed as</dt>
                <dd className="font-medium">{row.full_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email on record</dt>
                <dd className="font-medium">{row.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Participant</dt>
                <dd className="font-medium capitalize">{row.participant_category}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Form version</dt>
                <dd className="font-medium">{row.form_version}</dd>
              </div>
            </dl>
          )}

          {row?.decision === "consent" && (
            <div className="mt-5">
              <WithdrawConsentButton label="Withdraw my consent" />
              <p className="mt-2 text-xs text-muted-foreground">
                Withdrawing takes effect immediately and you can consent again at any time. To have
                your data erased, email the project leader as described in the form below.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <ConsentText />
        </section>
      </main>
    </div>
  );
}
