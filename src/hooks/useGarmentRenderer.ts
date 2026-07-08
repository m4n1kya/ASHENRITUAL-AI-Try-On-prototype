import { useEffect, useRef } from "react";
import type { UseGarmentRendererOptions, SmoothedTransform } from "@/types/garment";
import { calculateGarmentTransform } from "@/utils/garmentMath";
import { smoothTransform } from "@/utils/smoothing";

// Module-level image cache — switching garments (or remounting this hook)
// never re-fetches/re-decodes an image that's already been loaded once.
const imageCache = new Map<string, HTMLImageElement>();

function loadGarmentImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load garment image: ${url}`));
    img.src = url;
  });
}

/**
 * How long (ms) to keep rendering the last known-good transform after
 * shoulder landmarks become momentarily unreliable — covers brief
 * occlusion, motion blur, or a single noisy detection frame without the
 * garment visibly flashing away and reappearing every time confidence
 * dips for an instant. Genuine tracking loss (person steps out of frame)
 * still clears normally once this window passes.
 */
const HOLD_GRACE_MS = 400;

/** Draws one already-smoothed garment transform onto the canvas. */
function drawGarment(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  transform: SmoothedTransform
): void {
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.rotate(transform.rotation);
  ctx.drawImage(
    image,
    -transform.width / 2,
    -transform.height / 2,
    transform.width,
    transform.height
  );
  ctx.restore();
}

/**
 * Drives the garment overlay's own requestAnimationFrame loop.
 *
 * Deliberately decoupled from the pose-detection loop in usePoseLandmarker:
 * detection is expensive (a MediaPipe inference call) and runs at the
 * camera's frame rate, while garment rendering is cheap (canvas draw) and
 * can run every animation frame, reading whatever the latest detected
 * landmarks happen to be via `landmarksRef`. Keeping these two loops
 * independent means garment rendering — and future garment physics — can
 * evolve without ever touching the detection pipeline, and detection never
 * has to run twice for two consumers.
 *
 * All animation state (smoothed transform, loaded image, timestamps) lives
 * in refs, not React state, so this hook never causes a re-render — it
 * only ever writes to the canvas it's given.
 */
export function useGarmentRenderer({
  canvasRef,
  landmarksRef,
  garment,
  videoDimensions,
  enabled,
}: UseGarmentRendererOptions): void {
  const rafRef = useRef<number | null>(null);
  const smoothedRef = useRef<SmoothedTransform | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  // Timestamp (rAF clock) of the most recent frame where shoulders were
  // reliably detected — drives the hold-grace-period fallback below.
  const lastValidTimeRef = useRef<number>(0);

  // Load / swap the garment image whenever the selected garment changes.
  // Resetting smoothedRef avoids the overlay tweening from the old
  // garment's transform into the new one's on switch.
  useEffect(() => {
    if (!garment) {
      currentImageRef.current = null;
      smoothedRef.current = null;
      lastValidTimeRef.current = 0;
      return;
    }

    let cancelled = false;
    currentImageRef.current = null;
    smoothedRef.current = null;
    lastValidTimeRef.current = 0;

    loadGarmentImage(garment.imageUrl)
      .then((img) => {
        if (!cancelled) currentImageRef.current = img;
      })
      .catch((err) => {
        console.error("[GarmentRenderer]", err);
      });

    return () => {
      cancelled = true;
    };
  }, [garment]);

  const { width: videoWidth, height: videoHeight } = videoDimensions;

  useEffect(() => {
    if (!enabled) {
      smoothedRef.current = null;
      lastValidTimeRef.current = 0;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    lastFrameTimeRef.current = performance.now();

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const deltaMs = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      if (canvas && ctx && videoWidth > 0 && videoHeight > 0) {
        // Keep canvas resolution matched to the video feed.
        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const landmarks = landmarksRef.current;
        const image = currentImageRef.current;

        if (garment && image) {
          const target = landmarks
            ? calculateGarmentTransform(
                landmarks,
                { width: videoWidth, height: videoHeight },
                garment
              )
            : null;

          if (target) {
            const smoothed = smoothTransform(target, smoothedRef.current, deltaMs);
            smoothedRef.current = smoothed;
            lastValidTimeRef.current = now;
            drawGarment(ctx, image, smoothed);
          } else if (
            smoothedRef.current &&
            now - lastValidTimeRef.current < HOLD_GRACE_MS
          ) {
            // Shoulders are momentarily unreliable (or landmarks briefly
            // missing) but we were tracking well very recently — hold the
            // last known-good transform instead of letting the garment
            // flash away for a single noisy frame.
            drawGarment(ctx, image, smoothedRef.current);
          }
          // else: genuinely lost tracking beyond the grace window — canvas
          // stays cleared (already cleared above) until tracking resumes.
        }
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    rafRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      smoothedRef.current = null;
      lastValidTimeRef.current = 0;
    };
  }, [enabled, canvasRef, landmarksRef, garment, videoWidth, videoHeight]);
}