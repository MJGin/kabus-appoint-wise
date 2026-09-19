import logo from "@/assets/kabuslotin-logo.png";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 36,
  withWordmark = true,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
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
        <span className="font-display text-lg leading-none tracking-tight text-brand-ink">
          <span className="font-semibold">KABUS</span>
          <span className="font-semibold text-primary">Lot</span>
          <span className="font-semibold text-secondary">In</span>
          <sup className="ml-0.5 align-super text-[0.6rem] font-medium text-muted-foreground">
            ™
          </sup>
        </span>
      )}
    </span>
  );
}
