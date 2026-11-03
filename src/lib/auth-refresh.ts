import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

// A tab that has been open a while can hold an expired access token. The
// server then rejects every server function with "Invalid token". Refresh the
// session before the token is attached, so the request carries a current one.
// Registered in src/start.ts BEFORE attachSupabaseAuth.
export const refreshExpiredAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        const expiresAtMs = (session.expires_at ?? 0) * 1000;
        if (expiresAtMs - Date.now() < 60_000) {
          await supabase.auth.refreshSession();
        }
      }
    } catch {
      // Refreshing failed (for example the refresh ticket is gone). The stale
      // token is attached downstream and the server answers with a clear
      // "sign in again" message, which fail() translates for the user.
    }
    return next();
  },
);
