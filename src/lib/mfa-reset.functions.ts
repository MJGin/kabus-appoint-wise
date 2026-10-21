import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lost-phone recovery for the accounts that need an authenticator (Administrator, IT Support and
 * the Dean). One of them, fully signed in with the second step, can clear another's authenticator
 * after confirming who they are. The person then signs in with their password and sets up a new
 * authenticator. Every reset is written to the activity log.
 *
 * Rules enforced here, on the server, regardless of what the browser sends:
 * - the caller must be an Administrator or IT Support signed in with the second step (aal2);
 * - the target must also be a privileged account (Administrator, IT Support or Dean);
 * - nobody can reset their own authenticator (a stolen password must not be enough).
 */

const PRIVILEGED = ["administrator", "it_support", "dean"] as const;
type Privileged = (typeof PRIVILEGED)[number];
const isPrivileged = (role: string | null | undefined): role is Privileged =>
  role === "administrator" || role === "it_support" || role === "dean";

type Ctx = {
  userId: string;
  claims: unknown;
  supabase: {
    from: (t: "user_roles") => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { role: string } | null }> };
      };
    };
  };
};

async function requirePrivilegedCaller(context: Ctx) {
  const aal = (context.claims as { aal?: string } | null)?.aal;
  if (aal !== "aal2") throw new Error("Finish the second step before doing this.");
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!isPrivileged(data?.role))
    throw new Error("Only the Administrator or IT Support can do this.");
}

const resetSchema = z.object({ userId: z.string().uuid() });

/** Clears every authenticator of one privileged account (Administrator, IT Support or Dean). */
export const resetAuthenticator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requirePrivilegedCaller(context as unknown as Ctx);
    if (data.userId === context.userId) {
      throw new Error("You cannot reset your own authenticator. Ask the other special account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!isPrivileged(target?.role)) {
      throw new Error(
        "That account does not use an authenticator. Only Administrator, IT Support and Dean accounts can be reset.",
      );
    }

    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: data.userId,
    });
    if (listError) throw new Error("Could not read that account's authenticator.");

    let removed = 0;
    for (const factor of listed?.factors ?? []) {
      const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: data.userId,
      });
      if (error) throw new Error("Could not remove the authenticator. Nothing else was changed.");
      removed += 1;
    }

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      action: "authenticator_reset",
      entity_type: "account",
      entity_id: data.userId,
      category: "credential",
      details: { removed },
    });

    return { removed };
  });
