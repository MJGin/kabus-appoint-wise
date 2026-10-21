// Server-only helpers for booking and reschedule limits.
// Import this only from inside server function handlers (dynamic import), never from client code.
import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** One-way hash so raw ids and network addresses never sit in the throttle table. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Best-effort network address of the caller, taken from the platform's forwarding headers. */
export function clientAddress(): string {
  const headers = getRequest()?.headers;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("cf-connecting-ip") || headers?.get("x-real-ip") || "unknown";
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
  if (error) throw new Error("Could not verify request limits.");
  return data === true;
}
