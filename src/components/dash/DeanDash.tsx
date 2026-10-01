import { useQuery } from "@tanstack/react-query";

import { Empty, Panel, Row, StatusPill } from "@/components/dash/parts";
import { supabase } from "@/integrations/supabase/client";
import { blockLabel, dayLabel, formatDate, formatMoment } from "@/lib/kabuslotin";

async function nameMap(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

export function DeanDash() {
  const timetable = useQuery({
    queryKey: ["dean-timetable"],
    queryFn: async () => {
      const { data } = await supabase
        .from("timetable_slots")
        .select("id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block")
        .order("day_of_week");
      const rows = data ?? [];
      const names = await nameMap([...new Set(rows.map((r) => r.lecturer_id))]);
      return rows.map((r) => ({ ...r, lecturer: names.get(r.lecturer_id) ?? "Lecturer" }));
    },
  });

  const makeups = useQuery({
    queryKey: ["dean-makeups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("makeup_sessions")
        .select("id, lecturer_id, session_date, block, note")
        .order("session_date", { ascending: false });
      const rows = data ?? [];
      const names = await nameMap([...new Set(rows.map((r) => r.lecturer_id))]);
      return rows.map((r) => ({ ...r, lecturer: names.get(r.lecturer_id) ?? "Lecturer" }));
    },
  });

  const activity = useQuery({
    queryKey: ["dean-appointments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, lecturer_id, appt_date, block, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = data ?? [];
      const names = await nameMap([...new Set(rows.map((r) => r.lecturer_id))]);
      return rows.map((r) => ({ ...r, lecturer: names.get(r.lecturer_id) ?? "Lecturer" }));
    },
  });

  const log = useQuery({
    queryKey: ["dean-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, action, entity_type, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel title="All teaching schedules" description="Every lecturer's timetabled blocks.">
          {!timetable.data?.length ? (
            <Empty>No timetable has been uploaded yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {timetable.data.map((t) => (
                <Row key={t.id}>
                  <span>
                    <strong className="text-brand-ink">{t.lecturer}</strong> · {t.unit_code} · Year{" "}
                    {t.year_group}
                  </span>
                  <span className="text-muted-foreground">
                    {dayLabel(t.day_of_week)} · {blockLabel(t.block)}
                  </span>
                </Row>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Make-up sessions" description="Extra time lecturers have opened up.">
          {!makeups.data?.length ? (
            <Empty>No make-up sessions recorded.</Empty>
          ) : (
            <ul className="space-y-2">
              {makeups.data.map((m) => (
                <Row key={m.id}>
                  <span>
                    <strong className="text-brand-ink">{m.lecturer}</strong> ·{" "}
                    {formatDate(m.session_date)}
                  </span>
                  <span className="text-muted-foreground">{blockLabel(m.block)}</span>
                </Row>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Appointment activity"
        description="Times and outcomes only — written reasons are never shown here."
      >
        {!activity.data?.length ? (
          <Empty>No appointment activity yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {activity.data.map((r) => (
              <Row key={r.id}>
                <span>
                  <strong className="text-brand-ink">{r.lecturer}</strong> ·{" "}
                  {formatDate(r.appt_date)} · {blockLabel(r.block)}
                </span>
                <StatusPill status={r.status} />
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="System log" description="Operational changes only. Password resets are excluded.">
        {!log.data?.length ? (
          <Empty>Nothing has been recorded yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {log.data.map((l) => (
              <Row key={l.id}>
                <span>
                  {l.action.replace(/_/g, " ")} · {l.entity_type}
                </span>
                <span className="text-muted-foreground">{formatMoment(l.created_at)}</span>
              </Row>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
