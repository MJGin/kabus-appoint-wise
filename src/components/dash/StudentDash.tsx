import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Empty, Note, Panel, Row, StatusPill } from "@/components/dash/parts";
import { AiScheduleAssistant } from "@/components/dash/AiScheduleAssistant";
import { StaffPhoto } from "@/components/dash/StaffPhoto";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { consumeActionRateLimit } from "@/lib/auth.functions";
import { addToOutbox, describeOutboxItem, flushOutbox, isNetworkError, readOutbox, type OutboxItem } from "@/lib/outbox";
import {
  BLOCKS,
  type Block,
  blockLabel,
  formatDate,
  isChapel,
  isoDow,
  nextWeekdays,
} from "@/lib/kabuslotin";

export function StudentDash({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [lecturerId, setLecturerId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ date: string; block: Block } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [refusals, setRefusals] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setOutbox(readOutbox(userId));
    const flush = async () => {
      const msgs = await flushOutbox(userId);
      if (msgs.length) setRefusals((r) => [...r, ...msgs]);
      sync();
      void qc.invalidateQueries({ queryKey: ["my-appointments"] });
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

  const lecturers = useQuery({
    queryKey: ["lecturers"],
    queryFn: async () => {
      const [active, listed] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, title, department, bio, photo_url, office_location")
          .is("reg_number", null)
          .order("full_name"),
        supabase
          .from("staff_listings")
          .select("id, full_name, title, department, bio, photo_url, office_location, user_id")
          .is("user_id", null),
      ]);
      if (active.error) throw active.error;
      const rows = (active.data ?? []).map((p) => ({ ...p, activated: true }));
      const pending = (listed.data ?? []).map((l) => ({
        id: `listing:${l.id}`,
        full_name: l.full_name,
        title: l.title,
        department: l.department,
        bio: l.bio,
        photo_url: l.photo_url,
        office_location: l.office_location,
        activated: false,
      }));
      return [...rows, ...pending].sort((x, y) => x.full_name.localeCompare(y.full_name));
    },
  });

  const availability = useQuery({
    enabled: !!lecturerId && !lecturerId.startsWith("listing:"),
    queryKey: ["availability", lecturerId],
    queryFn: async () => {
      const [timetable, makeups, exams, semester] = await Promise.all([
        supabase.from("timetable_slots").select("day_of_week, block").eq("lecturer_id", lecturerId!),
        supabase.from("makeup_sessions").select("session_date, block").eq("lecturer_id", lecturerId!),
        supabase.from("exam_slots").select("exam_date, block").eq("lecturer_id", lecturerId!),
        supabase.from("semesters").select("start_date, end_date").eq("is_active", true).maybeSingle(),
      ]);
      return {
        timetable: timetable.data ?? [],
        makeups: makeups.data ?? [],
        exams: exams.data ?? [],
        semester: semester.data,
      };
    },
  });

  const mine = useQuery({
    queryKey: ["my-appointments", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, lecturer_id, appt_date, block, status")
        .order("appt_date", { ascending: false });
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.lecturer_id))];
      const names = ids.length
        ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? []
        : [];
      return rows.map((r) => ({
        ...r,
        lecturer: names.find((n) => n.id === r.lecturer_id)?.full_name ?? "Lecturer",
      }));
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!lecturerId || !slot) throw new Error("Pick a time first.");
      const queue = () => {
        addToOutbox(userId, {
          id: crypto.randomUUID(),
          kind: "book",
          createdAt: new Date().toISOString(),
          lecturerId,
          lecturer: lecturers.data?.find((l) => l.id === lecturerId)?.full_name ?? "Lecturer",
          date: slot.date,
          block: slot.block,
          reason: reason.trim(),
        });
        return "saved" as const;
      };
      if (!navigator.onLine) return queue();
      try {
      const limit = await consumeActionRateLimit({ data: { action: "booking" } });
      if (!limit.allowed) throw new Error("Too many requests. Try again in 15 minutes.");
      const { error: e } = await supabase.rpc("book_appointment", {
        _lecturer_id: lecturerId,
        _appt_date: slot.date,
        _block: slot.block,
        _reason: reason.trim(),
      });
      if (e) throw e;
      } catch (err) {
        if (isNetworkError(err)) return queue();
        throw err;
      }
      return "sent" as const;
    },
    onSuccess: (result) => {
      setSent(result === "sent");
      setSaved(result === "saved");
      setError(null);
      setReason("");
      setSlot(null);
      void qc.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (e: Error) => {
      setSent(false);
      setSaved(false);
      setError(e.message.replace(/^.*?:\s*/, ""));
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const queue = () =>
        addToOutbox(userId, { id: crypto.randomUUID(), kind: "cancel", createdAt: new Date().toISOString(), appointmentId: id });
      if (!navigator.onLine) return queue();
      try {
        const { error: e } = await supabase.rpc("cancel_appointment", { _appointment_id: id });
        if (e) throw e;
      } catch (err) {
        if (isNetworkError(err)) return queue();
        throw err;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });

  const days = nextWeekdays(10);
  const a = availability.data;
  function classBlocks(date: string): Block[] {
    if (!a) return [];
    const dow = isoDow(date);
    return a.timetable.filter((t) => t.day_of_week === dow).map((t) => t.block as Block);
  }
  function openBlocks(date: string): Block[] {
    if (!a) return [];
    if (a.semester && (date < a.semester.start_date || date > a.semester.end_date)) return [];
    const order = BLOCKS.map((b) => b.value);
    const classes = classBlocks(date);
    const last = classes.length ? Math.max(...classes.map((c) => order.indexOf(c))) : -1;
    return order.filter(
      (b, i) =>
        !isChapel(date, b) &&
        ((last >= 0 && i > last) ||
          a.makeups.some((m) => m.session_date === date && m.block === b) ||
          a.exams.some((x) => x.exam_date === date && x.block === b)),
    );
  }

  const selected = lecturers.data?.find((l) => l.id === lecturerId);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <Panel title="Lecturers" description="Pick a lecturer to see when they are free.">
        {lecturers.isLoading ? (
          <Empty>Loading…</Empty>
        ) : !lecturers.data?.length ? (
          <Empty>No lecturer profiles are published yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {lecturers.data.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => {
                    setLecturerId(l.id);
                    setSlot(null);
                    setSent(false);
                    setError(null);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    lecturerId === l.id
                      ? "border-primary bg-primary/8"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <StaffPhoto path={l.photo_url} name={l.full_name} size={40} />
                    <span>
                      <span className="block text-sm font-semibold text-brand-ink">
                        {l.title ? `${l.title} ` : ""}
                        {l.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[l.department, l.office_location].filter(Boolean).join(" · ") ||
                          "School of Law"}
                        {!l.activated && " · Not yet activated"}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="space-y-5">
        <Panel
          title={selected ? `Request time with ${selected.full_name}` : "Request an appointment"}
          description="Only times the system knows the lecturer is available for can be requested."
        >
          {!selected ? (
            <Empty>Choose a lecturer on the left.</Empty>
          ) : !selected.activated ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <StaffPhoto path={selected.photo_url} name={selected.full_name} size={72} />
                <div>
                  <p className="font-display text-lg font-semibold text-brand-ink">
                    {selected.title ? `${selected.title} ` : ""}
                    {selected.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[selected.department, selected.office_location].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {selected.bio && <p className="text-sm">{selected.bio}</p>}
              <Note>
                This lecturer hasn't activated his account yet. Booking opens as soon as he signs
                in for the first time.
              </Note>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <StaffPhoto path={selected.photo_url} name={selected.full_name} size={72} />
                <p className="font-display text-lg font-semibold text-brand-ink">
                  {selected.title ? `${selected.title} ` : ""}
                  {selected.full_name}
                </p>
              </div>
              {selected.bio && <p className="text-sm text-muted-foreground">{selected.bio}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-secondary/25 ring-1 ring-secondary/50" /> Teaching day
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-primary" /> Free to book
                </span>
              </div>
              <div className="space-y-2">
                {days.map((d) => {
                  const open = openBlocks(d);
                  const classes = classBlocks(d);
                  return (
                    <div
                      key={d}
                      className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 ${
                        classes.length ? "bg-secondary/15 ring-1 ring-secondary/40" : ""
                      }`}
                    >
                      <span className={`w-28 text-sm ${classes.length ? "font-semibold text-brand-ink" : "text-muted-foreground"}`}>
                        {formatDate(d)}
                      </span>
                      {classes.map((b) => (
                        <span key={`c-${b}`} className="rounded-full bg-secondary/25 px-3 py-1 text-xs font-medium text-brand-ink">
                          In class · {blockLabel(b)}
                        </span>
                      ))}
                      {open.length === 0 ? (
                        !classes.length && <span className="text-xs text-muted-foreground">No available time</span>
                      ) : (
                        open.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setSlot({ date: d, block: b })}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              slot?.date === d && slot.block === b
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:border-primary"
                            }`}
                          >
                            {blockLabel(b)}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason for the appointment (private)</Label>
                <Textarea
                  id="reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly explain what you need to discuss."
                />
                <p className="text-xs text-muted-foreground">
                  Only you and this lecturer can ever read this.
                </p>
              </div>

              {error && <Note tone="error">{error}</Note>}
              {sent && <Note>Your request has been sent. You'll see the answer below.</Note>}
              {saved && (
                <Note>
                  You're offline, so your request is saved on this device. It will be sent
                  automatically as soon as you're connected again.
                </Note>
              )}

              <Button
                variant="hero"
                disabled={!slot || reason.trim().length < 5 || book.isPending}
                onClick={() => book.mutate()}
              >
                {book.isPending ? "Sending…" : "Send request"}
              </Button>
            </div>
          )}
        </Panel>

        <AiScheduleAssistant
          lecturerId={selected?.activated ? lecturerId : null}
          lecturerName={selected?.full_name ?? null}
          disabled={book.isPending}
          onPick={(s) => setSlot({ date: s.date, block: s.block })}
        />

        {(outbox.length > 0 || refusals.length > 0) && (
          <Panel title="Waiting to send" description="Saved while offline. These go out automatically once you reconnect.">
            <ul className="space-y-2">
              {outbox.map((o) => (
                <Row key={o.id}>
                  <span>
                    {o.kind === "book" ? `Request to ${o.lecturer} · ${formatDate(o.date)} · ${blockLabel(o.block)}` : describeOutboxItem(o)}
                  </span>
                  <span className="text-xs text-muted-foreground">Waiting for connection</span>
                </Row>
              ))}
            </ul>
            {refusals.map((m, i) => (
              <Note key={i} tone="error">{m}</Note>
            ))}
          </Panel>
        )}

        <Panel title="My appointments" description="Only your own requests appear here.">
          {!mine.data?.length ? (
            <Empty>You have not requested any appointments yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {mine.data.map((r) => (
                <Row key={r.id}>
                  <span>
                    <strong className="text-brand-ink">{r.lecturer}</strong> ·{" "}
                    {formatDate(r.appt_date)} · {blockLabel(r.block)}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    {r.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>
                        Cancel
                      </Button>
                    )}
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
