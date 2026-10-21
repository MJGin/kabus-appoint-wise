// Creates a real login for an already-approved email, with the shared
// starting password, so the person can sign in immediately.
//
// Only the School Administrator can call this (checked from user_roles).
// The role comes from the approved lists, never from the caller:
//   approved_staff  -> that row's role (lecturer, dean, it_support)
//   approved_students -> student
// Anything else -> 403. The handle_new_user trigger builds the profile,
// role row and timetable wiring automatically on insert.
//
// Required function secret: DEFAULT_ACCOUNT_PASSWORD (the common password).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const defaultPassword = Deno.env.get("DEFAULT_ACCOUNT_PASSWORD") ?? "";
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);
  if (!defaultPassword) return json({ error: "Account password is not configured." }, 500);

  const admin = createClient(url, serviceKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  // Who is calling? Must be a signed-in School Administrator.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in first." }, 401);
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  const caller = callerError ? null : callerData.user;
  if (!caller) return json({ error: "Sign in first." }, 401);
  const { data: callerRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (callerRole?.role !== "administrator") {
    return json({ error: "Only the School Administrator can create logins." }, 403);
  }

  // What role does the approved email get? From the lists, never the caller.
  let email = "";
  let fullName = "";
  try {
    const body = (await req.json()) as { email?: unknown; fullName?: unknown };
    email = String(body.email ?? "").trim().toLowerCase();
    fullName = String(body.fullName ?? "").trim();
  } catch {
    return json({ error: "Send an email address." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "That is not a valid email address." }, 400);
  }

  const { data: staffRow } = await admin
    .from("approved_staff")
    .select("role")
    .eq("email", email)
    .maybeSingle();
  let role: string | null = staffRow?.role ?? null;
  if (!role) {
    const { data: studentRow } = await admin
      .from("approved_students")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (studentRow) role = "student";
  }
  if (!role) return json({ error: "That email is not on an approved list." }, 403);

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
    // minted_by_admin lets the sign-up rule tell the Administrator's own
    // creation path apart from somebody self-signing up with a staff email.
    user_metadata: { full_name: fullName || undefined, minted_by_admin: true },
  });
  if (createError) {
    if (/already|exists|registered|duplicate/i.test(createError.message)) {
      return json({ error: "That email already has a login." }, 409);
    }
    return json({ error: "Could not create that login. Try again." }, 500);
  }

  return json({ ok: true, email, role });
});
