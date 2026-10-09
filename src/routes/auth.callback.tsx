import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error("Auth callback error:", error);
        navigate({ to: "/auth", search: { error: "auth_failed" } });
        return;
      }
      navigate({ to: "/dashboard" });
    }
    void handleCallback();
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 font-sans">
      <div className="w-full max-w-md text-center">
        <p className="text-sm text-muted-foreground">Completing sign in…</p>
      </div>
    </main>
  );
}