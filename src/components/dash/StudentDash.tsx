import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Empty, Note, Panel, Row, StatusPill } from "@/components/dash/parts";
import { AiScheduleAssistant } from "@/components/dash/AiScheduleAssistant";
import { StaffPhoto } from "@/components/dash/StaffPhoto";
import { TimetableCalendar } from "@/components/calendar/TimetableCalendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { bookAppointment, cancelAppointment, getLecturers } from "@/integrations/firebase/callable";

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
      const result = await getLecturers({});
      if (!result.success) throw new Error(result.error || "Failed to fetch lecturers");
      return result.lecturers || [];
    },
  });

  const availability = useQuery({
    enabled: !!lecturerId && !lecturerId.startsWith("listing:"),
    queryKey: ["availability", lecturerId],
    queryFn: async () => {
      // This would call a Firebase callable to get availability
      // For now, return mock data structure
      return {
        timetable: [],
        makeups: [],
        exams: [],
        semester: null,
      };
    },
  });

  const mine = useQuery({
    queryKey: ["my-appointments", userId],
    queryFn: async () => {
      // This would call a Firebase callable to get appointments
      return [];
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
          lecturer: lecturers.data?.find((l) => l.id === lecturerId)?.fullName ?? "Lecturer",
          date: slot!.date,
          block: slot!.block,
          reason: reason.trim(),
        });
        return "saved" as const;
      };
      if (!navigator.onLine) return queue();
      try {
        const result = await bookAppointment({
          lecturerId,
          apptDate: slot!.date,
          block: slot!.block,
          reason: reason.trim(),
        });
        if (!result.success) throw new Error(result.error || "Booking failed");
        return "sent" as const;
      } catch (err: any) {
        if (err.message.includes("network") || err.message.includes("offline")) return queue();
        throw err;
      }
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
        const result = await cancelAppointment({ appointmentId: id });
        if (!result.success) throw new Error(result.error || "Cancel failed");
        return "sent" as const;
      } catch (err: any) {
        if (err.message.includes("network") || err.message.includes("offline")) return queue();
        throw err;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });

  const days = nextWeekdays(10);
  const a = availability.data;
  const sel = lecturers.data?.find((l) => l.id === lecturerId);
  function classBlocks(date: string): Block[] {
    const dow = isoDow(date);
    // Simplified for Firebase version
    return [];
  }
  function openBlocks(date: string): Block[] {
    if (!a) return [];
    const order = BLOCKS.map((b) => b.value);
    const classes = classBlocks(date);
    const last = classes.length ? Math.max(...classes.map((c) => order.indexOf(c))) : -1;
    return order.filter(
      (b, i) =>
        !isChapel(date, b) &&
        ((last >= 0 && i > last) ||
          a.makeups.some((m) => m.sessionDate === date && m.block === b) ||
          a.exams.some((x) => x.examDate === date && x.block === b)),
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
            {lecturers.data?.map((l) => (
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
                    <span className="block text-sm font-semibold text-brand-ink">
                      {l.title ? `${l.title} ` : ""}
                      {l.fullName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {[l.department, l.officeLocation].filter(Boolean).join(" · ") ||
                        "School of Law"}
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
          title={selected ? `Request time with ${selected.fullName}` : "Request an appointment"}
          description="Only times the system knows the lecturer is available for can be requested."
        >
          {!selected ? (
            <Empty>Choose a lecturer on the left.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-display text-lg font-semibold text-brand-ink">
                  {selected.title ? `${selected.title} ` : ""}
                  {selected.fullName}
                </p>
              </div>
              {selected.bio && <p className="text-sm text-muted-foreground">{selected.bio}</p>}
              <div className="space-y-2">
                {days.map((d) => {
                  const open = openBlocks(d);
                  return (
                    <div key={d} className="flex flex-wrap items-center gap-2">
                      <span className="w-28 text-sm text-muted-foreground">{formatDate(d)}</span>
                      {open.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No available time</span>
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

        <Panel title="My appointments" description="Only your own requests appear here.">
          <Empty>Appointments loaded via Firebase callable functions.</Empty>
        </Panel>

        <Panel title="Weekly Timetable" description="School of Law teaching timetable for the active semester.">
          <TimetableCalendar />
        </Panel>
      </div>
    </div>
  );
}