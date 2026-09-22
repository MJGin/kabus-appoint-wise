import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AdminDash } from "@/components/dash/AdminDash";
import { DeanDash } from "@/components/dash/DeanDash";
import { ItDash } from "@/components/dash/ItDash";
import { LecturerDash } from "@/components/dash/LecturerDash";
import { StudentDash } from "@/components/dash/StudentDash";
import { Empty, Note } from "@/components/dash/parts";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — KABUSLotIn" },
      {
        name: "description",
        content:
          "Your KABUSLotIn work area: appointments, availability and the records your role is allowed to see.",
      },
      { property: "og:title", content: "Your dashboard — KABUSLotIn" },
      {
        property: "og:description",
        content: "Appointments, availability and records for your role at the School of Law.",
      },
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

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  const role = me.data?.role ?? null;
  const needsSecondStep =
    (role === "administrator" || role === "it_support") && me.data?.elevated === false;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link to="/" aria-label="KABUSLotIn home">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {me.data?.name}
              {role ? ` · ${roleNames[role] ?? role}` : ""}
            </span>
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

          {!needsSecondStep && role === "student" && me.data && <StudentDash userId={me.data.id} />}
          {!needsSecondStep && role === "lecturer" && me.data && (
            <LecturerDash userId={me.data.id} />
          )}
          {!needsSecondStep && role === "dean" && <DeanDash />}
          {!needsSecondStep && role === "administrator" && <AdminDash />}
          {!needsSecondStep && role === "it_support" && <ItDash />}
        </div>
      </main>
    </div>
  );
}
