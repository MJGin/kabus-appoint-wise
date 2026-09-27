import mark from "@/assets/kabu-slotin-mark.png";
import lockup from "@/assets/kabu-slotin-lockup.jpg";
import { cn } from "@/lib/utils";

/** Full brand lockup from the KABU SlotIn artwork. */
export function Logo({
  className,
  size = 40,
  withWordmark = true,
  inverse = false,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  inverse?: boolean;
}) {
  if (!withWordmark) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <img
          src={mark}
          alt="KABU SlotIn"
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="shrink-0 rounded-lg object-contain"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        src={mark}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-lg object-contain"
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-xl font-semibold tracking-tight ${
            inverse ? "text-background" : "text-brand-ink"
          }`}
        >
          KABU <span className="text-primary">Slot</span>
          <span className="text-secondary">In</span>
        </span>
        <span
          className={`mt-1 text-[11px] font-medium ${
            inverse ? "text-background/75" : "text-muted-foreground"
          }`}
        >
          Slot in. Stay in sync.
        </span>
      </span>
    </span>
  );
}

/** Full lockup image (mark + type + tagline) as supplied. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <img
      src={lockup}
      alt="KABU SlotIn — Slot in. Stay in sync."
      className={cn("h-11 w-auto object-contain", className)}
    />
  );
}
