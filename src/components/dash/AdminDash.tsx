import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AuthenticatorReset } from "@/components/dash/AuthenticatorReset";
import { ConsentRecordsPanel } from "@/components/dash/ConsentRecordsPanel";
import { Empty, Note, Panel, Row } from "@/components/dash/parts";
import { TimetableCalendar } from "@/components/calendar/TimetableCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BLOCKS, type Block, blockLabel, DAYS, dayLabel, formatDate, todayIso } from "@/lib/kabuslotin";

type StaffRole = "lecturer" | "dean" | "it_support";

export function AdminDash() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);

  function fail(e: Error) {
    setInfo(null);
    setError(e.message.replace(/^.*?:\s*/, ""));
  }
  function ok(message: string, keys: string[]) {
    setError(null);
    setInfo(message);
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
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

  // Mints a real login for an approved email with the common starting
  // password. The server function checks the caller is the Administrator and
  // takes the role from the approved lists; profiles and roles are built by
  // the sign-up trigger automatically.
  const createLogin = useMutation({
    mutationFn: async (input: { email: string; fullName?: string | null }) => {
      const { data, error: e } = await supabase.functions.invoke("create-approved-user", {
        body: { email: input.email, fullName: input.fullName ?? undefined },
      });
      if (e) {
        const message =
          (data as { error?: string } | null)?.error ??
          (e as { message?: string }).message ??
          "Could not create that login.";
        throw new Error(message);
      }
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }
    },
    onSuccess: (_d, input) =>
      ok(`Login created for ${input.email} — they sign in with the common password.`, []),
    onError: fail,
  });

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
      {error && <Note tone="error">{error}</Note>}
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
        <Panel title="Approved staff emails" description="Type the name and email, then Approve. The account always takes the name written here, even if you add the person in the Supabase dashboard (which has no name box). Create login makes the account with the common password.">
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
                      <Button
                        size="sm"
                        variant="brandOutline"
                        disabled={createLogin.isPending}
                        onClick={() => createLogin.mutate({ email: s.email, fullName: s.full_name })}
                      >
                        Create login
                      </Button>
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

        <Panel title="Approved student emails" description="Type the name and email, then Approve. The account always takes the name written here, even if you add the person in the Supabase dashboard (which has no name box). Create login makes the account with the common password.">
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
                      <Button
                        size="sm"
                        variant="brandOutline"
                        disabled={createLogin.isPending}
                        onClick={() => createLogin.mutate({ email: s.email, fullName: s.full_name })}
                      >
                        Create login
                      </Button>
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

        <Panel title="Teacher applications" description="Teachers who asked for a login on the Create account page. Approve adds them as a lecturer with the name they typed; Dismiss says no. After approving, press Create login on the staff list to give them the common password.">
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
    </div>
  );
}
