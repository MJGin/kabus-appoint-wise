// Creates a real login for an email already on an approved list, with the
// starting password the Administrator chooses in the dialog.
//
// Rules enforced here, on the server, regardless of what the browser sends:
// - the caller must be a signed-in Administrator with the second step (aal2);
// - the role comes from the approved lists, never from the caller:
//     approved_staff   -> that row's role (lecturer, dean, it_support)
//     approved_students -> student
// - anything else is refused. The sign-up trigger builds the profile and role
//   row automatically, so the person can sign in immediately.
// Every creation is written to the activity log (credential category).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Use at least 8 characters for the starting password."),
  fullName: z.string().trim().optional(),
});

export const createApprovedLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const aal = (context.claims as { aal?: string } | null)?.aal;
    if (aal !== "aal2") throw new Error("Finish the second step before doing this.");

    const { data: callerRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (callerRole?.role !== "administrator") {
      throw new Error("Only the School Administrator can create logins.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // What role does the approved email get? From the lists, never the caller.
    const { data: staffRow } = await supabaseAdmin
      .from("approved_staff")
      .select("role, full_name")
      .eq("email", data.email)
      .maybeSingle();
    let role: string | null = staffRow?.role ?? null;
    if (!role) {
      const { data: studentRow } = await supabaseAdmin
        .from("approved_students")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (studentRow) role = "student";
    }
    if (!role) throw new Error("That email is not on an approved list.");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName || staffRow?.full_name || undefined,
        minted_by_admin: true,
      },
    });
    if (createError) {
      if (/already|exists|registered|duplicate/i.test(createError.message)) {
        throw new Error("That email already has a login.");
      }
      throw new Error("Could not create that login. Try again.");
    }

    await supabaseAdmin.from("activity_log").insert({
      actor_id: context.userId,
      action: "login_created",
      entity_type: "account",
      entity_id: created.user?.id ?? null,
      category: "credential",
      details: { email: data.email, role },
    });

    return { ok: true as const, email: data.email, role };
  });
