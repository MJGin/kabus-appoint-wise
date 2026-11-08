// Server-only helper for the Administrator account tools (src/lib/admin.functions.ts).
//
// Why this exists: the generic auth middleware reads SUPABASE_URL and
// SUPABASE_PUBLISHABLE_KEY from the server's own secrets. If those ever differ
// from the backend the website signs people in with, every check fails with
// "Unauthorized: Invalid token" even though the person is signed in. Here the
// backend address is resolved in exactly the same order the browser client
// uses (src/integrations/supabase/client.ts), so the server always checks the
// sign-in against the same backend that issued it. When a check still fails,
// the message names both backends so the cause is obvious.
//
// Nothing here weakens the checks: the token is still verified by the backend,
// the role still comes from the database, and the service-role key is still
// only ever read on the server.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

// Same fallbacks as src/integrations/supabase/client.ts.
const DEFAULT_SUPABASE_URL = "https://hhdgddhwocltokcqfauh.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l7ayIlov7cePhpioxscrzA_vcPJr0ZZ";

/** The backend the browser uses, resolved in the browser client's own order. */
export function resolveBackend() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_URL"]) ||
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    DEFAULT_SUPABASE_URL;
  const publishableKey =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"]) ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  return { url: String(url), publishableKey: String(publishableKey) };
}

function hostOf(value: string | undefined | null) {
  if (!value) return "unknown";
  try {
    return new URL(value).host;
  } catch {
    return "unknown";
  }
}

/** Reads the (unverified) issuer from a token, only to explain a failure. */
function issuerHostOf(token: string) {
  try {
    const part = token.split(".")[1] ?? "";
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return hostOf((JSON.parse(json) as { iss?: string }).iss);
  } catch {
    return "unknown";
  }
}

export type AdminContext = {
  userId: string;
  supabaseAdmin: SupabaseClient<Database>;
};

/**
 * Confirms the caller is the School Administrator signed in with the second
 * step, and hands back the service-role client for the privileged work.
 */
export async function authenticateAdministrator(): Promise<AdminContext> {
  const backend = resolveBackend();

  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No authorization header provided");
  }
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const verifier = createClient<Database>(backend.url, backend.publishableKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error(
      `Unauthorized: Invalid token. The server checked it against ${hostOf(backend.url)}, ` +
        `but it was issued by ${issuerHostOf(token)}.`,
    );
  }

  const claims = data.claims as { sub: string; aal?: string };
  if (claims.aal !== "aal2") throw new Error("Finish the second step before doing this.");

  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceKey) {
    throw new Error(
      "The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in the project secrets and republish.",
    );
  }
  const supabaseAdmin = createClient<Database>(backend.url, serviceKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  // The role comes from the database, never from the caller.
  const { data: callerRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (roleError) {
    throw new Error(
      `The server could not read accounts on ${hostOf(backend.url)}. ` +
        "Check that SUPABASE_SERVICE_ROLE_KEY belongs to that same project.",
    );
  }
  if (callerRole?.role !== "administrator") {
    throw new Error("Only the School Administrator can manage logins.");
  }

  return { userId: claims.sub, supabaseAdmin };
}
