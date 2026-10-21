import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { label: "How it works", href: "#how" },
  { label: "For each role", href: "#roles" },
  { label: "Security", href: "#security" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-primary/20 bg-brand-shell/95 text-on-brand backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="KABU SlotIn home">
          <Logo inverse />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-on-brand/70 transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-on-brand hover:bg-on-brand/10 hover:text-on-brand"
          >
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
            <Link to="/sign-up">Create account</Link>
          </Button>
          <NotificationsBell />
          <ThemeToggle onDarkHeader />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-on-brand hover:bg-on-brand/10 hover:text-on-brand md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-on-brand/10 px-5 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="block rounded-md px-2 py-2 text-sm font-medium text-on-brand/85 hover:bg-on-brand/10 hover:text-primary"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-1">
              <Button asChild variant="brand" size="sm" className="w-full">
                <Link to="/sign-up" onClick={() => setOpen(false)}>
                  Create account
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
