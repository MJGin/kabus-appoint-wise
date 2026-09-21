import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const identifierSchema = z.object({ identifier: z.string().min(1).max(200) });
const resultSchema = identifierSchema.extend({ succeeded: z.boolean() });

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function callerIp() {
  const headers = getRequest().headers;
  const raw =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0] ??
    headers.get("x-real-ip") ??
    "unknown";
  return raw.trim();
}

/** Refuses further sign-in attempts once an account or network address is locked out. */
export const checkSignInAllowed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => identifierSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [account, network] = await Promise.all([
      supabaseAdmin.rpc("check_auth_throttle", {
        _scope: "signin:account",
        _identifier: await hash(data.identifier),
      }),
      supabaseAdmin.rpc("check_auth_throttle", {
        _scope: "signin:ip",
        _identifier: await hash(callerIp()),
      }),
    ]);
    return { allowed: account.data !== false && network.data !== false };
  });

/** Records the outcome of a sign-in attempt so repeated failures lock the path. */
export const recordSignInResult = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resultSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await Promise.all([
      supabaseAdmin.rpc("record_auth_attempt", {
        _scope: "signin:account",
        _identifier: await hash(data.identifier),
        _succeeded: data.succeeded,
      }),
      supabaseAdmin.rpc("record_auth_attempt", {
        _scope: "signin:ip",
        _identifier: await hash(callerIp()),
        _succeeded: data.succeeded,
      }),
    ]);
    return { ok: true };
  });
