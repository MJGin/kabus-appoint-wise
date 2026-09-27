import logo from "@/assets/kabuslotin-logo.png";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 36,
  withWordmark = true,
  inverse = false,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt="KABUSLotIn logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0"
      />
      {withWordmark && (
        <span className={`font-display text-lg leading-none ${inverse ? "text-background" : "text-brand-ink"}`}>
          <span className="font-semibold">KABUS</span>
          <span className="font-semibold text-primary">Lot</span>
          <span className="font-semibold text-secondary">In</span>
        </span>
      )}
    </span>
  );
}
