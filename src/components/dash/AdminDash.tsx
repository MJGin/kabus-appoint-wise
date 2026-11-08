import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AuthenticatorReset } from "@/components/dash/AuthenticatorReset";
import { ConsentRecordsPanel } from "@/components/dash/ConsentRecordsPanel";
import { Empty, Note, Panel, Row } from "@/components/dash/parts";
import { TimetableCalendar } from "@/components/calendar/TimetableCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { createApprovedLogin, listLoginEmails, resetLoginPassword } from "@/lib/admin.functions";
import { storeResumePath } from "@/lib/session-resume";
import { BLOCKS, type Block, blockLabel, DAYS, dayLabel, formatDate, todayIso } from "@/lib/kabuslotin";

type StaffRole = "lecturer" | "dean" | "it_support";

/** Shown instead of a plain error when the sign-in has expired: explains what
 * happened and offers a one-click way back through sign-in, returning to the
 * same page afterwards. */
function ExpiredSessionNote({
  onSignInAgain,
  detail,
}: {
  onSignInAgain: () => Promise<void>;
  detail?: string | null;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
    >
      <span>
        Your sign-in has expired. Sign in again (and confirm your code) to continue where you left
        off — nothing here was changed or lost.
        {detail && (
          <span className="mt-1 block text-xs text-muted-foreground">Reason given: {detail}</span>
        )}
      </span>
      <Button size="sm" variant="brand" onClick={() => void onSignInAgain()}>
        Sign in again
      </Button>
    </div>
  );
}

/** True when a failure is about the sign-in token itself, not about the action. */
function isAuthPlumbingFailure(reason: unknown) {
  const raw = reason instanceof Error ? reason.message : String(reason ?? "");
  return /invalid token|jwt expired|no authorization|not signed in|session missing|unauthorized/i.test(
    raw,
  );
}

