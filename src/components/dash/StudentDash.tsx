import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Empty, Note, Panel, Row, StatusPill } from "@/components/dash/parts";
import { StaffPhoto } from "@/components/dash/StaffPhoto";
import { TimetableCalendar } from "@/components/calendar/TimetableCalendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { allowAction } from "@/lib/auth.functions";
import { addToOutbox, describeOutboxItem, flushOutbox, isNetworkError, readOutbox, type OutboxItem } from "@/lib/outbox";
import {
  BLOCKS,
  type Block,
  type BusyRange,
  appointmentTime,
  blockLabel,
  durationLabel,
  fittingDurations,
  formatDate,
  freeStarts,
  isChapel,
  isoDow,
  minutesToClock,
  nextWeekdays,
  todayIso,
} from "@/lib/kabuslotin";

const LISTING_PREFIX = "listing:";

export function StudentDash({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [lecturerId, setLecturerId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ date: string; block: Block } | null>(null);
  const [duration, setDuration] = useState(30);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [refusals, setRefusals] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const sync = () => setOutbox(readOutbox(userId));
    const flush = async () => {
      const msgs = await flushOutbox(userId);
      if (msgs.length)
        setRefusals((r) => [...r, ...msgs.map((text) => ({ id: crypto.randomUUID(), text }))]);
      sync();
      void qc.invalidateQueries({ queryKey: ["my-appointments"] });
      void qc.invalidateQueries({ queryKey: ["busy"] });
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
      // The database only lets a student read lecturer profiles (plus their own), so this is the lecturer list.
      // Do not look people up through user_roles here: students may only read their own role row, which
      // made this list come back empty.
      const [active, listed] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, title, department, bio, photo_url, office_location")
          .neq("id", userId)
          .order("full_name"),
        supabase
          .from("staff_listings")
          .select("id, full_name, title, department, bio, photo_url, office_location, user_id, classes")
          .is("user_id", null),
      ]);
      if (active.error) throw active.error;
      const rows = (active.data ?? []).map((p) => ({ ...p, activated: true }));
      const pending = (listed.data ?? []).map((l) => ({
        id: `${LISTING_PREFIX}${l.id}`,
        full_name: l.full_name,
        title: l.title,
        department: l.department,
        bio: l.bio,
        photo_url: l.photo_url,
        office_location: l.office_location,
        activated: false,
        classes: Array.isArray(l.classes)
          ? (l.classes as { day_of_week: number; block: string }[])
          : [],
      }));
      return [...rows, ...pending].sort((x, y) => x.full_name.localeCompare(y.full_name));
    },
  });

  const isListing = !!lecturerId?.startsWith(LISTING_PREFIX);
  const listingId = isListing ? lecturerId!.slice(LISTING_PREFIX.length) : null;
  const accountId = isListing ? null : lecturerId;

  const availability = useQuery({
    enabled: !!lecturerId && !isListing,
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

  // Times already taken (never who took them), so students only see what is really still free.
  const busy = useQuery({
    enabled: !!lecturerId,
    queryKey: ["busy", lecturerId],
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("busy_times", {
        _lecturer_id: accountId,
        _listing_id: listingId,
      });
      if (e) throw e;
      return (data ?? []) as BusyRange[];
    },
  });
  const busyRanges: BusyRange[] = busy.data ?? [];

  const mine = useQuery({
    queryKey: ["my-appointments", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, lecturer_id, listing_id, appt_date, block, start_time, duration_minutes, status")
        .order("appt_date", { ascending: false });
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.lecturer_id).filter((id): id is string => !!id))];
      const listIds = [...new Set(rows.map((r) => r.listing_id).filter((id): id is string => !!id))];
      const [names, listed] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] }),
        listIds.length ? supabase.from("staff_listings").select("id, full_name").in("id", listIds) : Promise.resolve({ data: [] }),
      ]);
      return rows.map((r) => ({
        ...r,
        waiting: !r.lecturer_id,
        lecturer:
          (r.lecturer_id
            ? names.data?.find((n) => n.id === r.lecturer_id)?.full_name
            : listed.data?.find((n) => n.id === r.listing_id)?.full_name) ?? "Lecturer",
      }));
    },
  });

  // What the student has chosen inside the free block they clicked.
  const lengths = slot ? fittingDurations(slot.date, slot.block, busyRanges) : [];
  const chosenDuration = lengths.some((d) => d.minutes === duration) ? duration : (lengths[0]?.minutes ?? null);
  const starts = slot && chosenDuration ? freeStarts(slot.date, slot.block, chosenDuration, busyRanges) : [];
  const chosenStart = startMin !== null && starts.includes(startMin) ? startMin : (starts[0] ?? null);
  const ready = !!slot && chosenDuration !== null && chosenStart !== null && reason.trim().length >= 5;

  const book = useMutation({
    mutationFn: async () => {
      if (!lecturerId || !slot || chosenStart === null || chosenDuration === null) throw new Error("Pick a time first.");
      const startTime = minutesToClock(chosenStart);
      const queue = () => {
        addToOutbox(userId, {
          id: crypto.randomUUID(),
          kind: "book",
          createdAt: new Date().toISOString(),
          lecturerId: accountId,
          listingId,
          lecturer: lecturers.data?.find((l) => l.id === lecturerId)?.full_name ?? "Lecturer",
          date: slot.date,
          block: slot.block,
          startTime,
          durationMinutes: chosenDuration,
          reason: reason.trim(),
        });
        return "saved" as const;
      };
      if (!navigator.onLine) return queue();
      try {
        if (!(await allowAction("booking"))) throw new Error("Too many requests. Try again in 15 minutes.");
        const { error: e } = await supabase.rpc("book_appointment_slot", {
          _lecturer_id: accountId,
          _listing_id: listingId,
          _appt_date: slot.date,
          _block: slot.block,
          _start_time: startTime,
          _duration_minutes: chosenDuration,
          _reason: reason.trim(),
        });
        if (e) {
          if (/could not find the function|schema cache/i.test(e.message)) {
            throw new Error("Booking needs the latest database update. Ask the administrator to apply it, then try again.");
          }
          throw e;
        }
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
      setStartMin(null);
      void qc.invalidateQueries({ queryKey: ["my-appointments"] });
      void qc.invalidateQueries({ queryKey: ["busy"] });
    },
    onError: (e: Error) => {
      setSent(false);
      setSaved(false);
      setError(e.message.replace(/^.*?:\s*/, ""));
      void qc.invalidateQueries({ queryKey: ["busy"] });
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-appointments"] });
      void qc.invalidateQueries({ queryKey: ["busy"] });
    },
  });

  const days = nextWeekdays(10);
  const a = availability.data;
  const sel = lecturers.data?.find((l) => l.id === lecturerId);
  const today = todayIso();
  // Upcoming and still-waiting requests first (soonest at the top), the
  // history afterwards — so a pending request is never buried under old rows.
  const mineRows = mine.data ?? [];
  const sortedMine = [...mineRows].sort((x, y) => {
    const upcoming = (r: (typeof mineRows)[number]) => r.status === "pending" && r.appt_date >= today;
    if (upcoming(x) !== upcoming(y)) return upcoming(x) ? -1 : 1;
    if (upcoming(x) && upcoming(y)) return x.appt_date.localeCompare(y.appt_date);
    return y.appt_date.localeCompare(x.appt_date);
  });
  function openBlocks(date: string): Block[] {
    // Free means exactly the lecturer's timetabled window that day, plus any
    // make-up / exam time they added — never Chapel, never outside semester.
    // Mirrors private.slot_is_free in the database: anything shown green here
    // must be accepted at booking time.
    if (sel && !sel.activated) {
      const order = BLOCKS.map((b) => b.value);
      const classes = (
        (sel as { classes?: { day_of_week: number; block: string }[] }).classes ?? []
      )
        .filter((c) => c.day_of_week === isoDow(date) && !isChapel(date, c.block as Block))
        .map((c) => c.block as Block);
      return order.filter((b) => classes.includes(b));
    }
    if (!a) return [];
    if (a.semester && (date < a.semester.start_date || date > a.semester.end_date)) return [];
    const dow = isoDow(date);
    const tabled = a.timetable
      .filter((t) => t.day_of_week === dow && !isChapel(date, t.block as Block))
      .map((t) => t.block as Block);
    const extras = [
      ...a.makeups.filter((m) => m.session_date === date).map((m) => m.block as Block),
      ...a.exams.filter((x) => x.exam_date === date).map((x) => x.block as Block),
    ].filter((b) => !isChapel(date, b));
    const order = BLOCKS.map((b) => b.value);
    return order.filter((b) => tabled.includes(b) || extras.includes(b));
  }


  const selected = lecturers.data?.find((l) => l.id === lecturerId);
  const loadingTimes = !!selected && selected.activated && availability.isLoading;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start">
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
                    setStartMin(null);
                    setSent(false);
                    setSaved(false);
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
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold leading-snug text-brand-ink">
                        {l.title ? `${l.title} ` : ""}
                        {l.full_name}
                      </span>
                      <span className="mt-0.5 block break-words text-xs leading-snug text-muted-foreground">
                        {[l.department, l.office_location].filter(Boolean).join(" · ") ||
                          "School of Law"}
                        {!l.activated && " · Not yet signed in"}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="min-w-0 space-y-5">
        <Panel
          title={selected ? `Request time with ${selected.full_name}` : "Request an appointment"}
          description="Tap a green time, choose how long you need, then press Book."
        >
          {!selected ? (
            <Empty>Choose a lecturer on the left.</Empty>
          ) : (
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
              {selected.bio && <p className="text-sm text-muted-foreground">{selected.bio}</p>}
              {!selected.activated && (
                <Note>
                  This lecturer hasn't signed in yet. You can still book a green time: they will see
                  your request as soon as they sign in for the first time.
                </Note>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-primary" /> Available — tap a time
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-destructive" /> Not available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-muted ring-1 ring-border" /> Fully booked
                </span>
              </div>

              {loadingTimes ? (
                <Empty>Loading their free times…</Empty>
              ) : (
                <div className="space-y-2">
                  {days.map((d) => {
                    const open = openBlocks(d);
                    return (
                      <div
                        key={d}
                        className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 ${
                          open.length === 0 ? "bg-destructive/5 ring-1 ring-destructive/30" : ""
                        }`}
                      >
                        <span className="w-28 text-sm text-muted-foreground">
                          {formatDate(d)}
                        </span>
                        {open.length === 0
                          ? <span className="text-xs font-medium text-destructive">Not available</span>
                          : open.map((b) => {
                              const room = freeStarts(d, b, 15, busyRanges);
                              const partlyTaken = busyRanges.some((x) => x.appt_date === d && x.block === b);
                              const chosen = slot?.date === d && slot.block === b;
                              if (!room.length) {
                                return (
                                  <span
                                    key={b}
                                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground line-through"
                                  >
                                    {blockLabel(b)}
                                  </span>
                                );
                              }
                              return (
                                <button
                                  key={b}
                                  type="button"
                                  aria-pressed={chosen}
                                  onClick={() => {
                                    setSlot({ date: d, block: b });
                                    setStartMin(null);
                                    setSent(false);
                                    setSaved(false);
                                    setError(null);
                                  }}
                                  className={`rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    chosen ? "ring-2 ring-brand-ink ring-offset-2 ring-offset-background" : ""
                                  }`}
                                >
                                  {chosen && "✓ "}
                                  {blockLabel(b)}
                                  {partlyTaken && " · part taken"}
                                </button>
                              );
                            })}
                      </div>
                    );
                  })}
                </div>
              )}

              {slot && (
                <div className="space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-brand-ink">
                    {formatDate(slot.date)} · free {blockLabel(slot.block)}
                  </p>

                  <div className="space-y-1.5">
                    <Label>How long do you need?</Label>
                    <div className="flex flex-wrap gap-2">
                      {lengths.map((d) => (
                        <button
                          key={d.minutes}
                          type="button"
                          aria-pressed={chosenDuration === d.minutes}
                          onClick={() => setDuration(d.minutes)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            chosenDuration === d.minutes
                              ? "border-brand-ink bg-brand-ink text-background"
                              : "border-border bg-background hover:border-primary"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="start-time">Start time</Label>
                    <select
                      id="start-time"
                      value={chosenStart ?? ""}
                      onChange={(e) => setStartMin(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
                    >
                      {starts.map((s) => (
                        <option key={s} value={s}>
                          {minutesToClock(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {chosenStart !== null && chosenDuration !== null ? (
                    <p className="text-sm">
                      Your appointment:{" "}
                      <strong className="text-brand-ink">
                        {minutesToClock(chosenStart)} – {minutesToClock(chosenStart + chosenDuration)}
                      </strong>{" "}
                      ({durationLabel(chosenDuration)})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nothing is left in this period. Please choose another green time.
                    </p>
                  )}
                </div>
              )}

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
              {sent && (
                <Note>
                  {selected.activated
                    ? "Your request has been sent. You'll see the answer below."
                    : "Your request has been sent. This lecturer will see it as soon as they sign in for the first time."}
                </Note>
              )}
              {saved && (
                <Note>
                  You're offline, so your request is saved on this device. It will be sent
                  automatically as soon as you're connected again.
                </Note>
              )}

              <Button
                variant="hero"
                size="lg"
                className="w-full sm:w-auto"
                disabled={!ready || book.isPending}
                onClick={() => book.mutate()}
              >
                {book.isPending ? "Booking…" : "Book appointment"}
              </Button>
              {!book.isPending && !ready && (
                <p className="text-xs text-muted-foreground">
                  {!slot
                    ? "Tap one of the green times above to choose it."
                    : chosenStart === null
                      ? "Choose another green time."
                      : "Write a short reason (at least 5 characters) to enable booking."}
                </p>
              )}
            </div>
          )}
        </Panel>

        {(outbox.length > 0 || refusals.length > 0) && (
          <Panel title="Waiting to send" description="Saved while offline. These go out automatically once you reconnect.">
            <ul className="space-y-2">
              {outbox.map((o) => (
                <Row key={o.id}>
                  <span>
                    {o.kind === "book"
                      ? `Request to ${o.lecturer} · ${formatDate(o.date)} · ${appointmentTime(o.block, o.startTime, o.durationMinutes)}`
                      : describeOutboxItem(o)}
                  </span>
                  <span className="text-xs text-muted-foreground">Waiting for connection</span>
                </Row>
              ))}
            </ul>
            {refusals.map((m) => (
              <Row key={m.id}>
                <Note tone="error">{m.text}</Note>
                <Button size="sm" variant="ghost" onClick={() => setRefusals((r) => r.filter((x) => x.id !== m.id))}>
                  Dismiss
                </Button>
              </Row>
            ))}
          </Panel>
        )}

        <Panel title="My appointments" description="Only your own requests appear here.">
          {!sortedMine.length ? (
            <Empty>You have not requested any appointments yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {sortedMine.map((r) => {
                const cancelable = r.status === "pending" && r.appt_date >= today && !cancel.isPending;
                return (
                  <Row key={r.id}>
                    <span>
                      <strong className="text-brand-ink">{r.lecturer}</strong> ·{" "}
                      {formatDate(r.appt_date)} · {appointmentTime(r.block, r.start_time, r.duration_minutes)}
                      {r.waiting && r.status === "pending" && (
                        <span className="block text-xs text-muted-foreground">
                          Waiting for the lecturer to sign in for the first time.
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      {cancelable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm("Cancel this request? This cannot be undone."))
                              cancel.mutate(r.id);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </span>
                  </Row>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Weekly Timetable" description="School of Law teaching timetable for the active semester.">
          <TimetableCalendar />
        </Panel>
      </div>
    </div>
  );
}
