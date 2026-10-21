import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ConsentText } from "@/components/consent/ConsentText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_FORM_VERSION, STATEMENTS, type ConsentRow } from "@/lib/consent";

/**
 * Shown after sign-in until the person has consented to the current form.
 * Choosing "I do not consent" is recorded and keeps the work area closed.
 */
export function ConsentGate({
  defaultName,
  previous,
  onSignOut,
}: {
  defaultName: string;
  previous: ConsentRow | null;
  onSignOut: () => void;
}) {
  const qc = useQueryClient();
  const [ticks, setTicks] = useState<boolean[]>(STATEMENTS.map(() => false));
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState<"consent" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allTicked = ticks.every(Boolean);
  const nameOk = name.trim().length >= 2;
  const declined = previous?.decision === "decline";
  const withdrawn = previous?.decision === "withdraw";
  const reAsk = previous?.decision === "consent" && previous.form_version !== CONSENT_FORM_VERSION;

  async function submit(decision: "consent" | "decline") {
    setError(null);
    if (!nameOk) return setError("Type your full name — it acts as your signature.");
    if (decision === "consent" && !allTicked) {
      return setError("Please tick all four statements before you consent.");
    }
    setBusy(decision);
    const { error: rpcError } = await supabase.rpc("record_consent", {
      _decision: decision,
      _form_version: CONSENT_FORM_VERSION,
      _full_name: name.trim(),
      _age_confirmed: decision === "consent" ? allTicked : false,
    });
    setBusy(null);
    if (rpcError) {
      setError("We could not save your choice. Check your connection and try again.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-consent"] });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
      {(declined || withdrawn || reAsk) && (
        <p className="mb-5 rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm">
          {declined &&
            "You previously chose not to consent. You can change your mind below at any time."}
          {withdrawn &&
            "You withdrew your consent. You can give it again below if you wish to use KABUSlotIn."}
          {reAsk && "The consent form has been updated. Please read it and confirm again."}
        </p>
      )}

      <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-border bg-background p-4 sm:p-5">
        <ConsentText />
      </div>

      <h3 className="mt-6 font-display text-base font-semibold text-brand-ink">
        6. Consent declaration
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Please read the statements below carefully and tick each one.
      </p>
      <ul className="mt-3 space-y-2">
        {STATEMENTS.map((s, i) => (
          <li key={s}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={ticks[i]}
                onChange={(e) => setTicks((t) => t.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span>{s}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1.5">
        <Label htmlFor="consent-name">Full name (your signature)</Label>
        <Input
          id="consent-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your official Kabarak email and today’s date are recorded automatically.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="hero"
          size="lg"
          className="sm:flex-1"
          disabled={busy !== null}
          onClick={() => void submit("consent")}
        >
          {busy === "consent" ? "Saving…" : "I CONSENT"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="sm:flex-1"
          disabled={busy !== null}
          onClick={() => void submit("decline")}
        >
          {busy === "decline" ? "Saving…" : "I DO NOT CONSENT"}
        </Button>
      </div>
      {declined && (
        <p className="mt-3 text-sm text-muted-foreground">
          Without consent the booking area stays closed.{" "}
          <button
            type="button"
            className="font-medium text-secondary hover:underline"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </p>
      )}
    </section>
  );
}
