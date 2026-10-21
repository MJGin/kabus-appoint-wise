import { useEffect, useRef, type ReactNode } from "react";

export function ScrollFade({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>(".scroll-fade-item"));
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );

    container.classList.add("scroll-fade-ready");
    items.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
      container.classList.remove("scroll-fade-ready");
    };
  }, []);

  return <div ref={containerRef}>{children}</div>;
}