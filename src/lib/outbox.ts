import { supabase } from "@/integrations/supabase/client";
import { consumeActionRateLimit } from "@/lib/auth.functions";
import type { Block } from "@/lib/kabuslotin";

export type OutboxItem =
  | { id: string; kind: "book"; createdAt: string; lecturerId: string; lecturer: string; date: string; block: Block; reason: string }
  | { id: string; kind: "cancel"; createdAt: string; appointmentId: string }
  | {
      id: string;
      kind: "decide";
      createdAt: string;
      appointmentId: string;
      student: string;
      decision: "accepted" | "declined";
      date?: string;
      block?: Block;
    }
  | { id: string; kind: "makeup_add"; createdAt: string; lecturerId: string; date: string; block: Block; note: string }
  | { id: string; kind: "makeup_remove"; createdAt: string; makeupId: string };

export function describeOutboxItem(o: OutboxItem): string {
  switch (o.kind) {
    case "book":
      return `Request to ${o.lecturer} · ${o.date}`;
    case "cancel":
      return "Cancellation of a pending request";
    case "decide":
      return o.decision === "declined"
        ? `Decline ${o.student}`
        : o.date
          ? `Move ${o.student} to ${o.date}`
          : `Accept ${o.student}`;
    case "makeup_add":
      return `New make-up session · ${o.date}`;
    case "makeup_remove":
      return "Remove a make-up session";
  }
}

const key = (userId: string) => `kabu-outbox:${userId}`;

export function readOutbox(userId: string): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function write(userId: string, items: OutboxItem[]) {
  localStorage.setItem(key(userId), JSON.stringify(items));
  window.dispatchEvent(new Event("kabu-outbox"));
}

export function addToOutbox(userId: string, item: OutboxItem) {
  write(userId, [...readOutbox(userId), item]);
}

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(m);
}

let flushing = false;

/** Sends waiting requests in order. Returns messages for any the system refused. */
export async function flushOutbox(userId: string): Promise<string[]> {
  if (flushing || !navigator.onLine) return [];
  flushing = true;
  const refusals: string[] = [];
  try {
    let items = readOutbox(userId);
    while (items.length) {
      const item = items[0]!;
      try {
        if (item.kind === "book") {
          const limit = await consumeActionRateLimit({ data: { action: "booking" } });
          if (!limit.allowed) break;
          const { error } = await supabase.rpc("book_appointment", {
            _lecturer_id: item.lecturerId,
            _appt_date: item.date,
            _block: item.block,
            _reason: item.reason,
          });
          if (error) refusals.push(`Booking with ${item.lecturer} on ${item.date} was not accepted: ${error.message}`);
        } else if (item.kind === "cancel") {
          const { error } = await supabase.rpc("cancel_appointment", { _appointment_id: item.appointmentId });
          if (error) refusals.push(`A cancellation was not accepted: ${error.message}`);
        } else if (item.kind === "decide") {
          const limit = await consumeActionRateLimit({ data: { action: "reschedule" } });
          if (!limit.allowed) break;
          const { error } = await supabase.rpc("decide_appointment", {
            _appointment_id: item.appointmentId,
            _decision: item.decision,
            ...(item.date ? { _new_date: item.date } : {}),
            ...(item.block ? { _new_block: item.block } : {}),
          });
          if (error) refusals.push(`${describeOutboxItem(item)} was not accepted: ${error.message}`);
        } else if (item.kind === "makeup_add") {
          const { error } = await supabase
            .from("makeup_sessions")
            .insert({ lecturer_id: item.lecturerId, session_date: item.date, block: item.block, note: item.note });
          if (error) refusals.push(`Make-up session on ${item.date} was not accepted: ${error.message}`);
        } else {
          const { error } = await supabase.from("makeup_sessions").delete().eq("id", item.makeupId);
          if (error) refusals.push(`Removing a make-up session was not accepted: ${error.message}`);
        }
      } catch (e) {
        if (isNetworkError(e)) break; // still offline — keep it for later
        refusals.push(e instanceof Error ? e.message : "A saved request could not be sent.");
      }
      items = readOutbox(userId).filter((i) => i.id !== item.id);
      write(userId, items);
    }
  } finally {
    flushing = false;
  }
  return refusals;
}
