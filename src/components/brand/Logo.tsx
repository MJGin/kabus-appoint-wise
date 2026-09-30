import mark from "@/assets/kabu-slotin-mark.png";
import lockup from "@/assets/kabu-slotin-lockup.png";
import { cn } from "@/lib/utils";

/**
 * Seamless brand lockup in the Open University of Kenya style:
 * geometric mark + KABU SlotIn wordmark as one clean asset (no box, no screenshot cage).
 */
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
          className="shrink-0 object-contain"
        />
      </span>
    );
  }

  // Full lockup image (mark + type + tagline) — seamless, like OUK
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src={lockup}
        alt="KABU SlotIn — Slot in. Stay in sync."
        className={cn(
          "h-auto w-auto object-contain",
          inverse ? "brightness-0 invert" : "",
        )}
        style={{ height: size * 1.35, maxHeight: 64 }}
      />
    </span>
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <img
      src={lockup}
      alt="KABU SlotIn — Slot in. Stay in sync."
      className={cn("h-12 w-auto object-contain", className)}
    />
  );
}
