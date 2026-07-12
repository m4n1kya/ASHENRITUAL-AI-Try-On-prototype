import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  Point2D,
  Dimensions,
  ShoulderMeasurement,
  GarmentDefinition,
  GarmentTransform,
} from "@/types/garment";
import { LANDMARK_INDICES } from "@/utils/poseConstants";
import { clamp, lerp } from "@/utils/interpolation";

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
 * snapping into an unrealistic spin on a noisy frame. This clamps the
 * *measured* angle only — a garment's own rotationOffsetRad (a fixed art
 * correction) is applied afterward, unclamped.
 */
const MAX_ROTATION_RAD = (35 * Math.PI) / 180;

function clampRotation(angle: number): number {
  if (angle > MAX_ROTATION_RAD) return MAX_ROTATION_RAD;
  if (angle < -MAX_ROTATION_RAD) return -MAX_ROTATION_RAD;
  return angle;
}

/**
 * Typical torsoHeightPx / shoulderWidthPx ratio for an average adult body.
 * Used as the neutral reference point: a measured ratio above this reads
 * as a proportionally taller torso, below it reads as shorter. Because
 * it's a ratio of two measurements taken from the same frame, it's
 * distance-invariant — it doesn't matter how close the person is to the
 * camera, only how their torso height compares to their own shoulder
 * width. Tunable if real-world testing suggests a better neutral value.
 */
const REFERENCE_TORSO_ASPECT = 1.4;

/**
 * How much torso-height-implied width blends into the shoulder-width-based
 * garment width. 0 = shoulder width only (old behavior). 1 = torso height
 * only. Kept low so shoulder width — the primary, most reliable measurement
 * — continues to dominate garment width, with torso proportions as a
 * secondary refinement rather than a replacement.
 */
const WIDTH_BLEND_TORSO_INFLUENCE = 0.25;

/**
 * Clamp on how much torso proportions may stretch/compress garment height
 * relative to the width-derived baseline. ±15% is enough to read as
 * "this person's torso is proportionally longer/shorter" without ever
 * looking exaggerated or obviously wrong on an unusual pose.
 */
const MIN_HEIGHT_STRETCH = 0.85;
const MAX_HEIGHT_STRETCH = 1.15;

/**
 * How far the garment's anchor center sits from the shoulder midpoint
 * toward the hip midpoint, when hips are visible. 0 = shoulders only (old
 * behavior). 1 = hips only. A modest blend reads as a natural chest/upper-
 * torso anchor rather than snapping to either extreme.
 */
const BODY_CENTER_HIP_BLEND = 0.28;

