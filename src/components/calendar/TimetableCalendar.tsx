import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, LayoutGrid, List, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BLOCKS, type Block, blockLabel, DAYS } from "@/lib/kabuslotin";

interface TimetableSlot {
  id: string;
  lecturer_id: string;
  unit_code: string;
  unit_name: string;
  year_group: number | string;
  day_of_week: number;
  block: Block;
  lecturer?: { full_name: string };
}

interface SemesterInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

const BLOCK_ACCENT: Record<Block, string> = {
  block_1: "border-l-primary bg-primary/[0.07] hover:bg-primary/[0.13]",
  block_2: "border-l-warning bg-warning/[0.10] hover:bg-warning/[0.18]",
  block_3: "border-l-secondary bg-secondary/[0.08] hover:bg-secondary/[0.14]",
};

const BLOCK_DOT: Record<Block, string> = {
  block_1: "bg-primary",
  block_2: "bg-warning",
  block_3: "bg-secondary",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Monday of the current week as a Date (local time). */
function mondayOfThisWeek(from = new Date()) {
  const d = new Date(from);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function isTodayColumn(date: Date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function TimetableCalendar({
  lecturerId = null,
  showToolbar = true,
}: {
  lecturerId?: string | null;
  showToolbar?: boolean;
}) {
  const [view, setView] = useState<"grid" | "agenda">("grid");
  const [filterLecturer, setFilterLecturer] = useState<string>("all");
  const [search, setSearch] = useState("");

  const timetable = useQuery({
    queryKey: ["timetable-calendar"],
    queryFn: async (): Promise<{ slots: TimetableSlot[]; semester: SemesterInfo | null }> => {
      const { data: semester } = await supabase
        .from("semesters")
        .select("id, name, start_date, end_date")
        .eq("is_active", true)
        .maybeSingle();

      if (!semester) return { slots: [], semester: null };

      const { data } = await supabase
        .from("timetable_slots")
        .select("id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block")
        .eq("semester_id", semester.id)
        .order("day_of_week")
        .order("block");

      const rows = (data ?? []) as TimetableSlot[];
      if (!rows.length) return { slots: [], semester };

      const lecturerIds = [...new Set(rows.map((r) => r.lecturer_id))];
      const { data: lecturers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", lecturerIds);

      const lecturerMap = new Map((lecturers ?? []).map((l) => [l.id, l.full_name]));
      return {
        slots: rows.map((r) => ({
          ...r,
          lecturer: { full_name: lecturerMap.get(r.lecturer_id) ?? "Lecturer" },
        })),
        semester,
      };
    },
  });

  const weekDates = useMemo(() => {
    const monday = mondayOfThisWeek();
    return DAYS.map((d, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return { ...d, date };
    });
  }, []);

  const lecturers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of timetable.data?.slots ?? []) map.set(s.lecturer_id, s.lecturer?.full_name ?? "Lecturer");
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [timetable.data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (timetable.data?.slots ?? []).filter((s) => {
      if (lecturerId && s.lecturer_id !== lecturerId) return false;
      if (filterLecturer !== "all" && s.lecturer_id !== filterLecturer) return false;
      if (!q) return true;
      return (
        s.unit_code.toLowerCase().includes(q) ||
        s.unit_name.toLowerCase().includes(q) ||
        (s.lecturer?.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [timetable.data, lecturerId, filterLecturer, search]);

  const cellSlots = (day: number, block: Block) =>
    visible
      .filter((s) => s.day_of_week === day && s.block === block)
      .sort((a, b) => a.unit_code.localeCompare(b.unit_code));

  const isChapelCell = (day: number, block: Block) => day === 3 && block === "block_2";

  if (timetable.isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-brand-blue" />
        <div className="grid animate-pulse grid-cols-6 gap-1.5 p-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  if (timetable.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load timetable: {(timetable.error as Error).message}
      </div>
    );
  }

  const semester = timetable.data?.semester;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
      {/* Gradient header */}
      <div className="relative overflow-hidden px-5 pb-4 pt-5" style={{ background: "var(--gradient-brand)" }}>
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight text-white">
              {semester?.name ?? "Weekly timetable"}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-white/80">
              <span>Mon – Fri · three blocks a day</span>
              {semester && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  {semester.start_date} → {semester.end_date}
                </span>
              )}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-white/12 p-1 ring-1 ring-white/20">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              title="Week grid view"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "grid" ? "bg-white text-brand-ink shadow" : "text-white/85 hover:text-white"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Grid
            </button>
            <button
              type="button"
              onClick={() => setView("agenda")}
              aria-pressed={view === "agenda"}
              title="Agenda list view"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "agenda" ? "bg-white text-brand-ink shadow" : "text-white/85 hover:text-white"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden /> Agenda
            </button>
          </div>
        </div>
      </div>

      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <label className="relative min-w-44 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit, lecturer…"
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {!lecturerId && lecturers.length > 1 && (
            <select
              value={filterLecturer}
              onChange={(e) => setFilterLecturer(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              aria-label="Filter by lecturer"
            >
              <option value="all">All lecturers</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-brand-ink">
            {visible.length} session{visible.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" aria-hidden />
          </span>
          <p className="font-display text-base font-semibold text-brand-ink">No sessions to show</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {search || filterLecturer !== "all"
              ? "Nothing matches this search. Clear the search or pick another lecturer."
              : "The timetable is empty for the active semester — the Administrator adds rows from the timetable panel."}
          </p>
        </div>
      ) : view === "agenda" ? (
        <ul className="divide-y divide-border">
          {weekDates.map(({ value, label, date }) => {
            const daySlots = visible
              .filter((s) => s.day_of_week === value)
              .sort((a, b) => a.block.localeCompare(b.block));
            if (!daySlots.length) return null;
            return (
              <li key={value} className="px-4 py-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-ink">
                  <span className={`inline-block h-2 w-2 rounded-full ${isTodayColumn(date) ? "bg-secondary" : "bg-primary"}`} />
                  {label}
                  <span className="font-normal text-muted-foreground">
                    {shortDate(date)}
                    {isTodayColumn(date) && " · Today"}
                  </span>
                </p>
                <ul className="space-y-2">
                  {daySlots.map((s) => (
                    <li
                      key={s.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border border-l-4 px-3 py-2.5 transition-colors ${BLOCK_ACCENT[s.block]}`}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink text-[11px] font-semibold text-white">
                        {initials(s.lecturer?.full_name ?? "L")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-brand-ink">
                          {s.unit_code} · {s.unit_name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {s.lecturer?.full_name}
                        </span>
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-brand-ink ring-1 ring-border">
                        <Clock className="h-3 w-3" aria-hidden /> {blockLabel(s.block)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto p-4">
          <div className="grid min-w-[760px] grid-cols-[92px_repeat(5,1fr)] gap-1.5">
            <div />
            {weekDates.map(({ value, label, date }) => (
              <div
                key={value}
                className={`rounded-xl px-2 py-2 text-center ring-1 ${
                  isTodayColumn(date)
                    ? "bg-secondary/15 ring-secondary/50"
                    : "bg-muted/50 ring-border"
                }`}
              >
                <p className="text-xs font-semibold text-brand-ink">
                  {label.slice(0, 3)}
                  {isTodayColumn(date) && (
                    <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Today
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">{shortDate(date)}</p>
              </div>
            ))}

            {BLOCKS.map((b) => (
              <Fragment key={b.value}>
                <div className="flex flex-col items-center justify-center rounded-xl bg-brand-ink px-1 py-2 text-center text-white">
                  <span className={`mb-1 inline-block h-1.5 w-1.5 rounded-full ${BLOCK_DOT[b.value]}`} />
                  <span className="text-[11px] font-semibold leading-tight">{blockLabel(b.value)}</span>
                </div>
                {DAYS.map((d) => {
                  if (isChapelCell(d.value, b.value)) {
                    return (
                      <div
                        key={`${d.value}-${b.value}`}
                        className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 p-2 ring-1 ring-dashed ring-border"
                        title="Chapel — nothing may ever be placed here"
                      >
                        <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
                        <span className="text-xs italic text-muted-foreground">Chapel</span>
                      </div>
                    );
                  }
                  const slots = cellSlots(d.value, b.value);
                  return (
                    <div
                      key={`${d.value}-${b.value}`}
                      className={`min-h-[92px] rounded-xl border border-border border-l-4 p-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        slots.length ? BLOCK_ACCENT[b.value] : "border-l-border bg-background"
                      }`}
                    >
                      {slots.length === 0 ? (
                        <div className="flex h-full min-h-[76px] items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">—</span>
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          {slots.map((s) => (
                            <li
                              key={s.id}
                              title={`${s.unit_code} · ${s.unit_name} — ${s.lecturer?.full_name}`}
                              className="rounded-lg bg-background/85 p-1.5 ring-1 ring-border/70"
                            >
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-ink text-[9px] font-bold text-white">
                                  {initials(s.lecturer?.full_name ?? "L")}
                                </span>
                                <span className="truncate">{s.unit_code}</span>
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.unit_name}</p>
                              <p className="truncate text-[11px] font-medium text-primary">
                                {s.lecturer?.full_name}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> 08:00 – 11:00
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-warning" /> 11:00 – 14:00
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-secondary" /> 14:00 – 17:00
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3" aria-hidden /> Wed 11:00 – 14:00 is Chapel — never bookable
        </span>
        <span className="ml-auto hidden sm:inline">Week of {shortDate(weekDates[0]?.date ?? new Date())}</span>
      </div>
    </div>
  );
}
