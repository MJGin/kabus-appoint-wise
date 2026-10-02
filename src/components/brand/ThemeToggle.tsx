import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const storageKey = "kabu-slotin-theme";

function getPreferredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Browsing without storage still follows the system setting.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ onDarkHeader = false }: { onDarkHeader?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getPreferredTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      try {
        if (window.localStorage.getItem(storageKey)) return;
      } catch {
        // Continue to follow the operating system when storage is unavailable.
      }
      const next = media.matches ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  const current = theme ?? "light";
  function toggle() {
    const next = (theme ?? getPreferredTheme()) === "dark" ? "light" : "dark";
    document.documentElement.classList.add("theme-transition");
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // The selection remains active for this visit.
    }
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 350);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={current === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={current === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className={onDarkHeader ? "shrink-0 text-on-brand hover:bg-on-brand/10 hover:text-on-brand" : "shrink-0 text-foreground"}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
    </Button>
  );
}