import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const recommendSchema = z.object({
  needs: z.string().min(8).max(800),
  lecturerId: z.string().uuid(),
});

export type SlotCandidate = {
  date: string;
  block: string;
  blockLabel: string;
  dayLabel: string;
};

export type SlotRecommendation = {
  date: string;
  block: string;
  blockLabel: string;
  dayLabel: string;
  score: number;
  reason: string;
};

const AI_GATEWAY_URL =
  process.env.AI_GATEWAY_URL ?? "https://ai-gateway.lovable.dev/v1/chat/completions";
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

/**
 * Student-facing slot recommender.
 * Pulls real open slots (timetable + make-ups + exams, never Chapel),
 * then asks the AI Gateway to rank them against the student's stated needs.
 * Falls back to a local ranking if the gateway is unreachable.
 */
export const recommendSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => recommendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase;

    const { data: lecturer } = await client
      .from("profiles")
      .select("id, full_name, title, department")
      .eq("id", data.lecturerId)
      .maybeSingle();
    if (!lecturer) throw new Error("Lecturer not found.");

    const [timetable, makeups, exams, semester] = await Promise.all([
      client
        .from("timetable_slots")
        .select("day_of_week, block")
        .eq("lecturer_id", data.lecturerId),
      client
        .from("makeup_sessions")
        .select("session_date, block")
        .eq("lecturer_id", data.lecturerId),
      client.from("exam_slots").select("exam_date, block").eq("lecturer_id", data.lecturerId),
      client.from("semesters").select("start_date, end_date").eq("is_active", true).maybeSingle(),
    ]);

    const candidates = buildCandidates({
      timetable: timetable.data ?? [],
      makeups: makeups.data ?? [],
      exams: exams.data ?? [],
      semester: semester.data,
      limit: 18,
    });

    if (!candidates.length) {
      return {
        recommendations: [] as SlotRecommendation[],
        source: "none" as const,
        note: "No open slots for this lecturer in the next two weeks.",
      };
    }

    const lecturerName = [lecturer.title, lecturer.full_name].filter(Boolean).join(" ");

    try {
      const recommendations = await rankWithGateway({
        needs: data.needs,
        lecturerName,
        candidates,
      });
      return { recommendations, source: "ai" as const, note: null as string | null };
    } catch {
      return {
        recommendations: rankLocally(data.needs, candidates),
        source: "local" as const,
        note: "AI Gateway unavailable; ranked locally from open slots.",
      };
    }
  });

function buildCandidates(input: {
  timetable: { day_of_week: number; block: string }[];
  makeups: { session_date: string; block: string }[];
  exams: { exam_date: string; block: string }[];
  semester: { start_date: string; end_date: string } | null;
  limit: number;
}): SlotCandidate[] {
  const days: string[] = [];
  const cursor = new Date();
  while (days.length < 14) {
    const iso = cursor.toISOString().slice(0, 10);
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (dow >= 1 && dow <= 5) days.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }

  const labels: Record<string, string> = {
    block_1: "08:00 – 11:00",
    block_2: "11:00 – 14:00",
    block_3: "14:00 – 17:00",
  };
  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const out: SlotCandidate[] = [];
  for (const date of days) {
    if (input.semester && (date < input.semester.start_date || date > input.semester.end_date)) {
      continue;
    }
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    for (const block of ["block_1", "block_2", "block_3"]) {
      // Chapel: Wednesday 11:00–14:00 is never bookable.
      if (dow === 3 && block === "block_2") continue;
      const open =
        input.timetable.some((t) => t.day_of_week === dow && t.block === block) ||
        input.makeups.some((m) => m.session_date === date && m.block === block) ||
        input.exams.some((x) => x.exam_date === date && x.block === block);
      if (!open) continue;
      out.push({
        date,
        block,
        blockLabel: labels[block] ?? block,
        dayLabel: dayNames[dow] ?? String(dow),
      });
    }
    if (out.length >= input.limit) break;
  }
  return out;
}

async function rankWithGateway(input: {
  needs: string;
  lecturerName: string;
  candidates: SlotCandidate[];
}): Promise<SlotRecommendation[]> {
  if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY missing");

  const slotList = input.candidates
    .map(
      (c, i) =>
        `${i}: ${c.dayLabel} ${c.date} ${c.blockLabel} (${c.block})`,
    )
    .join("\n");

  const system =
    "You schedule law-school appointments. Rank ONLY the provided open slots. " +
    "Never invent times. Prefer earlier slots when the student is urgent; prefer afternoons for flexible/unhurried meetings; " +
    "avoid Wednesday when possible only if a better non-Chapel option exists. " +
    'Reply with JSON: {"picks":[{"index":0,"score":0.9,"reason":"short"}]} with 1 to 3 picks, highest score first.';

  const user = `Student need:\n${input.needs}\n\nLecturer: ${input.lecturerName}\n\nOpen slots:\n${slotList}`;

  const res = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) throw new Error(`AI Gateway ${res.status}`);
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(text) as {
    picks?: { index: number; score: number; reason: string }[];
  };

  return (parsed.picks ?? [])
    .filter((p) => Number.isInteger(p.index) && input.candidates[p.index])
    .slice(0, 3)
    .map((p) => {
      const c = input.candidates[p.index];
      return {
        ...c,
        score: Math.max(0, Math.min(1, Number(p.score) || 0.5)),
        reason: String(p.reason || "Matches your request.").slice(0, 180),
      };
    });
}

function rankLocally(needs: string, candidates: SlotCandidate[]): SlotRecommendation[] {
  const text = needs.toLowerCase();
  const wantsMorning = /morning|early|8|08|before noon/.test(text);
  const wantsAfternoon = /afternoon|later|evening|after 2|after lunch/.test(text);
  const urgent = /urgent|asap|soon|today|tomorrow|quick/.test(text);
  const avoidWednesday = /not wednesday|avoid wednesday|skip wednesday/.test(text);

  return candidates
    .map((c) => {
      let score = 0.55;
      if (urgent) score += c.date <= nextIso(3) ? 0.25 : 0;
      if (wantsMorning && c.block === "block_1") score += 0.2;
      if (wantsAfternoon && c.block === "block_3") score += 0.2;
      if (avoidWednesday && c.dayLabel === "Wednesday") score -= 0.3;
      if (c.block === "block_1" && !wantsAfternoon) score += 0.05;
      return {
        ...c,
        score: Math.round(Math.max(0.1, Math.min(0.98, score)) * 100) / 100,
        reason: localReason(c, { wantsMorning, wantsAfternoon, urgent }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function localReason(
  c: SlotCandidate,
  flags: { wantsMorning: boolean; wantsAfternoon: boolean; urgent: boolean },
): string {
  if (flags.wantsMorning && c.block === "block_1") return "Morning block matches your preference.";
  if (flags.wantsAfternoon && c.block === "block_3") return "Afternoon block fits a later meeting.";
  if (flags.urgent) return "One of the earliest open times.";
  return `${c.dayLabel} is open for this lecturer.`;
}

function nextIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
