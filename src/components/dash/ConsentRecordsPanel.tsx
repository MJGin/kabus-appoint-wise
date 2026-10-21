import { useQuery } from "@tanstack/react-query";

import { Empty, Panel } from "@/components/dash/parts";
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_FORM_VERSION, type ConsentRow } from "@/lib/consent";
import { formatMoment } from "@/lib/kabuslotin";

const DECISION: Record<string, { text: string; cls: string }> = {
  consent: { text: "Consented", cls: "bg-[#22A06B]/15 text-[#22A06B]" },
  decline: { text: "Declined", cls: "bg-[#D95C5C]/15 text-[#D95C5C]" },
  withdraw: { text: "Withdrawn", cls: "bg-[#F2B84B]/25 text-foreground" },
};

/** Administrator view: each person's newest consent decision. */
export function ConsentRecordsPanel() {
  const records = useQuery({
    queryKey: ["admin-consent-records"],
    queryFn: async (): Promise<ConsentRow[]> => {
      const { data, error } = await supabase
        .from("consent_records")
        .select(
          "id, user_id, form_version, decision, participant_category, full_name, email, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      // Newest row per person is their current position.
      const seen = new Set<string>();
      const latest: ConsentRow[] = [];
      for (const r of (data ?? []) as ConsentRow[]) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        latest.push(r);
      }
      return latest;
    },
  });

  const rows = records.data ?? [];
  const consented = rows.filter(
    (r) => r.decision === "consent" && r.form_version === CONSENT_FORM_VERSION,
  ).length;

  return (
    <Panel
      title="Consent records"
      description={`${consented} of ${rows.length} people who answered have consented to the current form. Records cannot be edited or deleted.`}
    >
      {records.isLoading ? (
        <Empty>Loading…</Empty>
      ) : rows.length === 0 ? (
        <Empty>No one has answered the consent form yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Decision</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3">{r.full_name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.email}</td>
                  <td className="py-2 pr-3 capitalize">{r.participant_category}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${DECISION[r.decision]?.cls}`}
                    >
                      {DECISION[r.decision]?.text}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{formatMoment(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
