import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GENERIC_AUTH_ERROR } from "@/lib/kabuslotin";

// Limits. Per account is strict; per network address is looser because many students share
// the campus connection.
const LOGIN_ACCOUNT_MAX_FAILURES = 5;
const LOGIN_IP_MAX_FAILURES = 30;
const LOGIN_WINDOW_MINUTES = 15;

const ACTION_ACCOUNT_MAX = 20;
const ACTION_IP_MAX = 200;
const ACTION_WINDOW_MINUTES = 15;

const LOCKED_MESSAGE = "Too many sign-in attempts. Try again in 15 minutes.";

const signInSchema = z.object({
  identifier: z.string().trim().min(3).max(200),
  password: z.string().min(8).max(200),
});

export type SignInResult =
  { ok: true; accessToken: string; refreshToken: string } | { ok: false; error: string };

/**
 * Turns what the user typed into the account's real email address.
 * A staff/student email passes through; a registration number is looked up in profiles so
 * seeded accounts (mmokeira@kabarak.ac.ke etc.) resolve correctly.
 * The derived students.kabarak.ac.ke address is no longer auto-derived —
 * if a reg number has no matching profile, the identifier is used as-is.
 */
async function resolveSignInEmail(identifier: string): Promise<string> {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .ilike("reg_number", value)
    .maybeSingle();
  if (!error && data?.email) return data.email.toLowerCase();

  // No artificial domain derivation — return identifier as-is for sign-in.
  return value;
}

/**
 * Password sign-in with throttling by account and by network address.
 * The password is checked here, on the server, so a failed attempt is always counted and a
 * client cannot claim success to reset its own counter. The error text never says whether the
 * registration number or email belongs to an account, and a lock is applied whether or not it does.
 */
export const signInWithThrottle = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => signInSchema.parse(data))
  .handler(async ({ data }): Promise<SignInResult> => {
    const t = await import("@/lib/auth-throttle.server");

    const email = await resolveSignInEmail(data.identifier);
    const accountKey = t.hashIdentifier(email);
    const ipKey = t.hashIdentifier(t.clientAddress());

    const [accountOpen, ipOpen] = await Promise.all([
      t.isNotLocked("login:account", accountKey),
      t.isNotLocked("login:ip", ipKey),
    ]);
    if (!accountOpen || !ipOpen) return { ok: false, error: LOCKED_MESSAGE };

    const { data: result, error } = await t
      .createAnonClient()
      .auth.signInWithPassword({ email, password: data.password });

    if (error || !result.session) {
      await Promise.all([
        t.recordFailure(
          "login:account",
          accountKey,
          LOGIN_ACCOUNT_MAX_FAILURES,
          LOGIN_WINDOW_MINUTES,
        ),
        t.recordFailure("login:ip", ipKey, LOGIN_IP_MAX_FAILURES, LOGIN_WINDOW_MINUTES),
      ]);
      return { ok: false, error: GENERIC_AUTH_ERROR };
    }

    // Only the account's own counter is cleared. One valid login must not reset the address counter.
    await t.clearFailures("login:account", accountKey);
    return {
      ok: true,
      accessToken: result.session.access_token,
      refreshToken: result.session.refresh_token,
    };
  });

const actionSchema = z.object({ action: z.enum(["booking", "reschedule"]) });

/**
 * Counts one booking or reschedule against the signed-in account and the caller's network address.
 * Returns { allowed: false } once either limit is exceeded. If the limit check itself fails it
 * throws, so an outage blocks the action instead of silently skipping the limit.
 */
export const consumeActionRateLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionSchema.parse(data))
  .handler(async ({ data, context }) => {
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
  });
