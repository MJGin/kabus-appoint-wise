import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  if (!SUPABASE_URL) {
    throw new Error("Missing VITE_SUPABASE_URL");
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_ANON_KEY) },
  });
}

const supabase = createSupabaseClient();

/**
 * Simple rate limiting for actions (booking, cancelling, etc.)
 * Returns true if allowed, false if rate limited
 */
export async function consumeActionRateLimit(action: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("consume_action_rate_limit", {
      p_action: action,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}