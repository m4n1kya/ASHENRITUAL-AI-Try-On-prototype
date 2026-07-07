import { AnimatePresence, motion } from "framer-motion";
import type { PoseAIStatus } from "@/hooks/usePoseLandmarker";
import { cn } from "@/utils/cn";

interface PoseOverlayProps {
  /** Canvas the skeleton is drawn onto — created and owned by the parent. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  aiStatus: PoseAIStatus;
  fps: number;
}

// ---- AI status badge config -------------------------------------------

const STATUS_CONFIG: Record<
  PoseAIStatus,
  { label: string; dotClass: string; pulseClass: string }
> = {
  idle: {
    label: "AI Offline",
    dotClass: "bg-white/30",
    pulseClass: "",
  },
  initializing: {
    label: "Initializing AI…",
    dotClass: "bg-white/60",
    pulseClass: "animate-pulse",
  },
  scanning: {
    label: "Scanning…",
    dotClass: "bg-yellow-300",
    pulseClass: "animate-pulse",
  },
  tracking: {
    label: "Tracking",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.55)]",
    pulseClass: "animate-pulse-slow",
  },
};

// -----------------------------------------------------------------------

/**
 * Transparent canvas overlay showing the pose skeleton, plus the AI status
 * badge and FPS counter.
 *
 * Presentational only — detection now runs once in WebcamView (via
 * usePoseLandmarker) and is shared with GarmentOverlay through the same
 * landmarksRef, so pose detection never runs twice for two consumers.
 * canvasRef, aiStatus and fps are all owned by the parent and passed in.
 *
 * The canvas is positioned `absolute inset-0` with `pointer-events-none`
 * so it never intercepts clicks intended for the camera controls.
 */
export default function PoseOverlay({ canvasRef, aiStatus, fps }: PoseOverlayProps) {
  const cfg = STATUS_CONFIG[aiStatus];

  return (
    <>
      {/* Transparent skeleton canvas — sits directly above the video */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      {/* AI status badge — bottom-left */}
      <AnimatePresence>
        {aiStatus !== "idle" && (
          <motion.div
            key="ai-badge"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/[0.10] bg-black/50 px-3.5 py-1.5 backdrop-blur-md"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                cfg.dotClass,
                cfg.pulseClass
              )}
            />
            <span className="font-mono text-[11px] uppercase tracking-wide2 text-fog">
              {cfg.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FPS counter — bottom-right, only visible while tracking */}
      <AnimatePresence>
        {(aiStatus === "scanning" || aiStatus === "tracking") && (
          <motion.div
            key="fps"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-4 right-4 rounded-full border border-white/[0.08] bg-black/50 px-3 py-1.5 backdrop-blur-md"
          >
            <span className="font-mono text-[11px] tabular-nums text-muted">
              {fps > 0 ? `${fps} FPS` : "— FPS"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
