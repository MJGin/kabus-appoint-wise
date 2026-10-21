import { useState } from "react";
import { Copy, ShieldCheck } from "lucide-react";

import { Notice } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export type SecondStepStage =
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string };

/**
 * Administrator, IT Support and the Dean: a 6-digit authenticator-app code after the password.
 * The database refuses these three roles anything until this step is done.
 */
export function SecondStep({
  stage,
  onDone,
  onCancel,
}: {
  stage: SecondStepStage;
  onDone: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyKey(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      const box = document.getElementById("mfa-secret");
      if (box instanceof HTMLInputElement) {
        box.select();
        document.execCommand("copy");
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: stage.factorId });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: stage.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) {
        setError("That code was not accepted. Check it and try again.");
        return;
      }
      await onDone();
    } catch {
      setError("That code was not accepted. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-brand-ink">
        <ShieldCheck className="size-5 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-semibold tracking-tight">Second step</h1>
      </div>

      {stage.kind === "enroll" ? (
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <p>
            This account needs a second step at every sign-in. Scan the code with an authenticator
            app (Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit code
            it shows.
          </p>
          <img
            src={stage.qr}
            alt="Authenticator app setup code"
            className="mx-auto size-44 rounded-lg border border-border bg-white p-2"
          />
          <div className="space-y-1.5">
            <Label htmlFor="mfa-secret">Setup key — paste it into your authenticator app</Label>
            <div className="flex gap-2">
              <Input
                id="mfa-secret"
                readOnly
                value={stage.secret}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void copyKey(stage.secret)}
              >
                <Copy className="size-4" aria-hidden />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs">
              Cannot scan the code? Copy the key above, paste it into the app as a new account,
              then type the 6-digit code it shows into the box below.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">6-digit code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
          {busy ? "Checking…" : stage.kind === "enroll" ? "Turn on and continue" : "Continue"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:underline"
          onClick={() => void onCancel()}
        >
          Cancel and sign out
        </button>
      </form>
    </>
  );
}
