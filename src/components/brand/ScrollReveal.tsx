import { useEffect, useRef, useState } from "react";

const message =
  "Every appointment begins with a real opening in the timetable. Students find a time that fits. Lecturers respond with clarity. Everyone stays in sync, without giving up the privacy that matters.";
const words = message.split(" ");

export function ScrollReveal() {
  const sectionRef = useRef<HTMLElement>(null);
  const [litCount, setLitCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);

    let frame = 0;
    const measure = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -section.getBoundingClientRect().top / travel));
      setLitCount(Math.floor(progress * words.length));
    };
    const requestMeasure = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    requestMeasure();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      media.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <section ref={sectionRef} aria-label="The KABU SlotIn approach" className="relative min-h-[230svh] bg-brand-shell text-on-brand motion-reduce:min-h-screen">
      <div className="sticky top-0 flex min-h-svh items-center justify-center px-5 py-20">
        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-7 font-display text-xs font-semibold uppercase text-primary">KABU SlotIn · In practice</p>
          <p className="font-display text-3xl font-semibold leading-[1.35] text-on-brand sm:text-4xl md:text-5xl lg:text-6xl" aria-label={message}>
            {words.map((word, index) => (
              <span
                key={`${index}-${word}`}
                aria-hidden="true"
                className={`inline-block transition-opacity duration-150 motion-reduce:transition-none ${reducedMotion || index < litCount ? "opacity-100" : "opacity-25"}`}
              >
                {word}{index < words.length - 1 ? "\u00a0" : ""}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}