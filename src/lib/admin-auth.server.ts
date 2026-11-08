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

type Backend = { url: string; publishableKey: string };

/**
 * Where to try verifying a token. First the backend the browser resolves. The
 * same backend can also be reached through a proxy address (for example the
 * Lovable Cloud address) that refuses server-side checks, so if the token was
 * issued by this project's own address (a fixed value, never taken from the
 * caller), that address is tried second. A token from any other project is
 * never accepted.
 */
function candidateBackends(issuerHost: string): Backend[] {
  const primary = resolveBackend();
  const list: Backend[] = [primary];
  const projectHost = hostOf(DEFAULT_SUPABASE_URL);
  if (issuerHost === projectHost && hostOf(primary.url) !== projectHost) {
    list.push({ url: DEFAULT_SUPABASE_URL, publishableKey: DEFAULT_SUPABASE_PUBLISHABLE_KEY });
  }
  return list;
}

/**
 * Confirms the caller is the School Administrator signed in with the second
 * step, and hands back the service-role client for the privileged work.
 */
export async function authenticateAdministrator(): Promise<AdminContext> {
  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No authorization header provided");
  }
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const issuerHost = issuerHostOf(token);
  const failures: string[] = [];
  let backend: Backend | null = null;
  let claims: { sub: string; aal?: string } | null = null;

  for (const candidate of candidateBackends(issuerHost)) {
    const verifier = createClient<Database>(candidate.url, candidate.publishableKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data, error } = await verifier.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        backend = candidate;
        claims = data.claims as { sub: string; aal?: string };
        break;
      }
      failures.push(`${hostOf(candidate.url)}: ${error?.message ?? "no claims returned"}`);
    } catch (e) {
      failures.push(`${hostOf(candidate.url)}: ${e instanceof Error ? e.message : "request failed"}`);
    }
  }

  if (!backend || !claims) {
    throw new Error(
      `Unauthorized: Invalid token. Issued by ${issuerHost}. Checked: ${failures.join(" | ")}`,
    );
  }
  if (claims.aal !== "aal2") throw new Error("Finish the second step before doing this.");

  const serviceKey = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();
  if (!serviceKey) {
    throw new Error(
      "The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in the project secrets and republish.",
    );
  }

  // The service-role key may only be valid at the address the server's own
  // secrets name (for example the Lovable Cloud address) rather than the
  // project's direct address, so try that one first, then the one that just
  // verified the sign-in.
  const adminUrls = [resolveBackend().url, backend.url].filter((u, i, all) => all.indexOf(u) === i);
  const adminFailures: string[] = [];
  let supabaseAdmin: SupabaseClient<Database> | null = null;

  for (const url of adminUrls) {
    const client = createClient<Database>(url, serviceKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    // The role comes from the database, never from the caller. Only a database
    // that confirms this account is the Administrator is ever used.
    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.sub)
      .maybeSingle();
    if (error) {
      adminFailures.push(`${hostOf(url)}: ${error.message}`);
      continue;
    }
    if (data?.role !== "administrator") {
      adminFailures.push(
        `${hostOf(url)}: no Administrator role for your account there (found: ${data?.role ?? "no role"})`,
      );
      continue;
    }
    supabaseAdmin = client;
    break;
  }

  if (!supabaseAdmin) {
    throw new Error(
      `The server could not confirm you as Administrator. Tried: ${adminFailures.join(" | ")}. ` +
        `Your sign-in was issued by ${issuerHost}. SUPABASE_SERVICE_ROLE_KEY must be the ` +
        "service-role (secret) key of that same project.",
    );
  }

  return { userId: claims.sub, supabaseAdmin };
}
