import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

/**
 * Where the link in a confirmation email lands. Supabase reads the tokens from the address,
 * so once the session exists we go to the dashboard; if there is none, back to sign-in.
 */
function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        void navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
      })
      .catch(() => {
        if (active) void navigate({ to: "/auth", replace: true });
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 font-sans">
      <div className="w-full max-w-md text-center">
        <p className="text-sm text-muted-foreground">Completing sign in…</p>
      </div>
    </main>
  );
}
