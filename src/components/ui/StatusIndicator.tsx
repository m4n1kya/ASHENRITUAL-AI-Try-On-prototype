import { cn } from "@/utils/cn";

type StatusTone = "ready" | "pending" | "error";

interface StatusIndicatorProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

const DOT_TONES: Record<StatusTone, string> = {
  ready: "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.55)]",
  pending: "bg-white/70",
  error: "bg-red-400 shadow-[0_0_8px_2px_rgba(248,113,113,0.5)]",
};

/**
 * Small pill-shaped live-status badge — "● Camera Ready" and similar.
 * Generic enough to reuse for any future live/pending/error state, not
 * just the camera (e.g. render status, connection status).
 */
export default function StatusIndicator({
  label,
  tone = "ready",
  className,
}: StatusIndicatorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-black/40 px-3.5 py-1.5 backdrop-blur-md",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          DOT_TONES[tone],
          tone === "ready" && "animate-pulse-slow"
        )}
      />
      <span className="font-mono text-[11px] uppercase tracking-wide2 text-fog">
        {label}
      </span>
    </div>
  );
}
