import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { user: data.user };

    // getUser asks the server. If the phone is simply offline (this app works offline), fall back
    // to the session stored on the device instead of bouncing a signed-in person to the sign-in page.
    const offline = error && (error.name === "AuthRetryableFetchError" || error.status === 0);
    if (offline) {
      const { data: local } = await supabase.auth.getSession();
      if (local.session?.user) return { user: local.session.user };
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