function distance(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a normalised MediaPipe landmark to pixel coordinates.
 * Mirrors X because the webcam feed is CSS-mirrored (scaleX(-1)).
 *
 * Orientation note: this always derives pixel position from the actual
 * `dimensions.width`/`dimensions.height` passed in, never an assumed
 * aspect ratio — so it's correct for both landscape and portrait webcam
 * feeds (e.g. a phone camera fed in via Phone Link) without any
 * orientation-specific branching anywhere in this file.
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
// Torso measurement (shoulders + hips)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Torso geometry extracted from shoulder + hip landmarks together.
 * Exported alongside ShoulderMeasurement for the same reasons: testability
 * and future reuse (e.g. a future bottom-anchored garment category would
 * read hipMidpoint directly rather than recomputing it).
 */
export interface TorsoMeasurement {
  /** Pixel-space midpoint between the two hip landmarks. */
  hipMidpoint: Point2D;
  /**
   * Pixel-space distance between the shoulder midpoint and hip midpoint.
   * 0 when hips aren't reliably visible (see isReliable).
   */
  torsoHeightPx: number;
  /**
   * True when both hip landmarks are visible enough to trust, and the
   * resulting measurement is non-degenerate. False whenever only the
   * upper body is in frame — a very common webcam framing — in which
   * case callers should fall back to shoulder-only behavior rather than
   * distrust the whole pose.
   */
  isReliable: boolean;
}

/**
 * Extracts torso geometry (hip midpoint, torso height) from a landmark
 * array, given an already-computed ShoulderMeasurement so shoulder
 * midpoint isn't recomputed.
 *
 * Gracefully degrades: if hips aren't visible (upper-body-only framing,
 * very common for a webcam try-on), returns isReliable: false rather than
 * throwing or producing a nonsensical value — callers fall back to
 * shoulder-only behavior identical to before this feature existed.
 */
export function calculateTorsoMeasurement(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions,
  shoulder: ShoulderMeasurement
): TorsoMeasurement {
  const leftHipLm = landmarks[LANDMARK_INDICES.LEFT_HIP];
  const rightHipLm = landmarks[LANDMARK_INDICES.RIGHT_HIP];

  const hipsVisible =
    (leftHipLm?.visibility ?? 0) >= MIN_VISIBILITY &&
    (rightHipLm?.visibility ?? 0) >= MIN_VISIBILITY;

  if (!hipsVisible) {
    return { hipMidpoint: shoulder.midpoint, torsoHeightPx: 0, isReliable: false };
  }

  const leftHip = normalizedToPixel(leftHipLm, dimensions);
  const rightHip = normalizedToPixel(rightHipLm, dimensions);

  const hipMidpoint: Point2D = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  const torsoHeightPx = distance(shoulder.midpoint, hipMidpoint);

  const isReliable = torsoHeightPx > 0 && shoulder.widthPx > 0;

  return { hipMidpoint, torsoHeightPx, isReliable };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual calculation exports (used by tests / future physics)
// ─────────────────────────────────────────────────────────────────────────────

export function calculateShoulderWidth(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions
): number {
  return calculateShoulderMeasurement(landmarks, dimensions).widthPx;
}

export function calculateBodyRotation(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions
): number {
  return calculateShoulderMeasurement(landmarks, dimensions).angle;
}

export function calculateGarmentScale(
  shoulderWidthPx: number,
  garment: GarmentDefinition
): { width: number; height: number } {
  const effectiveScale = clamp(
    garment.defaultScale,
    garment.scaleLimits.min,
    garment.scaleLimits.max
  );
  const width = shoulderWidthPx * effectiveScale;
  const aspectRatio = garment.naturalHeight / garment.naturalWidth;
  return { width, height: width * aspectRatio };
}

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

export function calculateGarmentTransform(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions,
  garment: GarmentDefinition
): GarmentTransform | null {
  if (!garment.enabled) return null;

  if (garment.anchorType !== "shoulders") {
    if (import.meta.env.DEV) {
      console.warn(
        `[garmentMath] anchorType "${garment.anchorType}" on garment "${garment.id}" is not yet supported by the renderer.`
      );
    }
    return null;
  }

  const shoulder = calculateShoulderMeasurement(landmarks, dimensions);
  if (!shoulder.isReliable) return null;

  const torso = calculateTorsoMeasurement(landmarks, dimensions, shoulder);

  const widthBasisPx = torso.isReliable
    ? lerp(
        shoulder.widthPx,
        torso.torsoHeightPx / REFERENCE_TORSO_ASPECT,
        WIDTH_BLEND_TORSO_INFLUENCE
      )
    : shoulder.widthPx;

  const { width, height: baseHeight } = calculateGarmentScale(widthBasisPx, garment);

  const heightStretch = torso.isReliable
    ? clamp(
        torso.torsoHeightPx / shoulder.widthPx / REFERENCE_TORSO_ASPECT,
        MIN_HEIGHT_STRETCH,
        MAX_HEIGHT_STRETCH
      )
    : 1;
  const height = baseHeight * heightStretch;

  const centerPoint = torso.isReliable
    ? {
        x: lerp(shoulder.midpoint.x, torso.hipMidpoint.x, BODY_CENTER_HIP_BLEND),
        y: lerp(shoulder.midpoint.y, torso.hipMidpoint.y, BODY_CENTER_HIP_BLEND),
      }
    : shoulder.midpoint;

  const position = calculateGarmentPosition(centerPoint, width, garment);

  return {
    position,
    width,
    height,
    rotation: shoulder.angle + garment.rotationOffsetRad,
  };
}