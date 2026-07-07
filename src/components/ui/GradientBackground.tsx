import { useMemo } from "react";

interface GradientBackgroundProps {
  /** Renders the drifting particle field. Off by default for lightweight sections. */
  withParticles?: boolean;
  className?: string;
}

/**
 * The prototype's ambient layer.
 *
 * Reads as standing in a dark, glass-walled space at midnight: two faint
 * white glows breathe slowly behind the content, and (optionally) a field
 * of near-invisible dust drifts upward, like light catching particulate in
 * still air. No color — brightness and blur do all the work, so it never
 * competes with the product on screen.
 */
export default function GradientBackground({
  withParticles = false,
  className = "",
}: GradientBackgroundProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 18,
        duration: 14 + Math.random() * 12,
        size: 1 + Math.random() * 1.6,
      })),
    []
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Base void */}
      <div className="absolute inset-0 bg-void" />

      {/* Two faint, slow-breathing white glows — no hue, just light */}
      <div className="absolute left-1/2 top-[24%] h-[55vh] w-[55vw] -translate-x-1/2 rounded-full bg-white/[0.05] blur-[130px] animate-pulse-slow" />
      <div className="absolute left-[18%] top-[62%] h-[38vh] w-[38vw] rounded-full bg-white/[0.035] blur-[110px] animate-pulse-slow [animation-delay:4s]" />

      {/* Faint diagonal glass reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />

      {/* Vignette so edges settle back into the void */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_35%,#050505_92%)]" />

      {withParticles && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute bottom-0 block rounded-full bg-white/40 animate-drift"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
