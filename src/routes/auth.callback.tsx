import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Demo mode: no OAuth, just redirect to dashboard
    navigate({ to: "/dashboard" });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 font-sans">
      <div className="w-full max-w-md text-center">
        <p className="text-sm text-muted-foreground">Completing sign in…</p>
      </div>
    </main>
  );
}