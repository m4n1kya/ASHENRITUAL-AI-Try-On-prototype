import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  MEDIAPIPE_WASM_CDN,
  POSE_LANDMARKER_MODEL_URL,
} from "@/utils/poseConstants";
import { drawPoseLandmarks } from "@/utils/drawPose";
import type { Dimensions } from "@/types/garment";

export type PoseAIStatus = "idle" | "initializing" | "scanning" | "tracking";

interface UsePoseLandmarkerOptions {
  /** The <video> element that is the source of the live webcam feed. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** The <canvas> element that sits transparently above the video. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Set false to skip initialisation (e.g. while the camera is off). */
  enabled: boolean;
}

interface UsePoseLandmarkerReturn {
  aiStatus: PoseAIStatus;
  fps: number;
  /**
   * Ref holding the most recently detected landmark array (or null when
   * no pose is currently detected). Exposed as a ref — not React state —
   * so downstream consumers like the garment renderer can read the latest
   * frame every animation frame without forcing a re-render here on every
   * single detection (which happens up to the camera's frame rate).
   */
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  /**
   * Live pixel dimensions of the video feed. Real React state (unlike
   * landmarksRef) because it only changes when the camera's resolution
   * actually changes — safe to re-render on, and needed as a plain value
   * by consumers like GarmentOverlay that size their own canvas from it.
   */
  dimensions: Dimensions;
}

/**
 * Initialises the MediaPipe Pose Landmarker exactly once per mount and
 * drives a continuous requestAnimationFrame detection loop.
 *
 * Design decisions:
 * - The landmarker is created with `runningMode: "VIDEO"` so that
 *   `detectForVideo()` accepts a timestamp and can interpolate between
 *   frames for smoother results.
 * - We guard against double-init with `initRef` so React StrictMode's
 *   double-invocation of effects doesn't spin up two models.
 * - FPS is measured as a rolling average over the last 10 frames to avoid
 *   single-frame spikes making the display jitter.
 * - All refs (landmarker, rAF id, timestamps) are kept outside React state
 *   so updates never trigger re-renders inside the hot detection loop.
 */
export function usePoseLandmarker({
  videoRef,
  canvasRef,
  enabled,
}: UsePoseLandmarkerOptions): UsePoseLandmarkerReturn {
  const [aiStatus, setAiStatus] = useState<PoseAIStatus>("idle");
  const [fps, setFps] = useState(0);
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const initRef = useRef(false);
  const landmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const dimensionsRef = useRef<Dimensions>({ width: 0, height: 0 });

  // Rolling FPS buffer — 10 frame timestamps.
  const fpsBufferRef = useRef<number[]>([]);

  const updateFps = useCallback((now: number) => {
    const buf = fpsBufferRef.current;
    buf.push(now);
    if (buf.length > 10) buf.shift();
    if (buf.length >= 2) {
      const elapsed = buf[buf.length - 1] - buf[0];
      setFps(Math.round(((buf.length - 1) / elapsed) * 1000));
    }
  }, []);

  // Detection loop — runs every animation frame while the camera is live.
  const detect = useCallback(
    (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas || !landmarker) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      // Wait for the video to be ready (readyState 4 = HAVE_ENOUGH_DATA).
      if (video.readyState < 4) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      // Keep canvas dimensions in sync with the video element on every
      // frame so it stays correct through resizes.
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Track video pixel dimensions as state (only updates when they
      // actually change) so GarmentOverlay can size its own canvas from
      // a plain value instead of reaching into the video element itself.
      if (
        video.videoWidth !== dimensionsRef.current.width ||
        video.videoHeight !== dimensionsRef.current.height
      ) {
        dimensionsRef.current = {
          width: video.videoWidth,
          height: video.videoHeight,
        };
        setDimensions(dimensionsRef.current);
      }

      try {
        const results = landmarker.detectForVideo(video, now);
        const ctx = canvas.getContext("2d");
        const pose = results.landmarks?.[0] as NormalizedLandmark[] | undefined;

        // Always kept current, even on frames with no detected pose (null),
        // so consumers reading it never act on stale landmarks.
        landmarksRef.current = pose ?? null;

        if (ctx) {
          if (pose && pose.length > 0) {
            setAiStatus("tracking");
            drawPoseLandmarks(
              ctx,
              pose,
              canvas.width,
              canvas.height
            );
          } else {
            // No pose detected — clear the canvas and wait.
            setAiStatus("scanning");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        updateFps(now);
      } catch (err) {
        // A single bad frame should never permanently kill detection.
        // Log it, skip this frame, and keep the loop alive below.
        console.error("[PoseLandmarker] detection frame failed:", err);
      }

      rafRef.current = requestAnimationFrame(detect);
    },
    [videoRef, canvasRef, updateFps]
  );

  // Initialise the landmarker once.
  useEffect(() => {
    if (!enabled) return;
    if (initRef.current) return;
    initRef.current = true;

    setAiStatus("initializing");

    let destroyed = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_LANDMARKER_MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (destroyed) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setAiStatus("scanning");
        rafRef.current = requestAnimationFrame(detect);
      } catch (err) {
        console.error("[PoseLandmarker] init failed:", err);
        // Leave status as "initializing" — the overlay will surface this.
      }
    })();

    return () => {
      destroyed = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      landmarksRef.current = null;
      dimensionsRef.current = { width: 0, height: 0 };
      initRef.current = false;
      setAiStatus("idle");
      setDimensions({ width: 0, height: 0 });
    };
  }, [enabled, detect]);

  return { aiStatus, fps, landmarksRef, dimensions };
}
