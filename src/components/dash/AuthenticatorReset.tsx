import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Empty, Note, Panel, Row } from "@/components/dash/parts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resetAuthenticator } from "@/lib/mfa-reset.functions";

type Account = {
  userId: string;
  role: "administrator" | "it_support" | "dean";
  isMe: boolean;
  fullName: string;
  email: string;
};

/** Runs a server call; if the session token looks stale, refreshes it once and tries again. */
async function withFreshSession<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!/invalid token|jwt|unauthori[sz]ed|expired/i.test(e instanceof Error ? e.message : "")) {
      throw e;
    }
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error("Your sign-in expired. Sign out, sign in again, then retry.");
    }
    return await run();
  }
}

const roleLabel = (r: Account["role"]) =>
  r === "it_support" ? "IT Support" : r === "dean" ? "Dean" : "Administrator";

/**
 * Lost-phone recovery for the other special account. Shown to the Administrator and to IT
 * Support. The server decides who may reset whom; this panel only asks.
 */
export function AuthenticatorReset() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Account | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const accounts = useQuery({
    queryKey: ["privileged-accounts"],
    queryFn: async (): Promise<Account[]> => {
      // Read straight from the database with the signed-in session. The database only lets the
      // Administrator and IT Support see other accounts' roles, so no one else gets a list.
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["administrator", "it_support", "dean"]);
      if (error) throw new Error(error.message);
      const others = roles ?? [];
      if (!others.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in(
          "id",
          others.map((r) => r.user_id),
        );
      return others.map((r) => {
        const p = profiles?.find((x) => x.id === r.user_id);
        return {
          userId: r.user_id,
          role: r.role as Account["role"],
          isMe: r.user_id === me,
          fullName: p?.full_name ?? "",
          email: p?.email ?? "",
        };
      });
    },
  });

  const reset = useMutation({
    mutationFn: (a: Account) =>
      withFreshSession(() => resetAuthenticator({ data: { userId: a.userId } })),
    onSuccess: (_r, a) => {
      setMessage({
        tone: "info",
        text: `${a.fullName || a.email}'s authenticator was removed. They can now sign in with their password and set up a new one.`,
      });
      void qc.invalidateQueries({ queryKey: ["privileged-accounts"] });
      void qc.invalidateQueries({ queryKey: ["it-log"] });
    },
    onError: (e) =>
      setMessage({
        tone: "error",
        text:
          e instanceof Error && e.message ? e.message : "The reset did not go through. Try again.",
      }),
    onSettled: () => setTarget(null),
  });

  return (
    <Panel
      title="Lost authenticator"
      description="These are the special accounts — Administrator, IT Support and the Dean all confirm a six-digit code at sign-in. If one of them loses their phone, confirm who they are first, then reset their authenticator here. You cannot reset your own."
    >
      {message && <Note tone={message.tone}>{message.text}</Note>}
      <div className={message ? "mt-3" : ""}>
        {accounts.isLoading ? (
          <Empty>Loading…</Empty>
        ) : accounts.isError ? (
          <Empty>
            Could not load the special accounts.{" "}
            {accounts.error instanceof Error && accounts.error.message
              ? `(${accounts.error.message.replace(/^Unauthorized:\s*/, "")})`
              : ""}{" "}
            Refresh the page; if it keeps happening, sign out and back in.
          </Empty>
        ) : !accounts.data?.length ? (
          <Empty>No special accounts found.</Empty>
        ) : (
          <ul className="space-y-2">
            {accounts.data.map((a) => (
              <Row key={a.userId}>
                <span>
                  <strong className="text-brand-ink">{a.fullName || "Unnamed"}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {roleLabel(a.role)} · {a.email}
                  </span>
                </span>
                {a.isMe ? (
                  <span className="text-xs text-muted-foreground">This is you</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setTarget(a)}>
                    Reset authenticator
                  </Button>
                )}
              </Row>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this authenticator?</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.fullName || target?.email} ({target && roleLabel(target.role)}) will be able
              to sign in with just their password and set up a new authenticator. Only continue if
              you have confirmed it is really them, for example in person or by phone. The reset is
              recorded in the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reset.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (target) reset.mutate(target);
              }}
            >
              {reset.isPending ? "Resetting…" : "Yes, reset it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
