import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_FORM_VERSION, useMyConsent } from "@/lib/consent";

/**
 * One-click withdrawal of consent, available to every kind of account.
 *
 * There is deliberately no "are you sure?" step: withdrawing is instant, it is recorded in the
 * permanent consent record (and the activity log) by the database, and the booking area closes
 * at once. Consent can be given again at any time from the form that opens in its place.
 * It only shows while the person's current decision is "consent".
 */
export function WithdrawConsentButton({
  className,
  label = "Withdraw consent",
}: {
  className?: string;
  label?: string;
}) {
  const qc = useQueryClient();
  const consent = useMyConsent();
  const [busy, setBusy] = useState(false);
  const row = consent.data;

  if (!row || row.decision !== "consent") return null;

  async function withdraw() {
    if (!row || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("record_consent", {
      _decision: "withdraw",
      _form_version: CONSENT_FORM_VERSION,
      _full_name: row.full_name,
      _age_confirmed: false,
    });
    setBusy(false);
    if (error) {
      toast.error(
        "We could not withdraw your consent just now. Check your connection and try again.",
      );
      return;
    }
    toast.success("Your consent has been withdrawn.");
    await qc.invalidateQueries({ queryKey: ["my-consent"] });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      disabled={busy}
      onClick={() => void withdraw()}
    >
      {busy ? "Withdrawing…" : label}
    </Button>
  );
}
