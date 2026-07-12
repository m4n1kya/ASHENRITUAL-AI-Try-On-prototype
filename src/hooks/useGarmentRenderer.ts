import { useEffect, useRef } from "react";
import type {
  UseGarmentRendererOptions,
  SmoothedTransform,
  Point2D,
} from "@/types/garment";
import {
  calculateGarmentZones,
  calculateShoulderMeasurement,
  calculateArmOcclusion,
  type ArmOcclusionSide,
} from "@/utils/garmentMath";
import { smoothTransform } from "@/utils/smoothing";
import { lerp, frameIndependentFactor } from "@/utils/interpolation";

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
 * How long (ms) to keep rendering the last known-good zones after
 * shoulder landmarks become momentarily unreliable — covers brief
 * occlusion, motion blur, or a single noisy detection frame without the
 * garment visibly flashing away and reappearing every time confidence
 * dips for an instant. Genuine tracking loss (person steps out of frame)
 * still clears normally once this window passes.
 */
const HOLD_GRACE_MS = 400;

/** One garment zone's smoothed state plus its (static, unsmoothed) source rect. */
interface HeldZone {
  smoothed: SmoothedTransform;
  sourceY: number;
  sourceHeight: number;
}

/** Draws one already-smoothed garment zone, sourced from a slice of the garment image. */
function drawGarmentZone(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  smoothed: SmoothedTransform,
  sourceY: number,
  sourceHeight: number,
  naturalWidth: number
): void {
  ctx.save();
  ctx.translate(smoothed.x, smoothed.y);
  ctx.rotate(smoothed.rotation);
  ctx.drawImage(
    image,
    0,
    sourceY,
    naturalWidth,
    sourceHeight,
    -smoothed.width / 2,
    -smoothed.height / 2,
    smoothed.width,
    smoothed.height
  );
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Experimental arm occlusion (landmarks-only heuristic, no segmentation)
// ─────────────────────────────────────────────────────────────────────────────

const OCCLUSION_SMOOTHING_STRENGTH = 0.78;
const OCCLUSION_RADIUS_RATIO = 0.16;
const OCCLUSION_MIN_CONFIDENCE = 0.04;

interface SmoothedOcclusionSide {
  confidence: number;
  elbow: Point2D;
  wrist: Point2D;
}

interface SmoothedOcclusionState {
  left: SmoothedOcclusionSide;
  right: SmoothedOcclusionSide;
}

function zeroOcclusionSide(): SmoothedOcclusionSide {
  return { confidence: 0, elbow: { x: 0, y: 0 }, wrist: { x: 0, y: 0 } };
}

function smoothOcclusionSide(
  target: ArmOcclusionSide,
  previous: SmoothedOcclusionSide,
  factor: number
): SmoothedOcclusionSide {
  return {
    confidence: lerp(previous.confidence, target.confidence, factor),
    elbow: {
      x: lerp(previous.elbow.x, target.elbow.x, factor),
      y: lerp(previous.elbow.y, target.elbow.y, factor),
    },
    wrist: {
      x: lerp(previous.wrist.x, target.wrist.x, factor),
      y: lerp(previous.wrist.y, target.wrist.y, factor),
    },
  };
}

function decayOcclusionSide(
  previous: SmoothedOcclusionSide,
  factor: number
): SmoothedOcclusionSide {
  return { ...previous, confidence: lerp(previous.confidence, 0, factor) };
}

function applyOcclusionErase(
  ctx: CanvasRenderingContext2D,
  side: SmoothedOcclusionSide,
  radiusPx: number
): void {
  if (side.confidence < OCCLUSION_MIN_CONFIDENCE || radiusPx <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = side.confidence;
  ctx.lineCap = "round";
  ctx.lineWidth = radiusPx * 2;
  ctx.beginPath();
  ctx.moveTo(side.elbow.x, side.elbow.y);
  ctx.lineTo(side.wrist.x, side.wrist.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Drives the garment overlay's own requestAnimationFrame loop.
 *
 * Uses the two-zone body-fit transform (calculateGarmentZones) instead of
 * the legacy single-rect transform: a shoulder-locked top zone and a
 * hip-following bottom zone, each independently scaled and smoothed, then
 * drawn from their own slice of the garment texture. The grace-period
 * hold and arm-occlusion erase from earlier phases both carry over onto
 * this zone-based draw.
 *
 * Deliberately decoupled from the pose-detection loop in usePoseLandmarker:
 * detection is expensive (a MediaPipe inference call) and runs at the
 * camera's frame rate, while garment rendering is cheap (canvas draw) and
 * can run every animation frame, reading whatever the latest detected
 * landmarks happen to be via `landmarksRef`.
 *
 * All animation state lives in refs, not React state, so this hook never
 * causes a re-render — it only ever writes to the canvas it's given.
 */
export function useGarmentRenderer({
  canvasRef,
  landmarksRef,
  garment,
  videoDimensions,
  enabled,
}: UseGarmentRendererOptions): void {
  const rafRef = useRef<number | null>(null);
  const topSmoothedRef = useRef<SmoothedTransform | null>(null);
  const bottomSmoothedRef = useRef<SmoothedTransform | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const lastValidTimeRef = useRef<number>(0);
  const lastValidZonesRef = useRef<[HeldZone, HeldZone] | null>(null);
  const occlusionRef = useRef<SmoothedOcclusionState>({
    left: zeroOcclusionSide(),
    right: zeroOcclusionSide(),
  });

  // Load / swap the garment image whenever the selected garment changes.
  // Resetting smoothed state avoids the overlay tweening from the old
  // garment's transform into the new one's on switch.
  useEffect(() => {
    if (!garment) {
      currentImageRef.current = null;
      topSmoothedRef.current = null;
      bottomSmoothedRef.current = null;
      lastValidTimeRef.current = 0;
      lastValidZonesRef.current = null;
      occlusionRef.current = { left: zeroOcclusionSide(), right: zeroOcclusionSide() };
      return;
    }

    let cancelled = false;
    currentImageRef.current = null;
    topSmoothedRef.current = null;
    bottomSmoothedRef.current = null;
    lastValidTimeRef.current = 0;
    lastValidZonesRef.current = null;
    occlusionRef.current = { left: zeroOcclusionSide(), right: zeroOcclusionSide() };

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
      topSmoothedRef.current = null;
      bottomSmoothedRef.current = null;
      lastValidTimeRef.current = 0;
      lastValidZonesRef.current = null;
      occlusionRef.current = { left: zeroOcclusionSide(), right: zeroOcclusionSide() };
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
      const occlusionFactor = frameIndependentFactor(OCCLUSION_SMOOTHING_STRENGTH, deltaMs);

      if (canvas && ctx && videoWidth > 0 && videoHeight > 0) {
        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const landmarks = landmarksRef.current;
        const image = currentImageRef.current;

        if (garment && image) {
          const zones = landmarks
            ? calculateGarmentZones(
                landmarks,
                { width: videoWidth, height: videoHeight },
                garment
              )
            : null;

          let drewGarment = false;

          if (zones) {
            const [topRaw, bottomRaw] = zones;

            const topSmoothed = smoothTransform(
              {
                position: topRaw.position,
                width: topRaw.width,
                height: topRaw.height,
                rotation: topRaw.rotation,
              },
              topSmoothedRef.current,
              deltaMs
            );
            const bottomSmoothed = smoothTransform(
              {
                position: bottomRaw.position,
                width: bottomRaw.width,
                height: bottomRaw.height,
                rotation: bottomRaw.rotation,
              },
              bottomSmoothedRef.current,
              deltaMs
            );

            topSmoothedRef.current = topSmoothed;
            bottomSmoothedRef.current = bottomSmoothed;
            lastValidTimeRef.current = now;
            lastValidZonesRef.current = [
              { smoothed: topSmoothed, sourceY: topRaw.sourceY, sourceHeight: topRaw.sourceHeight },
              { smoothed: bottomSmoothed, sourceY: bottomRaw.sourceY, sourceHeight: bottomRaw.sourceHeight },
            ];

            drawGarmentZone(ctx, image, topSmoothed, topRaw.sourceY, topRaw.sourceHeight, garment.naturalWidth);
            drawGarmentZone(ctx, image, bottomSmoothed, bottomRaw.sourceY, bottomRaw.sourceHeight, garment.naturalWidth);
            drewGarment = true;
          } else if (
            lastValidZonesRef.current &&
            now - lastValidTimeRef.current < HOLD_GRACE_MS
          ) {
            // Shoulders are momentarily unreliable but we were tracking
            // well very recently — hold the last known-good zones instead
            // of letting the garment flash away for a single noisy frame.
            const [top, bottom] = lastValidZonesRef.current;
            drawGarmentZone(ctx, image, top.smoothed, top.sourceY, top.sourceHeight, garment.naturalWidth);
            drawGarmentZone(ctx, image, bottom.smoothed, bottom.sourceY, bottom.sourceHeight, garment.naturalWidth);
            drewGarment = true;
          }
          // else: genuinely lost tracking beyond the grace window — canvas
          // stays cleared (already cleared above) until tracking resumes.

          // Experimental arm-occlusion pass — unchanged from before, still
          // operates on top of whatever was drawn this frame.
          if (drewGarment && landmarks) {
            const dims = { width: videoWidth, height: videoHeight };
            const shoulder = calculateShoulderMeasurement(landmarks, dims);

            if (shoulder.isReliable) {
              const occlusion = calculateArmOcclusion(landmarks, dims, shoulder);

              occlusionRef.current = {
                left: smoothOcclusionSide(occlusion.left, occlusionRef.current.left, occlusionFactor),
                right: smoothOcclusionSide(occlusion.right, occlusionRef.current.right, occlusionFactor),
              };

              const radiusPx = shoulder.widthPx * OCCLUSION_RADIUS_RATIO;
              applyOcclusionErase(ctx, occlusionRef.current.left, radiusPx);
              applyOcclusionErase(ctx, occlusionRef.current.right, radiusPx);
            } else {
              occlusionRef.current = {
                left: decayOcclusionSide(occlusionRef.current.left, occlusionFactor),
                right: decayOcclusionSide(occlusionRef.current.right, occlusionFactor),
              };
            }
          } else {
            occlusionRef.current = {
              left: decayOcclusionSide(occlusionRef.current.left, occlusionFactor),
              right: decayOcclusionSide(occlusionRef.current.right, occlusionFactor),
            };
          }
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
      topSmoothedRef.current = null;
      bottomSmoothedRef.current = null;
      lastValidTimeRef.current = 0;
      lastValidZonesRef.current = null;
      occlusionRef.current = { left: zeroOcclusionSide(), right: zeroOcclusionSide() };
    };
  }, [enabled, canvasRef, landmarksRef, garment, videoWidth, videoHeight]);
}