export function AdminDash() {
  const qc = useQueryClient();
  const createApprovedLoginFn = useServerFn(createApprovedLogin);
  const listLoginEmailsFn = useServerFn(listLoginEmails);
  const resetLoginPasswordFn = useServerFn(resetLoginPassword);
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // True when the last failure was an expired sign-in, so the app offers a
  // one-click "Sign in again" that returns to this exact page afterwards.
  const [sessionExpired, setSessionExpired] = useState(false);
  // The technical reason behind an "expired" message, shown small so the
  // Administrator (and whoever helps them) can tell what really happened.
  const [expiredDetail, setExpiredDetail] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<{ email: string; fullName: string | null } | null>(
    null,
  );
  // Recovery for someone who already has a login: email them a reset link, or
  // set a new temporary password to hand over.
  const [resettingFor, setResettingFor] = useState<{
    email: string;
    fullName: string | null;
  } | null>(null);
  // Shown once after a login is created (or a temporary password is set), so
  // the Administrator can copy or share the sign-in details privately.
  const [createdLogin, setCreatedLogin] = useState<{
    email: string;
    fullName: string | null;
    role: string;
    password: string;
    isReset?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  function roleLabel(role: string) {
    if (role === "lecturer") return "Lecturer";
    if (role === "dean") return "Dean";
    if (role === "it_support") return "IT Support";
    if (role === "student") return "Student";
    return role;
  }

  function fail(reason: unknown) {
    setInfo(null);
    const raw =
      reason instanceof Error
        ? reason.message
        : typeof reason === "object" && reason !== null && "message" in reason &&
            typeof reason.message === "string"
          ? reason.message
          : "Could not complete that action. Please try again.";
    const expired = isAuthPlumbingFailure(raw);
    setSessionExpired(expired);
    setExpiredDetail(expired ? raw : null);
    setError(
      expired
        ? "Your sign-in has expired. Sign in again to continue where you left off."
        : raw,
    );
  }
  /** Wipe any old banner before opening a dialog, so a stale failure is never shown there. */
  function clearNotices() {
    setError(null);
    setInfo(null);
    setSessionExpired(false);
    setExpiredDetail(null);
  }
  function ok(message: string, keys: string[]) {
    setError(null);
    setSessionExpired(false);
    setExpiredDetail(null);
    setInfo(message);
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
  }

  /**
   * End the expired session cleanly and go to the sign-in page, remembering
   * this page so the person lands right back on it after signing in (they
   * still pass the second-step code check first, as always).
   */
  async function handleSignInAgain() {
    await qc.cancelQueries();
    qc.clear();
    storeResumePath(`${routerLocation.pathname}${routerLocation.search}`);
    try {
      await supabase.auth.signOut();
    } catch {
      /* already signed out — continue to the sign-in page */
    }
    await navigate({ to: "/auth", replace: true });
  }

  const staff = useQuery({
    queryKey: ["approved-staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("approved_staff")
        .select("id, email, full_name, role")
        .order("email");
      return data ?? [];
    },
  });

  const students = useQuery({
    queryKey: ["approved-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("approved_students")
        .select("id, email, full_name")
        .order("email");
      return data ?? [];
    },
  });

  const semesters = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("semesters")
        .select("id, name, start_date, exam_start_date, end_date, is_active")
        .order("start_date", { ascending: false });
      return data ?? [];
    },
  });

  const lecturers = useQuery({
    queryKey: ["admin-lecturers"],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "lecturer");
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .order("full_name");
      return data ?? [];
    },
  });

  const timetable = useQuery({
    queryKey: ["admin-timetable"],
    queryFn: async () => {
      const { data } = await supabase
        .from("timetable_slots")
        .select("id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block")
        .order("day_of_week");
      return data ?? [];
    },
  });

  const exams = useQuery({
    queryKey: ["admin-exams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_slots")
        .select("id, lecturer_id, unit_code, exam_date, block, venue")
        .order("exam_date");
      return data ?? [];
    },
  });

  const usage = useQuery({
    queryKey: ["admin-usage"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("status, created_at, decided_at");
      const rows = data ?? [];
      const decided = rows.filter((r) => r.decided_at);
      const hours =
        decided.length === 0
          ? 0
          : decided.reduce(
              (sum, r) =>
                sum + (new Date(r.decided_at!).getTime() - new Date(r.created_at).getTime()),
              0,
            ) /
            decided.length /
            3_600_000;
      return {
        total: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        accepted: rows.filter((r) => r.status === "accepted").length,
        declined: rows.filter((r) => r.status === "declined").length,
        acceptance: decided.length
          ? Math.round((rows.filter((r) => r.status === "accepted").length / decided.length) * 100)
          : 0,
        responseHours: Math.round(hours * 10) / 10,
      };
    },
  });

  const addStaff = useMutation({
    mutationFn: async (values: { email: string; role: StaffRole; fullName: string }) => {
      const { error: e } = await supabase.from("approved_staff").insert({
        email: values.email,
        role: values.role,
        full_name: values.fullName || null,
      });
      if (e) throw e;
    },
    onSuccess: () => ok("Email added to the approved list.", ["approved-staff"]),
    onError: fail,
  });

  const removeStaff = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("approved_staff").delete().eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => ok("Email removed.", ["approved-staff"]),
    onError: fail,
  });

  const renameStaff = useMutation({
    mutationFn: async (values: { id: string; fullName: string }) => {
      const { error: e } = await supabase
        .from("approved_staff")
        .update({ full_name: values.fullName || null })
        .eq("id", values.id);
      if (e) throw e;
    },
    onSuccess: () => {
      setEditingStaff(null);
      ok("Name saved.", ["approved-staff"]);
    },
    onError: fail,
  });

  const addStudent = useMutation({
    mutationFn: async (values: { email: string; fullName: string }) => {
      const { error: e } = await supabase
        .from("approved_students")
        .insert({ email: values.email, full_name: values.fullName || null });
      if (e) throw e;
    },
    onSuccess: () => ok("Email added to the approved list.", ["approved-students"]),
    onError: fail,
  });

  const removeStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("approved_students").delete().eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => ok("Email removed.", ["approved-students"]),
    onError: fail,
  });

  const renameStudent = useMutation({
    mutationFn: async (values: { id: string; fullName: string }) => {
      const { error: e } = await supabase
        .from("approved_students")
        .update({ full_name: values.fullName || null })
        .eq("id", values.id);
      if (e) throw e;
    },
    onSuccess: () => {
      setEditingStudent(null);
      ok("Name saved.", ["approved-students"]);
    },
    onError: fail,
  });

  // Teaching-logins applied for on the Create account page, waiting for a
  // decision. Approve adds them to the approved staff list as a lecturer with
  // their chosen name; Create login then mints the actual account.
  const teacherRequests = useQuery({
    queryKey: ["teacher-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_requests")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const approveTeacher = useMutation({
    mutationFn: async (values: { id: string; email: string; fullName: string }) => {
      const { error: e } = await supabase.from("approved_staff").insert({
        email: values.email,
        role: "lecturer" as StaffRole,
        full_name: values.fullName,
      });
      if (e) throw e;
      const { error: e2 } = await supabase.from("teacher_requests").delete().eq("id", values.id);
      if (e2) throw e2;
    },
    onSuccess: (_d, v) =>
      ok(
        `${v.fullName} approved as a lecturer. Press Create login on the staff list to make their account.`,
        ["approved-staff", "teacher-requests"],
      ),
    onError: fail,
  });

  const dismissTeacher = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("teacher_requests").delete().eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => ok("Application dismissed. They can apply again.", ["teacher-requests"]),
    onError: fail,
  });

  // Creates the actual account for an approved email, with the starting
  // password the Administrator types in the dialog. The server function
  // checks the caller is the Administrator and takes the role from the
  // approved lists; profiles and roles are built by the sign-up trigger
  // automatically.
  // Runs a server call with a freshly refreshed session. If the server still
  // rejects the sign-in token, refresh once more and retry before giving up,
  // so a tab that has been open a while does not trip over a stale token.
  async function withFreshSession<T>(call: () => Promise<T>): Promise<T> {
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* the call below reports it if the session is truly gone */
    }
    try {
      return await call();
    } catch (e) {
      if (!isAuthPlumbingFailure(e)) throw e;
      await supabase.auth.refreshSession();
      return await call();
    }
  }

  const createLogin = useMutation({
    mutationFn: async (input: { email: string; fullName: string | null; password: string }) => {
      const payload: { email: string; password: string; fullName?: string } = {
        email: input.email,
        password: input.password,
      };
      if (input.fullName) payload.fullName = input.fullName;
      return await withFreshSession(() => createApprovedLoginFn({ data: payload }));
    },
    onSuccess: (result, input) => {
      setCreatingFor(null);
      setError(null);
      setSessionExpired(false);
      setExpiredDetail(null);
      setOrigin(window.location.origin);
      setCopied(false);
      void qc.invalidateQueries({ queryKey: ["login-emails"] });
      setCreatedLogin({
        email: input.email,
        fullName: input.fullName,
        role: result.role,
        password: input.password,
      });
    },
    onError: fail,
  });

  // Which approved emails already have a login. Those rows offer Reset
  // password (recovery) instead of Create login.
  const loginEmails = useQuery({
    queryKey: ["login-emails"],
    queryFn: async () => (await withFreshSession(() => listLoginEmailsFn())).emails,
    retry: false,
  });
  function hasLogin(email: string) {
    return !!loginEmails.data?.includes(email.trim().toLowerCase());
  }

  // Recovery for an existing login: email the person a reset link, or set a
  // new temporary password to hand over.
  const resetPassword = useMutation({
    mutationFn: async (
      input:
        | { method: "email"; email: string; fullName: string | null }
        | { method: "password"; email: string; fullName: string | null; password: string },
    ) => {
      const payload =
        input.method === "email"
          ? { method: "email" as const, email: input.email }
          : { method: "password" as const, email: input.email, password: input.password };
      return await withFreshSession(() => resetLoginPasswordFn({ data: payload }));
    },
    onSuccess: (result, input) => {
      setResettingFor(null);
      setError(null);
      setSessionExpired(false);
      setExpiredDetail(null);
      if (input.method === "email") {
        setInfo(
          `A reset link was emailed to ${input.email}. It sends them to a page where they choose a new password.`,
        );
        return;
      }
      setInfo(null);
      setOrigin(window.location.origin);
      setCopied(false);
      setCreatedLogin({
        email: input.email,
        fullName: input.fullName,
        role: result.role,
        password: input.password,
        isReset: true,
      });
    },
    onError: fail,
  });

  function loginDetailsText() {
    if (!createdLogin) return "";
    return [
      createdLogin.isReset
        ? "KABU SlotIn — your password was reset"
        : "KABU SlotIn — your sign-in is ready",
      "",
      `Name: ${createdLogin.fullName || "—"}`,
      `Role: ${roleLabel(createdLogin.role)}`,
      `Sign-in email: ${createdLogin.email}`,
      `${createdLogin.isReset ? "Temporary password" : "Starting password"}: ${createdLogin.password}`,
      "",
      `Sign in here: ${origin}`,
      "This password was set by the School Administrator. Please change it after you sign in.",
    ].join("\n");
  }

  async function copyLoginDetails() {
    if (!createdLogin) return;
    try {
      await navigator.clipboard.writeText(loginDetailsText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      setError("Could not copy automatically. Select the details and copy them by hand.");
    }
  }

  async function shareLoginDetails() {
    if (!createdLogin) return;
    try {
      await navigator.share({ title: "KABU SlotIn sign-in", text: loginDetailsText() });
    } catch {
      // The person cancelled the share sheet; nothing to do.
    }
  }

  const addSemester = useMutation({
    mutationFn: async (values: {
      name: string;
      start_date: string;
      exam_start_date: string;
      end_date: string;
    }) => {
      const { error: e } = await supabase.from("semesters").insert(values);
      if (e) throw e;
    },
    onSuccess: () => ok("Semester saved.", ["semesters"]),
    onError: fail,
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      // Prefer the atomic server call (one statement can never leave the
      // school between semesters). Falls back to the two-step update only if
      // the database does not have the new function yet.
      const { error: rpcError } = await supabase.rpc("activate_semester_lotin", { _semester_id: id });
      if (rpcError && /could not find the function|schema cache/i.test(rpcError.message)) {
        const { error: e1 } = await supabase.from("semesters").update({ is_active: false }).neq("id", id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("semesters").update({ is_active: true }).eq("id", id);
        if (e2) throw e2;
        return;
      }
      if (rpcError) throw rpcError;
    },
    onSuccess: () => ok("Active semester changed.", ["semesters"]),
    onError: fail,
  });

  const activeSemester = semesters.data?.find((s) => s.is_active);

  const addSlot = useMutation({
    mutationFn: async (values: {
      lecturer_id: string;
      unit_code: string;
      unit_name: string;
      year_group: number;
      day_of_week: number;
      block: Block;
    }) => {
      if (!activeSemester) throw new Error("Set an active semester first.");
      const { error: e } = await supabase
        .from("timetable_slots")
        .insert({ ...values, semester_id: activeSemester.id });
      if (e) throw e;
    },
    onSuccess: () => ok("Timetable row added.", ["admin-timetable"]),
    onError: fail,
  });

  const removeSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("timetable_slots").delete().eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => ok("Timetable row removed.", ["admin-timetable"]),
    onError: fail,
  });

  const addExam = useMutation({
    mutationFn: async (values: {
      lecturer_id: string;
      unit_code: string;
      exam_date: string;
      block: Block;
      venue: string;
    }) => {
      if (!activeSemester) throw new Error("Set an active semester first.");
      const { error: e } = await supabase
        .from("exam_slots")
        .insert({ ...values, semester_id: activeSemester.id });
      if (e) throw e;
    },
    onSuccess: () => ok("Exam slot saved.", ["admin-exams"]),
    onError: fail,
  });

  const lecturerName = (id: string) =>
    lecturers.data?.find((l) => l.id === id)?.full_name ?? "Lecturer";

  const removeExam = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("exam_slots").delete().eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => ok("Exam slot removed.", ["admin-exams"]),
    onError: fail,
  });

  return (
    <div className="space-y-5">
      {error &&
        (sessionExpired ? (
          <ExpiredSessionNote onSignInAgain={handleSignInAgain} />
        ) : (
          <Note tone="error">{error}</Note>
        ))}
      {info && <Note>{info}</Note>}

      <AuthenticatorReset />

      <ConsentRecordsPanel />

      <Panel title="Usage summary" description="Counts and timings only — never anyone's words.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Requests", usage.data?.total ?? 0],
            ["Waiting", usage.data?.pending ?? 0],
            ["Accepted", usage.data?.accepted ?? 0],
            ["Acceptance", `${usage.data?.acceptance ?? 0}%`],
            ["Avg. answer", `${usage.data?.responseHours ?? 0}h`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-background p-4">
              <p className="font-display text-2xl font-semibold text-primary">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel title="Approved staff emails" description="Type the name and email, then Approve. The account always takes the name written here, even if you add the person in the Supabase dashboard (which has no name box). Create login then makes the account — you choose the starting password when you press it. Once someone has a login the button becomes Reset password, for when they are locked out.">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              addStaff.mutate({
                email: String(f.get("email") ?? "").trim().toLowerCase(),
                role: String(f.get("role") ?? "lecturer") as StaffRole,
                fullName: String(f.get("fullName") ?? "").trim(),
              });
              form.reset();
            }}
          >
            <Input name="fullName" required placeholder="Full name" className="h-9 w-44" />
            <Input name="email" type="email" required placeholder="name@kabu.test" className="h-9 w-56" />
            <select name="role" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="lecturer">Lecturer</option>
              <option value="dean">Dean</option>
              <option value="it_support">IT Support</option>
            </select>
            <Button type="submit" size="sm" variant="brand">
              Approve
            </Button>
          </form>
          <div className="mt-4">
            {!staff.data?.length ? (
              <Empty>No staff emails approved yet.</Empty>
            ) : (
              <ul className="space-y-2">
                {staff.data.map((s) => (
                  <Row key={s.id}>
                    <span className="min-w-0 flex-1">
                      {editingStaff === s.id ? (
                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            renameStaff.mutate({
                              id: s.id,
                              fullName: String(f.get("fullName") ?? "").trim(),
                            });
                          }}
                        >
                          <Input
                            name="fullName"
                            defaultValue={s.full_name ?? ""}
                            placeholder="Full name"
                            className="h-9 w-44"
                          />
                          <Button type="submit" size="sm" variant="brand" disabled={renameStaff.isPending}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingStaff(null)}>
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <span className="block font-semibold text-brand-ink">
                            {s.full_name || <span className="font-normal text-muted-foreground">No name set</span>}
                          </span>
                          <span className="block text-sm text-muted-foreground">
                            {s.email} · {s.role.replace("_", " ")}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {editingStaff !== s.id && (
                        <Button size="sm" variant="ghost" onClick={() => setEditingStaff(s.id)}>
                          Edit name
                        </Button>
                      )}
                      {hasLogin(s.email) ? (
                        <Button
                          size="sm"
                          variant="brandOutline"
                          disabled={resetPassword.isPending}
                          onClick={() => {
                            clearNotices();
                            setResettingFor({ email: s.email, fullName: s.full_name });
                          }}
                        >
                          Reset password
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="brandOutline"
                          disabled={createLogin.isPending}
                          onClick={() => {
                            clearNotices();
                            setCreatingFor({ email: s.email, fullName: s.full_name });
                          }}
                        >
                          Create login
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeStaff.mutate(s.id)}>
                        Remove
                      </Button>
                    </span>
                  </Row>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Approved student emails" description="Type the name and email, then Approve. The account always takes the name written here, even if you add the person in the Supabase dashboard (which has no name box). Create login makes the account and you choose its starting password. Once they have a login the button becomes Reset password, for when they are locked out.">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              addStudent.mutate({
                email: String(f.get("email") ?? "").trim().toLowerCase(),
                fullName: String(f.get("fullName") ?? "").trim(),
              });
              form.reset();
            }}
          >
            <Input name="fullName" required placeholder="Full name" className="h-9 w-44" />
            <Input name="email" type="email" required placeholder="name@example.com" className="h-9 w-56" />
            <Button type="submit" size="sm" variant="brand">
              Approve
            </Button>
          </form>
          <div className="mt-4">
            {!students.data?.length ? (
              <Empty>No student emails approved yet.</Empty>
            ) : (
              <ul className="space-y-2">
                {students.data.map((s) => (
                  <Row key={s.id}>
                    <span className="min-w-0 flex-1">
                      {editingStudent === s.id ? (
                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            renameStudent.mutate({
                              id: s.id,
                              fullName: String(f.get("fullName") ?? "").trim(),
                            });
                          }}
                        >
                          <Input
                            name="fullName"
                            defaultValue={s.full_name ?? ""}
                            placeholder="Full name"
                            className="h-9 w-44"
                          />
                          <Button type="submit" size="sm" variant="brand" disabled={renameStudent.isPending}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingStudent(null)}>
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <span className="block font-semibold text-brand-ink">
                            {s.full_name || <span className="font-normal text-muted-foreground">No name set</span>}
                          </span>
                          <span className="block text-sm text-muted-foreground">{s.email}</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {editingStudent !== s.id && (
                        <Button size="sm" variant="ghost" onClick={() => setEditingStudent(s.id)}>
                          Edit name
                        </Button>
                      )}
                      {hasLogin(s.email) ? (
                        <Button
                          size="sm"
                          variant="brandOutline"
                          disabled={resetPassword.isPending}
                          onClick={() => {
                            clearNotices();
                            setResettingFor({ email: s.email, fullName: s.full_name });
                          }}
                        >
                          Reset password
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="brandOutline"
                          disabled={createLogin.isPending}
                          onClick={() => {
                            clearNotices();
                            setCreatingFor({ email: s.email, fullName: s.full_name });
                          }}
                        >
                          Create login
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeStudent.mutate(s.id)}>
                        Remove
                      </Button>
                    </span>
                  </Row>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Teacher applications" description="Teachers who asked for a login on the Create account page. Approve adds them as a lecturer with the name they typed; Dismiss says no. After approving, press Create login on the staff list to give them a starting password.">
          {!teacherRequests.data?.length ? (
            <Empty>No teacher applications yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {teacherRequests.data.map((r) => (
                <Row key={r.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-brand-ink">{r.full_name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {r.email} · applied{" "}
                      {formatDate(new Date(r.created_at).toISOString().slice(0, 10))}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={approveTeacher.isPending}
                      onClick={() =>
                        approveTeacher.mutate({ id: r.id, email: r.email, fullName: r.full_name })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={dismissTeacher.isPending}
                      onClick={() => dismissTeacher.mutate(r.id)}
                    >
                      Dismiss
                    </Button>
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Semester dates" description="No booking is possible before the start date.">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              addSemester.mutate({
                name: String(f.get("name") ?? ""),
                start_date: String(f.get("start_date") ?? ""),
                exam_start_date: String(f.get("exam_start_date") ?? ""),
                end_date: String(f.get("end_date") ?? ""),
              });
              form.reset();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="sem-name">Name</Label>
              <Input id="sem-name" name="name" required placeholder="Sept 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sem-start">Starts</Label>
              <Input id="sem-start" name="start_date" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sem-exam">Exams begin</Label>
              <Input id="sem-exam" name="exam_start_date" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sem-end">Ends</Label>
              <Input id="sem-end" name="end_date" type="date" required />
            </div>
            <Button type="submit" size="sm" variant="brand" className="sm:col-span-2">
              Save semester
            </Button>
          </form>
          <div className="mt-4">
            {!semesters.data?.length ? (
              <Empty>No semester has been set.</Empty>
            ) : (
              <ul className="space-y-2">
                {semesters.data.map((s) => (
                  <Row key={s.id}>
                    <span>
                      <strong className="text-brand-ink">{s.name}</strong> ·{" "}
                      {formatDate(s.start_date)} → {formatDate(s.end_date)} · exams{" "}
                      {formatDate(s.exam_start_date)}
                    </span>
                    {s.is_active ? (
                      <span className="text-xs font-medium text-primary">Active</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => activate.mutate(s.id)}>
                        Make active
                      </Button>
                    )}
                  </Row>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Semester timetable"
        description="Lecturer, unit, year group, day and one of the three blocks."
      >
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            addSlot.mutate({
              lecturer_id: String(f.get("lecturer_id") ?? ""),
              unit_code: String(f.get("unit_code") ?? ""),
              unit_name: String(f.get("unit_name") ?? ""),
              year_group: Number(f.get("year_group") ?? 1),
              day_of_week: Number(f.get("day_of_week") ?? 1),
              block: String(f.get("block") ?? "block_1") as Block,
            });
            form.reset();
          }}
        >
          <select
            name="lecturer_id"
            required
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Lecturer…</option>
            {lecturers.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
          <Input name="unit_code" required placeholder="LAW 101" className="h-9 w-28" />
          <Input name="unit_name" required placeholder="Unit name" className="h-9 w-44" />
          <Input name="year_group" type="number" min={1} max={6} defaultValue={1} className="h-9 w-20" />
          <select name="day_of_week" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <select name="block" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {BLOCKS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="brand">
            Add row
          </Button>
        </form>
        <div className="mt-4">
          {!timetable.data?.length ? (
            <Empty>The timetable is empty — add rows above.</Empty>
          ) : (
            <ul className="space-y-2">
              {timetable.data.map((t) => (
                <Row key={t.id}>
                  <span>
                    <strong className="text-brand-ink">{lecturerName(t.lecturer_id)}</strong> ·{" "}
                    {t.unit_code} {t.unit_name} · {dayLabel(t.day_of_week)} ·{" "}
                    {blockLabel(t.block)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeSlot.mutate(t.id)}>
                    Remove
                  </Button>
                </Row>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel
        title="Timetable calendar"
        description="Week view of every timetabled block — search, filter and switch views."
      >
        <TimetableCalendar />
      </Panel>

      <Panel title="Exam slots" description="Only inside the exam period, and never during Chapel.">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            addExam.mutate({
              lecturer_id: String(f.get("lecturer_id") ?? ""),
              unit_code: String(f.get("unit_code") ?? ""),
              exam_date: String(f.get("exam_date") ?? ""),
              block: String(f.get("block") ?? "block_1") as Block,
              venue: String(f.get("venue") ?? ""),
            });
            form.reset();
          }}
        >
          <select
            name="lecturer_id"
            required
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Lecturer…</option>
            {lecturers.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
          <Input name="unit_code" required placeholder="LAW 101" className="h-9 w-28" />
          <input
            type="date"
            name="exam_date"
            required
            min={todayIso()}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <select name="block" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {BLOCKS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <Input name="venue" required placeholder="Venue" className="h-9 w-40" />
          <Button type="submit" size="sm" variant="brand">
            Save exam
          </Button>
        </form>
        <div className="mt-4">
          {!exams.data?.length ? (
            <Empty>No exam slots set.</Empty>
          ) : (
            <ul className="space-y-2">
              {exams.data.map((x) => (
                <Row key={x.id}>
                  <span>
                    <strong className="text-brand-ink">{x.unit_code}</strong> ·{" "}
                    {lecturerName(x.lecturer_id)} · {formatDate(x.exam_date)} ·{" "}
                    {blockLabel(x.block)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{x.venue}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeExam.mutate(x.id)}>
                      Remove
                    </Button>
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Dialog
        open={!!creatingFor}
        onOpenChange={(open) => {
          if (!open) setCreatingFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create login</DialogTitle>
            <DialogDescription>
              Choose the starting password for {creatingFor?.email}. They sign in with it, then can
              change it any time from the Forgot password page. When the account is created you can
              copy the sign-in details to send to them.
            </DialogDescription>
          </DialogHeader>
          {error &&
            (sessionExpired ? (
              <ExpiredSessionNote onSignInAgain={handleSignInAgain} detail={expiredDetail} />
            ) : (
              <Note tone="error">{error}</Note>
            ))}
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const password = String(f.get("password") ?? "");
              const confirm = String(f.get("confirm") ?? "");
              if (password !== confirm) {
                setSessionExpired(false);
                setError("The two passwords do not match.");
                return;
              }
              if (!creatingFor) return;
              createLogin.mutate({
                email: creatingFor.email,
                fullName: creatingFor.fullName,
                password,
              });
            }}
          >
            <PasswordInput
              name="password"
              label="Starting password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordInput
              name="confirm"
              label="Repeat it"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreatingFor(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={createLogin.isPending}>
                {createLogin.isPending ? "Creating…" : "Create login"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resettingFor}
        onOpenChange={(open) => {
          if (!open) setResettingFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resettingFor?.fullName ? `${resettingFor.fullName} · ` : ""}
              {resettingFor?.email} already has a login. Send them a reset link, or set a new
              temporary password yourself.
            </DialogDescription>
          </DialogHeader>
          {error &&
            (sessionExpired ? (
              <ExpiredSessionNote onSignInAgain={handleSignInAgain} detail={expiredDetail} />
            ) : (
              <Note tone="error">{error}</Note>
            ))}

          <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-brand-ink">Email a reset link</p>
            <p className="text-muted-foreground">
              A link goes to {resettingFor?.email}. They open it and choose their own new password,
              so you never handle it.
            </p>
            <div>
              <Button
                type="button"
                variant="brand"
                size="sm"
                disabled={resetPassword.isPending}
                onClick={() => {
                  if (!resettingFor) return;
                  resetPassword.mutate({
                    method: "email",
                    email: resettingFor.email,
                    fullName: resettingFor.fullName,
                  });
                }}
              >
                {resetPassword.isPending ? "Sending…" : "Send reset link"}
              </Button>
            </div>
          </div>

          <form
            className="grid gap-3 rounded-lg border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const password = String(f.get("password") ?? "");
              const confirm = String(f.get("confirm") ?? "");
              if (password !== confirm) {
                setSessionExpired(false);
                setError("The two passwords do not match.");
                return;
              }
              if (!resettingFor) return;
              resetPassword.mutate({
                method: "password",
                email: resettingFor.email,
                fullName: resettingFor.fullName,
                password,
              });
            }}
          >
            <p className="text-sm font-medium text-brand-ink">Or set a temporary password</p>
            <PasswordInput
              name="password"
              label="New temporary password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordInput
              name="confirm"
              label="Repeat it"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setResettingFor(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="brandOutline" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Saving…" : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdLogin}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedLogin(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdLogin?.isReset
                ? "Password reset — share the details"
                : "Login created — share the details"}
            </DialogTitle>
            <DialogDescription>
              {createdLogin?.isReset
                ? "The old password no longer works. "
                : "The account exists now. "}
              Send these details to {createdLogin?.email} by email, message or printout — whatever
              you prefer.
            </DialogDescription>
          </DialogHeader>
          {createdLogin && (
            <div className="grid gap-1.5 rounded-lg border bg-muted/40 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Name: </span>
                {createdLogin.fullName || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Role: </span>
                {roleLabel(createdLogin.role)}
              </div>
              <div>
                <span className="text-muted-foreground">Sign-in email: </span>
                {createdLogin.email}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {createdLogin.isReset ? "Temporary password: " : "Starting password: "}
                </span>
                <code className="font-semibold">{createdLogin.password}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Sign in here: </span>
                {origin}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Anyone who has these details can sign in, so share them privately. The person changes
            the password after their first sign-in.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setCreatedLogin(null); setCopied(false); }}>
              Close
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button type="button" variant="outline" onClick={shareLoginDetails}>
                Share…
              </Button>
            )}
            <Button type="button" variant="brand" onClick={copyLoginDetails}>
              {copied ? "Copied ✓" : "Copy details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
