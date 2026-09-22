import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Empty, Panel, Row } from "@/components/dash/parts";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMoment } from "@/lib/kabuslotin";

export function ItDash() {
  const qc = useQueryClient();

  const errors = useQuery({
    queryKey: ["error-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("error_reports")
        .select("id, message, context, url, resolved, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const log = useQuery({
    queryKey: ["it-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, action, entity_type, category, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const throttle = useQuery({
    queryKey: ["throttle"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auth_throttle")
        .select("id, scope, attempts, locked_until, window_started_at")
        .order("window_started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const accounts = useQuery({
    queryKey: ["it-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, reg_number")
        .order("full_name")
        .limit(200);
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("error_reports").update({ resolved: true }).eq("id", id);
      if (e) throw e;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["error-reports"] }),
  });

  const unresolved = errors.data?.filter((e) => !e.resolved).length ?? 0;
  const locked = throttle.data?.filter((t) => t.locked_until && new Date(t.locked_until) > new Date())
    .length ?? 0;

  return (
    <div className="space-y-5">
      <Panel title="System health" description="A quick read on how the service is behaving.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Open errors", unresolved],
            ["Logged events", log.data?.length ?? 0],
            ["Locked sign-in paths", locked],
            ["Accounts", accounts.data?.length ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-background p-4">
              <p className="font-display text-2xl font-semibold text-primary">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Error reports" description="Problems users have run into.">
        {!errors.data?.length ? (
          <Empty>No errors reported.</Empty>
        ) : (
          <ul className="space-y-2">
            {errors.data.map((e) => (
              <Row key={e.id}>
                <span className="max-w-[70%]">
                  <strong className="text-brand-ink">{e.message}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {[e.context, e.url, formatMoment(e.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {e.resolved ? (
                  <span className="text-xs text-muted-foreground">Resolved</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => resolve.mutate(e.id)}>
                    Mark resolved
                  </Button>
                )}
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Technical log" description="Appointment reasons are never part of this log.">
        {!log.data?.length ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {log.data.map((l) => (
              <Row key={l.id}>
                <span>
                  {l.action.replace(/_/g, " ")} · {l.entity_type}{" "}
                  <span className="text-xs text-muted-foreground">({l.category})</span>
                </span>
                <span className="text-muted-foreground">{formatMoment(l.created_at)}</span>
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Accounts" description="Basic details only, for helping with password resets.">
        {!accounts.data?.length ? (
          <Empty>No accounts yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {accounts.data.map((a) => (
              <Row key={a.id}>
                <span>{a.full_name || "Unnamed"}</span>
                <span className="text-muted-foreground">{a.reg_number ?? a.email ?? ""}</span>
              </Row>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
