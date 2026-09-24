import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-brand-ink">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role="status"
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
          : "rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm"
      }
    >
      {children}
    </p>
  );
}

const statusStyles: Record<string, string> = {
  pending: "bg-[var(--warning)]/15 text-[var(--warning-ink,inherit)] border-[var(--warning)]/40",
  accepted: "bg-[var(--success)]/15 border-[var(--success)]/40",
  declined: "bg-destructive/10 border-destructive/40",
  cancelled: "bg-muted border-border",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        statusStyles[status] ?? "bg-muted border-border"
      }`}
    >
      {status}
    </span>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm">
      {children}
    </li>
  );
}
