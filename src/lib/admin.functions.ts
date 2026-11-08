// Account tools for the School Administrator: create a login for an approved
// email, see which approved emails already have a login, and recover a login
// (email a reset link, or set a new temporary password to hand over).
//
// Rules enforced here, on the server, regardless of what the browser sends:
// - the caller must be a signed-in Administrator with the second step (aal2);
// - the role comes from the approved lists, never from the caller:
//     approved_staff   -> that row's role (lecturer, dean, it_support)
//     approved_students -> student
// - anything else is refused. The sign-up trigger builds the profile and role
//   row automatically, so the person can sign in immediately.
// - the Administrator account itself is never touched by these tools.
// Every creation and every recovery is written to the activity log
// (credential category), which is only readable by the Administrator and IT.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

/**
 * Confirms the caller is the Administrator (second step done) and returns the
 * service-role client. See src/lib/admin-auth.server.ts for why this does not
 * use the generic auth middleware.
 */
async function adminContext() {
  const { authenticateAdministrator } = await import("@/lib/admin-auth.server");
  return await authenticateAdministrator();
}

/** What role would this approved email get? Taken from the lists, never the caller. */
async function approvedRoleFor(
  supabaseAdmin: AdminClient,
  email: string,
) {
  const { data: staffRow } = await supabaseAdmin
    .from("approved_staff")
    .select("role, full_name")
    .eq("email", email)
    .maybeSingle();
  if (staffRow?.role) return { role: staffRow.role as string, fullName: staffRow.full_name };

  const { data: studentRow } = await supabaseAdmin
    .from("approved_students")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();
  if (studentRow) return { role: "student", fullName: studentRow.full_name };

  return null;
}

const emailSchema = z.string().trim().toLowerCase().email();

const createSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters for the starting password."),
  fullName: z.string().trim().optional(),
});

export const createApprovedLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { userId, supabaseAdmin } = await adminContext();

    const approved = await approvedRoleFor(supabaseAdmin, data.email);
    if (!approved) throw new Error("That email is not on an approved list.");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName || approved.fullName || undefined,
        minted_by_admin: true,
      },
    });
    if (createError) {
      if (/already|exists|registered|duplicate/i.test(createError.message)) {
        throw new Error("That email already has a login. Use Reset password instead.");
      }
      throw new Error("Could not create that login. Try again.");
    }

    await supabaseAdmin.from("activity_log").insert({
      actor_id: userId,
      action: "login_created",
      entity_type: "account",
      entity_id: created.user?.id ?? null,
      category: "credential",
      details: { email: data.email, role: approved.role },
    });

    return { ok: true as const, email: data.email, role: approved.role };
  });

/**
 * Which approved emails already have a login. The list page uses this to show
 * "Create login" for people without an account and "Reset password" for people
 * who have one. Only emails are returned, nothing else about the accounts.
 */
export const listLoginEmails = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await adminContext();

    const { data, error } = await supabaseAdmin.from("profiles").select("email");
    if (error) throw new Error("Could not read which accounts exist. Try again.");

    const emails = (data ?? [])
      .map((row) => (row.email ?? "").trim().toLowerCase())
      .filter((e) => e.length > 0);
    return { emails };
  });

const resetSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("email"), email: emailSchema }),
  z.object({
    method: z.literal("password"),
    email: emailSchema,
    password: z.string().min(8, "Use at least 8 characters for the new password."),
  }),
]);

/** Finds the auth user id for an email: profile first, then the auth user list. */
async function findUserId(
  supabaseAdmin: AdminClient,
  email: string,
): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) return profile.id;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Recovery for an account that already exists (student or staff):
 * - method "email": the person's own inbox gets the reset link;
 * - method "password": a new temporary password is set, for the Administrator
 *   to pass on privately. The person then changes it from Forgot password.
 * Either way the Administrator never sees the person's old password, and the
 * action is written to the activity log.
 */
export const resetLoginPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ data }) => {
    const { userId: callerId, supabaseAdmin } = await adminContext();

    const approved = await approvedRoleFor(supabaseAdmin, data.email);
    if (!approved) throw new Error("That email is not on an approved list.");

    const userId = await findUserId(supabaseAdmin, data.email);
    if (!userId) throw new Error("That person has no login yet. Use Create login first.");
    if (userId === callerId) {
      throw new Error("Use the Forgot password page to change your own password.");
    }

    if (data.method === "email") {
      // The link must come back to this same site, so it is taken from the
      // request itself rather than from anything the browser typed in.
      const origin = getRequest()?.headers.get("origin");
      if (!origin) throw new Error("Could not work out the site address. Try again.");

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${origin}/reset-password`,
      });
      if (error) {
        throw new Error(
          "The reset email could not be sent right now. Set a temporary password instead, or try again shortly.",
        );
      }
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
      });
      if (error) throw new Error("Could not set that password. Try a different one.");
    }

    await supabaseAdmin.from("activity_log").insert({
      actor_id: callerId,
      action: data.method === "email" ? "password_reset_emailed" : "password_reset_set",
      entity_type: "account",
      entity_id: userId,
      category: "credential",
      details: { email: data.email, role: approved.role, method: data.method },
    });

    return { ok: true as const, email: data.email, role: approved.role, method: data.method };
  });
