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

/**
 * School of Law registration numbers look like:
 *   LAW/M/REG NO/MONTH/YEAR
 * e.g. LAW/M/1178/05/26 — admitted May (05) 2026 (26).
 */
export const REG_PATTERN = /^LAW\/M\/\d{1,6}\/(0[1-9]|1[0-2])\/\d{2}$/i;
export const STAFF_EMAIL = /@kabarak\.ac\.ke$/i;

/**
 * Students sign in with their registration number. It is mapped to a stable
 * internal address so the same number always resolves to the same account.
 */
export function regToEmail(reg: string) {
  const slug = reg.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `${slug.toLowerCase()}@students.kabarak.ac.ke`;
}

const REG_TO_EMAIL: Record<string, string> = {
  "LAW/M/1178/05/26": "njugunal@kabarak.ac.ke",
  "LAW/M/1179/05/26": "chepchumbab@kabarak.ac.ke",
  "LAW/M/1180/05/26": "ndung'u@kabarak.ac.ke",
  "LAW/M/1181/05/26": "elikiprotich@kabarak.ac.ke",
  "LAW/M/1182/05/26": "mmokeira@kabarak.ac.ke",
};

export function identifierToEmail(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();
  const upper = value.toUpperCase();
  return REG_TO_EMAIL[upper] ?? regToEmail(value);
}

export const GENERIC_AUTH_ERROR =
  "Those sign-in details were not accepted. Check them and try again.";
