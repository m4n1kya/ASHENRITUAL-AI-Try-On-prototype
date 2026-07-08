import type { GarmentTransform, SmoothedTransform } from "@/types/garment";
import { lerp, lerpAngle, frameIndependentFactor } from "@/utils/interpolation";

/**
 * How aggressively each property is smoothed, in [0, 1).
 * Higher = smoother but more lag. Position/scale can smooth harder than
 * rotation, since rotation lag is more visually noticeable on a garment
 * pivoting around the body.
 */
const SMOOTHING_STRENGTH = {
  position: 0.82,
  scale: 0.85,
  rotation: 0.7,
} as const;

/**
 * Deadzone thresholds below which the raw target is treated as "no real
 * change" and the previous smoothed value is held exactly, rather than
 * lerped toward a target that only moved from landmark noise.
 *
 * This is what actually stops the garment from perpetually micro-vibrating
 * when the person is essentially still: smoothing alone reduces jitter,
 * it doesn't eliminate it, because the lerp *target* itself keeps moving
 * by tiny amounts every single frame even when nothing real is happening.
 * Below these thresholds we simply don't move at all.
 */
const DEADZONE = {
  positionPx: 0.6,
  scalePx: 0.6,
  rotationRad: 0.006, // ~0.34°
} as const;

/** Lerp with a deadzone: holds `previous` exactly if the change is tiny. */
function lerpWithDeadzone(
  previous: number,
  target: number,
  factor: number,
  threshold: number
): number {
  if (Math.abs(target - previous) < threshold) return previous;
  return lerp(previous, target, factor);
}

/** Same idea as lerpWithDeadzone, but angle-aware (shortest path). */
function lerpAngleWithDeadzone(
  previous: number,
  target: number,
  factor: number,
  threshold: number
): number {
  const twoPi = Math.PI * 2;
  let delta = (target - previous) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  if (Math.abs(delta) < threshold) return previous;
  return lerpAngle(previous, target, factor);
}

/**
 * Smooths a raw per-frame GarmentTransform against the previous frame's
 * smoothed state, eliminating the jitter inherent in frame-by-frame pose
 * detection.
 *
 * Frame-rate independent: uses `deltaMs` so the perceived smoothing speed
 * stays consistent whether the camera delivers 24fps or 60fps.
 *
 * Also applies a small deadzone per property (see DEADZONE above) so
 * sub-pixel/sub-degree landmark noise settles completely instead of
 * causing a continuous faint vibration.
 *
 * @param target    Raw transform calculated from this frame's landmarks.
 * @param previous  The previous frame's smoothed state, or null on the
 *                  first frame (in which case target is returned as-is).
 * @param deltaMs   Milliseconds since the previous frame.
 */
export function smoothTransform(
  target: GarmentTransform,
  previous: SmoothedTransform | null,
  deltaMs: number
): SmoothedTransform {
  if (!previous) {
    return {
      x: target.position.x,
      y: target.position.y,
      width: target.width,
      height: target.height,
      rotation: target.rotation,
    };
  }

  const positionFactor = frameIndependentFactor(SMOOTHING_STRENGTH.position, deltaMs);
  const scaleFactor = frameIndependentFactor(SMOOTHING_STRENGTH.scale, deltaMs);
  const rotationFactor = frameIndependentFactor(SMOOTHING_STRENGTH.rotation, deltaMs);

  return {
    x: lerpWithDeadzone(previous.x, target.position.x, positionFactor, DEADZONE.positionPx),
    y: lerpWithDeadzone(previous.y, target.position.y, positionFactor, DEADZONE.positionPx),
    width: lerpWithDeadzone(previous.width, target.width, scaleFactor, DEADZONE.scalePx),
    height: lerpWithDeadzone(previous.height, target.height, scaleFactor, DEADZONE.scalePx),
    rotation: lerpAngleWithDeadzone(
      previous.rotation,
      target.rotation,
      rotationFactor,
      DEADZONE.rotationRad
    ),
  };
}