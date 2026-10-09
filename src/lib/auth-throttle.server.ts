// Server-only helpers for sign-in and action throttling.
// Import this only from inside server function handlers (dynamic import), never from client code.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

/** One-way hash so raw emails, registration numbers and addresses never sit in the throttle table. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Best-effort network address of the caller, taken from the platform's forwarding headers. */
export function clientAddress(): string {
  const headers = getRequest()?.headers;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("cf-connecting-ip") || headers?.get("x-real-ip") || "unknown";
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/** Anonymous client used only to verify a password on the server. It stores no session. */
export function createAnonClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Sign-in is not configured.");
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** True while the caller is not locked out on this scope. */
export async function isNotLocked(scope: string, identifier: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_auth_throttle", {
    _scope: scope,
    _identifier: identifier,
  });
  if (error) throw new Error("Could not check sign-in limits.");
  return data === true;
}

/** A successful sign-in clears the failure count for that account. */
export async function clearFailures(scope: string, identifier: string) {
  const { error } = await supabaseAdmin.rpc("record_auth_attempt", {
    _scope: scope,
    _identifier: identifier,
    _succeeded: true,
  });
  if (error) throw new Error("Could not record the sign-in attempt.");
}

/** Counts one failed sign-in; locks the scope for the window once the maximum is reached. */
export async function recordFailure(
  scope: "login:account" | "login:ip",
  identifier: string,
  maxFailures: number,
  windowMinutes: number,
) {
  const { error } = await supabaseAdmin.rpc("record_auth_failure", {
    _scope: scope,
    _identifier: identifier,
    _max_failures: maxFailures,
    _window_minutes: windowMinutes,
  });
  if (error) throw new Error("Could not record the sign-in attempt.");
}

/** Counts one action against a scope. Returns false once the caller is over the limit. */
export async function consumeThrottle(
  scope: "booking:account" | "booking:ip" | "reschedule:account" | "reschedule:ip",
  identifier: string,
  maximum: number,
  windowMinutes: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("consume_action_throttle", {
    _scope: scope,
    _identifier: identifier,
    _maximum: maximum,
    _window_minutes: windowMinutes,
  });
  if (error) throw new Error("Could not verify request limits. Try again shortly.");
  return data === true;
}
