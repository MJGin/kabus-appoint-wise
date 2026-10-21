export type Block = "block_1" | "block_2" | "block_3";

export const BLOCKS: { value: Block; label: string }[] = [
  { value: "block_1", label: "08:00 – 11:00" },
  { value: "block_2", label: "11:00 – 14:00" },
  { value: "block_3", label: "14:00 – 17:00" },
];

export const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

export function blockLabel(b: string) {
  return BLOCKS.find((x) => x.value === b)?.label ?? b;
}

export function dayLabel(d: number) {
  return DAYS.find((x) => x.value === d)?.label ?? String(d);
}

/** Wednesday 11:00–14:00 is Chapel. Nothing may ever be placed there. */
export function isChapel(date: string, block: string) {
  const d = new Date(date + "T00:00:00");
  return d.getDay() === 3 && block === "block_2";
}

export function isoDow(date: string) {
  const d = new Date(date + "T00:00:00").getDay();
  return d === 0 ? 7 : d;
}

export function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatMoment(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nextWeekdays(count: number, from = new Date()) {
  const out: string[] = [];
  const cursor = new Date(from);
  while (out.length < count) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Sign-in is by email and password only. Who is a student, staff member or special account is decided by the database from the email. */
export const GENERIC_AUTH_ERROR =
  "Those sign-in details were not accepted. Check them and try again.";

/* ---------- Booking inside a free block: start time + length ---------- */

/** Minutes after midnight at which each 3-hour block starts. */
export const BLOCK_START_MIN: Record<Block, number> = { block_1: 480, block_2: 660, block_3: 840 };
export const BLOCK_LENGTH_MIN = 180;
export const STEP_MIN = 15;

/** Lengths a student can ask for. */
export const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1½ hours" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
];

export function minutesToClock(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "08:30" or "08:30:00" -> 510 */
export function clockToMinutes(t: string) {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export function durationLabel(minutes: number) {
  return DURATIONS.find((d) => d.minutes === minutes)?.label ?? `${minutes} min`;
}

export type BusyRange = { appt_date: string; block: string; start_time: string; duration_minutes: number };

/** Start times (in minutes) at which `duration` minutes fit inside the block without touching a taken time. */
export function freeStarts(date: string, block: Block, duration: number, busy: BusyRange[]): number[] {
  const begin = BLOCK_START_MIN[block];
  const end = begin + BLOCK_LENGTH_MIN;
  const taken = busy
    .filter((b) => b.appt_date === date && b.block === block)
    .map((b) => [clockToMinutes(b.start_time), clockToMinutes(b.start_time) + b.duration_minutes] as const);
  const now = new Date();
  const todayNairobi = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const isToday = date === `${todayNairobi.getFullYear()}-${String(todayNairobi.getMonth() + 1).padStart(2, "0")}-${String(todayNairobi.getDate()).padStart(2, "0")}`;
  const nowMin = todayNairobi.getHours() * 60 + todayNairobi.getMinutes();
  const out: number[] = [];
  for (let s = begin; s + duration <= end; s += STEP_MIN) {
    if (isToday && s <= nowMin) continue;
    if (taken.some(([a, b]) => a < s + duration && s < b)) continue;
    out.push(s);
  }
  return out;
}

/** The lengths that still fit somewhere in this block. */
export function fittingDurations(date: string, block: Block, busy: BusyRange[]) {
  return DURATIONS.filter((d) => freeStarts(date, block, d.minutes, busy).length > 0);
}

/** "14:00 – 14:30 · 30 min" for a booking, or the whole block label for older whole-block bookings. */
export function appointmentTime(block: string, startTime?: string | null, minutes?: number | null) {
  if (!startTime || !minutes) return blockLabel(block);
  const s = clockToMinutes(startTime);
  return `${minutesToClock(s)} – ${minutesToClock(s + minutes)} · ${durationLabel(minutes)}`;
}
