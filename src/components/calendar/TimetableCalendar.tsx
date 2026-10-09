import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BLOCKS,
  type Block,
  blockLabel,
  dayLabel,
  isChapel,
} from "@/lib/kabuslotin";

interface TimetableSlot {
  id: string;
  lecturer_id: string;
  unit_code: string;
  unit_name: string;
  year_group: string;
  day_of_week: number;
  block: Block;
  lecturer?: { full_name: string };
}

export function TimetableCalendar() {
  const { data: slots, isLoading, error } = useQuery({
    queryKey: ["timetable-calendar"],
    queryFn: async (): Promise<TimetableSlot[]> => {
      const { data: semester } = await supabase
        .from("semesters")
        .select("id")
        .eq("is_active", true)
        .single();

      if (!semester) return [];

      const { data } = await supabase
        .from("timetable_slots")
        .select(
          "id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block"
        )
        .eq("semester_id", semester.id)
        .order("day_of_week")
        .order("block");

      const rows = data ?? [];
      if (!rows.length) return rows;

      const lecturerIds = [...new Set(rows.map((r) => r.lecturer_id))];
      const { data: lecturers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", lecturerIds);

      const lecturerMap = new Map(
        (lecturers ?? []).map((l) => [l.id, l.full_name])
      );

      return rows.map((r) => ({
        ...r,
        lecturer: { full_name: lecturerMap.get(r.lecturer_id) ?? "Lecturer" },
      }));
    },
  });

  const cells: React.ReactNode[] = [];

  for (const day of [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
  ]) {
    for (const block of BLOCKS) {
      const chapel = isChapel("2026-01-07", block.value);
      const slot = slots?.find(
        (s) => s.day_of_week === day.value && s.block === block.value
      );

      cells.push(
        <div
          key={`${day.value}-${block.value}`}
          className={`flex flex-col min-h-[80px] p-2 border border-border rounded-md transition-colors ${
            chapel
              ? "bg-muted/50"
              : "bg-card hover:bg-accent/10"
          }`}
        >
          {!chapel && slot ? (
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-brand-ink">
                {slot.unit_code}
              </span>
              <span className="text-muted-foreground truncate">
                {slot.unit_name}
              </span>
              <span className="text-xs text-primary">
                {slot.lecturer?.full_name ?? "Lecturer"}
              </span>
              <span className="text-xs text-muted-foreground">
                Year {slot.year_group}
              </span>
            </div>
          ) : chapel ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-muted-foreground italic">
                Chapel
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-muted-foreground/50 italic">
                —
              </span>
            </div>
          )}
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid grid-cols-6 gap-1">
          <div className="col-span-1 font-medium text-center text-sm text-brand-ink">
            Time
          </div>
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
            <div key={d} className="font-medium text-center text-sm text-brand-ink">
              {d}
            </div>
          ))}
          {BLOCKS.map((b) => (
            <div key={b.value} className="col-span-6 animate-pulse">
              <div className="h-[80px] bg-muted/50 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load timetable: {error.message}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 overflow-x-auto">
      <div className="grid grid-cols-6 gap-1 min-w-[800px]">
        <div className="col-span-1 font-medium text-center text-sm text-brand-ink py-2">
          Time
        </div>
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
          <div
            key={d}
            className="font-medium text-center text-sm text-brand-ink py-2 border-b border-border"
          >
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}