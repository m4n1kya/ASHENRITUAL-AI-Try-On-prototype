import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  Point2D,
  Dimensions,
  ShoulderMeasurement,
  GarmentDefinition,
  GarmentTransform,
} from "@/types/garment";
import { LANDMARK_INDICES } from "@/utils/poseConstants";

/**
 * Minimum visibility score for a landmark to be considered reliable.
 * Mirrors the value in DRAW_CONFIG so both systems reject the same frames.
 */
const MIN_VISIBILITY = 0.5;

/**
 * Maximum plausible in-plane shoulder rotation, in radians (~35°).
 * Real shoulder lean rarely exceeds this while a person is roughly facing
 * the camera in a try-on context — values beyond it are almost always
 * landmark noise (partial occlusion, motion blur, a single bad detection)
 * rather than genuine body lean. Clamping prevents the garment from
 * snapping into an unrealistic spin on a noisy frame.
 */
const MAX_ROTATION_RAD = (35 * Math.PI) / 180;

function clampRotation(angle: number): number {
  if (angle > MAX_ROTATION_RAD) return MAX_ROTATION_RAD;
  if (angle < -MAX_ROTATION_RAD) return -MAX_ROTATION_RAD;
  return angle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a normalised MediaPipe landmark to pixel coordinates.
 * Mirrors X because the webcam feed is CSS-mirrored (scaleX(-1)).
 */
export function normalizedToPixel(
  lm: NormalizedLandmark,
  dimensions: Dimensions
): Point2D {
  return {
    x: (1 - lm.x) * dimensions.width,
    y: lm.y * dimensions.height,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shoulder measurement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts shoulder geometry from a landmark array.
 *
 * Returns width, midpoint, and angle of the shoulder line so every
 * downstream calculation works off the same measured values rather than
 * reading landmarks independently (which would produce slight inconsistencies
 * between position, scale, and rotation).
 */
export function calculateShoulderMeasurement(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions
): ShoulderMeasurement {
  const leftLm = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
  const rightLm = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];

  const isReliable =
    (leftLm?.visibility ?? 0) >= MIN_VISIBILITY &&
    (rightLm?.visibility ?? 0) >= MIN_VISIBILITY;

  const left = normalizedToPixel(leftLm, dimensions);
  const right = normalizedToPixel(rightLm, dimensions);

  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const widthPx = Math.sqrt(dx * dx + dy * dy);
  const angle = clampRotation(Math.atan2(dy, dx));

  const midpoint: Point2D = {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };

  return { midpoint, widthPx, angle, isReliable };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual calculation exports (used by tests / future physics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the pixel distance between the two shoulder landmarks.
 * Exported separately so physics simulations can query width independently.
 */
export function calculateShoulderWidth(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions
): number {
  return calculateShoulderMeasurement(landmarks, dimensions).widthPx;
}

/**
 * Returns the angle of the shoulder line in radians.
 * Positive values mean the right shoulder is lower than the left.
 * Clamped to ±MAX_ROTATION_RAD — see clampRotation above.
 */
export function calculateBodyRotation(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions
): number {
  return calculateShoulderMeasurement(landmarks, dimensions).angle;
}

/**
 * Calculates the rendered pixel width for the garment given the current
 * shoulder width and the garment's shoulder-width multiplier.
 * Height is derived from the asset's natural aspect ratio.
 */
export function calculateGarmentScale(
  shoulderWidthPx: number,
  garment: GarmentDefinition
): { width: number; height: number } {
  const width = shoulderWidthPx * garment.shoulderWidthMultiplier;
  const aspectRatio = garment.naturalHeight / garment.naturalWidth;
  return { width, height: width * aspectRatio };
}

/**
 * Calculates the canvas-pixel centre point at which the garment should
 * be drawn, anchored to the shoulder midpoint and shifted vertically by
 * the garment's verticalAnchorOffset (expressed as a fraction of the
 * rendered garment width).
 */
export function calculateGarmentPosition(
  midpoint: Point2D,
  renderedWidth: number,
  garment: GarmentDefinition
): Point2D {
  return {
    x: midpoint.x,
    y: midpoint.y + garment.verticalAnchorOffset * renderedWidth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full transform
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Composes the individual calculations into a single GarmentTransform for
 * one frame. Returns null when the shoulder landmarks are not reliable
 * enough to produce a stable result.
 */
export function calculateGarmentTransform(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions,
  garment: GarmentDefinition
): GarmentTransform | null {
  const shoulder = calculateShoulderMeasurement(landmarks, dimensions);

  if (!shoulder.isReliable) return null;

  const { width, height } = calculateGarmentScale(shoulder.widthPx, garment);
  const position = calculateGarmentPosition(shoulder.midpoint, width, garment);

  return {
    position,
    width,
    height,
    rotation: shoulder.angle,
  };
}