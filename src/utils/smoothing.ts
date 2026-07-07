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
 * Smooths a raw per-frame GarmentTransform against the previous frame's
 * smoothed state, eliminating the jitter inherent in frame-by-frame pose
 * detection.
 *
 * Frame-rate independent: uses `deltaMs` so the perceived smoothing speed
 * stays consistent whether the camera delivers 24fps or 60fps.
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
    x: lerp(previous.x, target.position.x, positionFactor),
    y: lerp(previous.y, target.position.y, positionFactor),
    width: lerp(previous.width, target.width, scaleFactor),
    height: lerp(previous.height, target.height, scaleFactor),
    rotation: lerpAngle(previous.rotation, target.rotation, rotationFactor),
  };
}
