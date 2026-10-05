import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Camera } from "lucide-react";

import { Empty, Note, Panel, Row, StatusPill } from "@/components/dash/parts";
import { StaffPhoto } from "@/components/dash/StaffPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { consumeActionRateLimit } from "@/lib/auth.functions";
import {
  addToOutbox,
  describeOutboxItem,
  flushOutbox,
  isNetworkError,
  readOutbox,
  type OutboxItem,
} from "@/lib/outbox";
import {
  BLOCKS,
  type Block,
  blockLabel,
  dayLabel,
  formatDate,
  todayIso,
} from "@/lib/kabuslotin";

export function LecturerDash({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [refusals, setRefusals] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setOutbox(readOutbox(userId));
    const flush = async () => {
      const msgs = await flushOutbox(userId);
      if (msgs.length) setRefusals((r) => [...r, ...msgs]);
      sync();
      void qc.invalidateQueries({ queryKey: ["requests", userId] });
      void qc.invalidateQueries({ queryKey: ["makeups", userId] });
    };
    sync();
    void flush();
    window.addEventListener("online", flush);
    window.addEventListener("kabu-outbox", sync);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("kabu-outbox", sync);
    };
  }, [userId, qc]);

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const timetable = useQuery({
    queryKey: ["my-timetable", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("timetable_slots")
        .select("id, unit_code, unit_name, year_group, day_of_week, block")
        .eq("lecturer_id", userId)
        .order("day_of_week");
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["requests", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, student_id, appt_date, block, status")
        .eq("lecturer_id", userId)
        .order("appt_date", { ascending: false });
      const rows = data ?? [];
      const ids = rows.map((r) => r.id);
      const [reasons, students] = await Promise.all([
        ids.length
          ? supabase.from("appointment_reasons").select("appointment_id, reason").in("appointment_id", ids)
          : Promise.resolve({ data: [] as { appointment_id: string; reason: string }[] }),
        rows.length
          ? supabase
              .from("profiles")
              .select("id, full_name, reg_number")
              .in("id", [...new Set(rows.map((r) => r.student_id))])
          : Promise.resolve({ data: [] as { id: string; full_name: string; reg_number: string | null }[] }),
      ]);
      return rows.map((r) => ({
        ...r,
        reason: reasons.data?.find((x) => x.appointment_id === r.id)?.reason ?? "",
        student: students.data?.find((s) => s.id === r.student_id),
      }));
    },
  });

  const makeups = useQuery({
    queryKey: ["makeups", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("makeup_sessions")
        .select("id, session_date, block, note")
        .eq("lecturer_id", userId)
        .order("session_date");
      return data ?? [];
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (values: {
      full_name: string;
      title: string;
      department: string;
      office_location: string;
      photo_url: string;
      bio: string;
    }) => {
      const { error: e } = await supabase.from("profiles").update(values).eq("id", userId);
      if (e) throw e;
    },
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) throw new Error("That photo is larger than 5 MB.");
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${userId}/photo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("staff-photos").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const { error: e } = await supabase.from("profiles").update({ photo_url: path }).eq("id", userId);
      if (e) throw e;
      return path;
    },
    onSuccess: (path) => {
      setPhotoPath(path);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["profile", userId] });
      void qc.invalidateQueries({ queryKey: ["lecturers"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const queue = (item: OutboxItem) => {
    addToOutbox(userId, item);
    setError(null);
  };
  const stamp = () => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString() });

  const decide = useMutation({
    mutationFn: async (args: {
      id: string;
      student: string;
      decision: "accepted" | "declined";
      date?: string;
      block?: Block;
    }) => {
      const save = () =>
        queue({
          ...stamp(),
          kind: "decide",
          appointmentId: args.id,
          student: args.student,
          decision: args.decision,
          ...(args.date ? { date: args.date } : {}),
          ...(args.block ? { block: args.block } : {}),
        });
      if (!navigator.onLine) return save();
      try {
        const limit = await consumeActionRateLimit({ data: { action: "reschedule" } });
        if (!limit.allowed) throw new Error("Too many changes. Try again in 15 minutes.");
        const { error: e } = await supabase.rpc("decide_appointment", {
          _appointment_id: args.id,
          _decision: args.decision,
          ...(args.date ? { _new_date: args.date } : {}),
          ...(args.block ? { _new_block: args.block } : {}),
        });
        if (e) throw e;
      } catch (err) {
        if (isNetworkError(err)) return save();
        throw err;
      }
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["requests", userId] });
    },
    onError: (e: Error) => setError(e.message.replace(/^.*?:\s*/, "")),
  });

  const addMakeup = useMutation({
    mutationFn: async (values: { session_date: string; block: Block; note: string }) => {
      const save = () =>
        queue({ ...stamp(), kind: "makeup_add", lecturerId: userId, date: values.session_date, block: values.block, note: values.note });
      if (!navigator.onLine) return save();
      try {
        const { error: e } = await supabase
          .from("makeup_sessions")
          .insert({ ...values, lecturer_id: userId });
        if (e) throw e;
      } catch (err) {
        if (isNetworkError(err)) return save();
        throw err;
      }
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["makeups", userId] });
    },
    onError: (e: Error) => setError(e.message.replace(/^.*?:\s*/, "")),
  });

  const removeMakeup = useMutation({
    mutationFn: async (id: string) => {
      const save = () => queue({ ...stamp(), kind: "makeup_remove", makeupId: id });
      if (!navigator.onLine) return save();
      try {
        const { error: e } = await supabase.from("makeup_sessions").delete().eq("id", id);
        if (e) throw e;
      } catch (err) {
        if (isNetworkError(err)) return save();
        throw err;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["makeups", userId] }),
    onError: (e: Error) => setError(e.message.replace(/^.*?:\s*/, "")),
  });

  return (
    <div className="space-y-5">
      {error && <Note tone="error">{error}</Note>}

      {(outbox.length > 0 || refusals.length > 0) && (
        <Panel title="Waiting to send" description="Saved while offline. These go out automatically once you reconnect.">
          <ul className="space-y-2">
            {outbox.map((o) => (
              <Row key={o.id}>
                <span>{describeOutboxItem(o)}</span>
                <span className="text-xs text-muted-foreground">Waiting for connection</span>
              </Row>
            ))}
          </ul>
          {refusals.map((m, i) => (
            <Note key={i} tone="error">{m}</Note>
          ))}
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel title="My profile" description="Students see this when they choose a lecturer.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              saveProfile.mutate({
                full_name: String(f.get("full_name") ?? ""),
                title: String(f.get("title") ?? ""),
                department: String(f.get("department") ?? ""),
                office_location: String(f.get("office_location") ?? ""),
                photo_url: String(f.get("photo_url") ?? ""),
                bio: String(f.get("bio") ?? ""),
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" defaultValue={profile.data?.full_name ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={profile.data?.title ?? ""} placeholder="Dr." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" defaultValue={profile.data?.department ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="office_location">Office</Label>
                <Input
                  id="office_location"
                  name="office_location"
                  defaultValue={profile.data?.office_location ?? ""}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="group relative cursor-pointer" title="Upload a photo">
                <StaffPhoto path={photoPath ?? profile.data?.photo_url} name={profile.data?.full_name ?? "Me"} size={80} />
                <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Camera className="h-4 w-4" aria-hidden />
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPhoto.mutate(file);
                  }}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                {uploadPhoto.isPending ? "Uploading…" : "Tap your picture to upload a new photo (up to 5 MB)."}
              </p>
            </div>
            <input type="hidden" name="photo_url" value={photoPath ?? profile.data?.photo_url ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor="bio">About</Label>
              <Textarea id="bio" name="bio" rows={3} defaultValue={profile.data?.bio ?? ""} />
            </div>
            {saved && <Note>Profile saved.</Note>}
            <Button type="submit" variant="hero" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Panel>

        <Panel title="My teaching times" description="Set by the Administrator's timetable.">
          {!timetable.data?.length ? (
            <Empty>No timetable has been uploaded for you yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {timetable.data.map((t) => (
                <Row key={t.id}>
                  <span>
                    <strong className="text-brand-ink">{t.unit_code}</strong> {t.unit_name} · Year{" "}
                    {t.year_group}
                  </span>
                  <span className="text-muted-foreground">
                    {dayLabel(t.day_of_week)} · {blockLabel(t.block)}
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Appointment requests" description="Student name and reason, for you only.">
        {!requests.data?.length ? (
          <Empty>No student has asked for time with you yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {requests.data.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-ink">
                    {r.student?.full_name ?? "Student"}{" "}
                    <span className="font-normal text-muted-foreground">
                      {r.student?.reg_number ?? ""}
                    </span>
                  </p>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(r.appt_date)} · {blockLabel(r.block)}
                </p>
                {r.reason && <p className="mt-2 text-sm">{r.reason}</p>}
                {(r.status === "pending" || r.status === "accepted") && (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const date = String(f.get("date") ?? "");
                      const block = String(f.get("block") ?? "") as Block;
                      decide.mutate({
                        id: r.id,
                        student: r.student?.full_name || "a student",
                        decision: "accepted",
                        ...(date && block ? { date, block } : {}),
                      });
                    }}
                  >
                    {r.status === "pending" && (
                      <Button type="submit" size="sm" variant="brand">
                        Accept
                      </Button>
                    )}
                    <input
                      type="date"
                      name="date"
                      min={todayIso()}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <select
                      name="block"
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Move to…</option>
                      {BLOCKS.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="brandOutline">
                      Reschedule
                    </Button>
                    {r.status === "pending" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => decide.mutate({ id: r.id, student: r.student?.full_name || "a student", decision: "declined" })}
                      >
                        Decline
                      </Button>
                    )}
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Make-up sessions" description="Extra availability outside the timetable.">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            addMakeup.mutate({
              session_date: String(f.get("session_date") ?? ""),
              block: String(f.get("block") ?? "block_1") as Block,
              note: String(f.get("note") ?? ""),
            });
            form.reset();
          }}
        >
          <input
            type="date"
            name="session_date"
            required
            min={todayIso()}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <select
            name="block"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {BLOCKS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <Input name="note" placeholder="Note (optional)" className="h-9 w-48" />
          <Button type="submit" size="sm" variant="brand">
            Add
          </Button>
        </form>
        <div className="mt-4">
          {!makeups.data?.length ? (
            <Empty>No make-up sessions added.</Empty>
          ) : (
            <ul className="space-y-2">
              {makeups.data.map((m) => (
                <Row key={m.id}>
                  <span>
                    {formatDate(m.session_date)} · {blockLabel(m.block)}{" "}
                    <span className="text-muted-foreground">{m.note}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeMakeup.mutate(m.id)}>
                    Remove
                  </Button>
                </Row>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
