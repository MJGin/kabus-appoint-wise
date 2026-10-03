import { supabase } from "@/integrations/supabase/client";
import { consumeActionRateLimit } from "@/lib/auth.functions";
import type { Block } from "@/lib/kabuslotin";

export type OutboxItem =
  | { id: string; kind: "book"; createdAt: string; lecturerId: string; lecturer: string; date: string; block: Block; reason: string }
  | { id: string; kind: "cancel"; createdAt: string; appointmentId: string };

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
        } else {
          const { error } = await supabase.rpc("cancel_appointment", { _appointment_id: item.appointmentId });
          if (error) refusals.push(`A cancellation was not accepted: ${error.message}`);
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
