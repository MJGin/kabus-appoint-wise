import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

const links = [
  { label: "How it works", href: "#how" },
  { label: "For each role", href: "#roles" },
  { label: "Security", href: "#security" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="KABUSLotIn home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "signin" }}>
              Sign in
            </Link>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link to="/auth" search={{ mode: "signup" }}>
              Create account
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
