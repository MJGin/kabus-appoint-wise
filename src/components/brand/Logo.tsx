import { cn } from "@/lib/utils";

/**
 * KABU SlotIn brand mark: a "K" built from three rounded schedule blocks —
 * a cornflower-blue stem, an electric-teal rising arm and a coral returning
 * leg — drawn as vector art so it stays crisp at any size. No trademark symbol.
 */
export function LogoMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label="KABU SlotIn mark"
      className={cn("shrink-0", className)}
    >
      {/* stem with a V-notch cut into its right edge */}
      <path
        d="M9 3H12A6 6 0 0 1 18 9V15L10 24L18 33V39A6 6 0 0 1 12 45H9A6 6 0 0 1 3 39V9A6 6 0 0 1 9 3Z"
        className="fill-brand-blue"
      />
      {/* rising arm */}
      <rect
        x="17"
        y="8"
        width="26"
        height="12"
        rx="6"
        transform="rotate(-45 30 14)"
        className="fill-primary"
      />
      {/* returning leg */}
      <rect
        x="18"
        y="28"
        width="22"
        height="12"
        rx="6"
        transform="rotate(45 29 34)"
        className="fill-secondary"
      />
    </svg>
  );
}

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
    return <LogoMark size={size} className={className} />;
  }

  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: Math.max(6, size * 0.18) }}
    >
      <LogoMark size={size} />
      <span className="flex flex-col" style={{ lineHeight: 1.12 }}>
        <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.44 }}>
          <span className={inverse ? "text-background" : "text-brand-blue"}>KABU </span>
          <span className={inverse ? "text-background" : "text-brand-blue"}>Slot</span>
          <span className="text-primary">In</span>
        </span>
        <span
          className={cn(
            "font-sans font-medium tracking-wide",
            inverse ? "text-background/65" : "text-muted-foreground",
          )}
          style={{ fontSize: size * 0.25 }}
        >
          Slot in. Stay in sync.
        </span>
      </span>
    </span>
  );
}
