import { clearOfflineData } from "@/lib/pwa";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AdminDash } from "@/components/dash/AdminDash";
import { DeanDash } from "@/components/dash/DeanDash";
import { ItDash } from "@/components/dash/ItDash";
import { LecturerDash } from "@/components/dash/LecturerDash";
import { StudentDash } from "@/components/dash/StudentDash";
import { Empty, Note } from "@/components/dash/parts";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { hasCurrentConsent, useMyConsent } from "@/lib/consent";
import { Logo } from "@/components/brand/Logo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — KABU SlotIn" },
      {
        name: "description",
        content:
          "Your KABU SlotIn work area: appointments, availability and the records your role is allowed to see.",
      },
      { property: "og:title", content: "Your dashboard — KABU SlotIn" },
      {
        property: "og:description",
        content: "Appointments, availability and records for your role at the School of Law.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const roleNames: Record<string, string> = {
  student: "Student",
  lecturer: "Lecturer",
  dean: "Dean",
  administrator: "School Administrator",
  it_support: "IT Support",
};

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [roleRes, profileRes, aal] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      return {
        id: user.id,
        role: roleRes.data?.role ?? null,
        name: profileRes.data?.full_name ?? "",
        elevated: aal.data?.currentLevel === "aal2",
      };
    },
  });

  const consent = useMyConsent();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await clearOfflineData();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  const role = me.data?.role ?? null;
  const needsSecondStep =
    (role === "administrator" || role === "it_support" || role === "dean") &&
    me.data?.elevated === false;
  // The work area opens only after consent to the current form.
  const consentPending =
    !!role && !needsSecondStep && !consent.isLoading && !hasCurrentConsent(consent.data);
  const open = !needsSecondStep && !consentPending && !consent.isLoading;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl min-w-0 items-center justify-between gap-2 px-4 sm:gap-3 sm:px-5">
          <Link to="/" aria-label="KABU SlotIn home" className="min-w-0 shrink">
            <Logo size={32} />
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {me.data?.name}
              {role ? ` · ${roleNames[role] ?? role}` : ""}
            </span>
            {me.data && !needsSecondStep && <NotificationsBell />}
            <Link
              to="/my-consent"
              className="hidden text-sm text-muted-foreground hover:underline sm:inline"
            >
              My consent
            </Link>
            <ThemeToggle />
            <Button size="sm" variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
          {role ? `${roleNames[role] ?? role} area` : "Your area"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You only ever see what your role is allowed to see.
        </p>

        <div className="mt-6 space-y-5">
          {me.isLoading && <Empty>Loading your area…</Empty>}

          {!me.isLoading && !role && (
            <Note tone="error">
              No role has been set on this account yet. Ask the School Administrator to check the
              approved list.
            </Note>
          )}

          {needsSecondStep && (
            <Note tone="error">
              This account must confirm the second step at sign-in before its area opens. Sign out
              and sign in again to complete it.
            </Note>
          )}

          {consentPending && (
            <ConsentGate
              defaultName={me.data?.name ?? ""}
              previous={consent.data ?? null}
              onSignOut={() => void signOut()}
            />
          )}

          {open && role === "student" && me.data && <StudentDash userId={me.data.id} />}
          {open && role === "lecturer" && me.data && <LecturerDash userId={me.data.id} />}
          {open && role === "dean" && <DeanDash />}
          {open && role === "administrator" && <AdminDash />}
          {open && role === "it_support" && <ItDash />}
        </div>
      </main>
    </div>
  );
}
