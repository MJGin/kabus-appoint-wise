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
    <header className="sticky top-0 z-40 border-b border-primary/20 bg-brand-ink/95 text-background backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="KABUSLotIn home">
          <Logo inverse />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-background/70 transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-background hover:bg-background/10 hover:text-background">
            <Link to="/auth">
              Sign in
            </Link>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link to="/auth">
              Create account
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
