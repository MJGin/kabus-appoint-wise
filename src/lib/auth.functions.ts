import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";

// Booking and reschedule limits. Per account is strict; per network address is looser because
// many students share the campus connection.
const ACTION_ACCOUNT_MAX = 20;
const ACTION_IP_MAX = 200;
const ACTION_WINDOW_MINUTES = 15;

const actionSchema = z.object({ action: z.enum(["booking", "reschedule"]) });

/**
 * Counts one booking or reschedule against the signed-in account and the caller's network address.
 * Returns { allowed: false } once either limit is exceeded.
 *
 * If the limiter itself cannot run (for example the server key is not configured), the action is
 * allowed and the problem is logged, so a limiter outage never stops students and lecturers from
 * working. Every access rule is still enforced by the database.
 */
export const consumeActionRateLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const t = await import("@/lib/auth-throttle.server");

      const [account, address] = await Promise.all([
        t.consumeThrottle(
          `${data.action}:account` as const,
          t.hashIdentifier(context.userId),
          ACTION_ACCOUNT_MAX,
          ACTION_WINDOW_MINUTES,
        ),
        t.consumeThrottle(
          `${data.action}:ip` as const,
          t.hashIdentifier(t.clientAddress()),
          ACTION_IP_MAX,
          ACTION_WINDOW_MINUTES,
        ),
      ]);

      return { allowed: account && address };
    } catch (err) {
      console.error("[rate-limit] limiter unavailable, allowing the action:", err);
      return { allowed: true };
    }
  });

function isAuthPlumbingError(e: unknown) {
  const m = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  return /unauthori[sz]ed|invalid token|jwt expired|expired.*token|token.*expired/i.test(m);
}

/**
 * Best-effort action throttle for the dashboards and the offline outbox.
 *
 * The limiter runs as an authenticated server function, and in embedded
 * preview surfaces the attached session can be stale, which used to fail
 * every Book/Accept press with "Invalid token". This helper retries once
 * after a session refresh; if the auth plumbing is still broken it fails
 * OPEN. That is safe: the database itself enforces student-only booking,
 * availability and no double-booking — the counter only stops spam.
 * A genuinely missing session still throws ("Auth session missing").
 */
export async function allowAction(action: "booking" | "reschedule"): Promise<boolean> {
  try {
    return (await consumeActionRateLimit({ data: { action } })).allowed;
  } catch (e) {
    if (!isAuthPlumbingError(e)) throw e;
  }
  try {
    await supabase.auth.refreshSession();
    return (await consumeActionRateLimit({ data: { action } })).allowed;
  } catch (e) {
    if (!isAuthPlumbingError(e)) throw e;
    return true;
  }
}
