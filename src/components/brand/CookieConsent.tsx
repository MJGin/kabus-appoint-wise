import { useCallback, useEffect, useState } from "react";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";

const KEY = "kabu-cookie-consent";

/** Clears the stored choice so the banner shows again (used by "Cookie settings"). */
export function resetCookieConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — banner stays hidden */
  }
  window.dispatchEvent(new Event("kabu-cookie-consent:reset"));
}

/**
 * What the site stores in the visitor's browser, in plain language.
 * KABU SlotIn sets no advertising or tracking cookies — only what is
 * needed to stay signed in and to keep unsent bookings safe offline.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const check = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(KEY);
      } catch {
        stored = "unavailable";
      }
      setVisible(!stored);
    };
    check();
    window.addEventListener("kabu-cookie-consent:reset", check);
    return () => window.removeEventListener("kabu-cookie-consent:reset", check);
  }, []);

  const choose = useCallback((value: "accepted" | "declined") => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ value, at: new Date().toISOString() }));
    } catch {
      /* storage unavailable — nothing to remember */
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cookie className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-brand-ink">
              We store a little in your browser
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              KABU SlotIn keeps you signed in and keeps unsent bookings safe when you go
              offline. No advertising, no tracking — only what the app needs to work.
            </p>
            {expanded && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>· Sign-in session, so dashboards know it is you.</li>
                <li>· Bookings saved on this device while offline, sent when you reconnect.</li>
                <li>· Your light/dark theme choice.</li>
              </ul>
            )}
            <button
              type="button"
              className="mt-1 text-sm font-medium text-secondary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : "What exactly is stored?"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="hero" size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
          <Button variant="outline" size="sm" onClick={() => choose("declined")}>
            Decline
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Declining records your choice. Signing in itself still needs its session storage —
          without it, staying logged in is impossible.
        </p>
      </div>
    </div>
  );
}
