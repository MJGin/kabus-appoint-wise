import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Empty, Note, Panel } from "@/components/dash/parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recommendSlots, type SlotRecommendation } from "@/lib/ai.functions";
import { blockLabel, formatDate } from "@/lib/kabuslotin";

/**
 * Student describes their scheduling needs in plain language.
 * AI Gateway ranks real open slots for the selected lecturer.
 */
export function AiScheduleAssistant({
  lecturerId,
  lecturerName,
  onPick,
  disabled,
}: {
  lecturerId: string | null;
  lecturerName: string | null;
  onPick: (slot: { date: string; block: SlotRecommendation["block"] }) => void;
  disabled?: boolean;
}) {
  const [needs, setNeeds] = useState("");
  const [picks, setPicks] = useState<SlotRecommendation[]>([]);
  const [sourceNote, setSourceNote] = useState<string | null>(null);

  const recommend = useMutation({
    mutationFn: async () => {
      if (!lecturerId) throw new Error("Choose a lecturer first.");
      return recommendSlots({ data: { needs: needs.trim(), lecturerId } });
    },
    onSuccess: (res) => {
      setPicks(res.recommendations);
      setSourceNote(res.note);
    },
    onError: (e: Error) => {
      setPicks([]);
      setSourceNote(e.message.replace(/^.*?:\s*/, ""));
    },
  });

  return (
    <Panel
      title="AI slot finder"
      description="Describe when you can meet. The model ranks real open times for this lecturer."
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" /> AI Gateway
        </span>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ai-needs">Your scheduling needs</Label>
          <Textarea
            id="ai-needs"
            rows={3}
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            placeholder="e.g. I need 20 minutes before Thursday's criminal law class, mornings only, or any afternoon next week if that is easier."
            disabled={disabled || !lecturerId}
          />
          <p className="text-xs text-muted-foreground">
            Don't include the private reason for your visit — that stays on the booking form.
          </p>
        </div>

        <Button
          variant="brandOutline"
          disabled={!lecturerId || needs.trim().length < 8 || recommend.isPending}
          onClick={() => recommend.mutate()}
        >
          {recommend.isPending ? "Finding slots…" : "Suggest open times"}
        </Button>

        {sourceNote && <Note tone={picks.length ? "info" : "error"}>{sourceNote}</Note>}

        {!sourceNote && !recommend.isPending && !picks.length && (
          <Empty>
            {lecturerName
              ? `Describe your needs and I'll rank ${lecturerName}'s open times.`
              : "Pick a lecturer first, then describe your needs."}
          </Empty>
        )}

        {picks.length > 0 && (
          <ul className="space-y-2">
            {picks.map((p) => (
              <li
                key={`${p.date}-${p.block}`}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">
                      {formatDate(p.date)} · {p.blockLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {Math.round(p.score * 100)}% match
                    </span>
                    <Button
                      size="sm"
                      disabled={disabled}
                      onClick={() => onPick({ date: p.date, block: p.block as never })}
                    >
                      Use this time
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// re-export for convenience in StudentDash
export { blockLabel, formatDate };
