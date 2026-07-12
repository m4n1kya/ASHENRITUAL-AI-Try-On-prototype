import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  Point2D,
  Dimensions,
  ShoulderMeasurement,
  GarmentDefinition,
  GarmentTransform,
  GarmentZone,
  GarmentFitStyle,
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
 * garment width for the legacy single-rect transform. 0 = shoulder width
 * only. 1 = torso height only. Kept low so shoulder width continues to
 * dominate. (Not used by the new two-zone body-fit path — see
 * calculateGarmentZones, which derives width per-zone instead.)
 */
const WIDTH_BLEND_TORSO_INFLUENCE = 0.25;

/**
 * Clamp on how much torso proportions may stretch/compress garment height
 * relative to the width-derived baseline. ±15% is enough to read as
 * "this person's torso is proportionally longer/shorter" without ever
 * looking exaggerated or obviously wrong on an unusual pose. Shared by
 * both the legacy single-rect path and the new per-zone path.
 */
const MIN_HEIGHT_STRETCH = 0.85;
const MAX_HEIGHT_STRETCH = 1.15;

/**
 * How far the garment's anchor center sits from the shoulder midpoint
 * toward the hip midpoint, when hips are visible, for the legacy
 * single-rect transform. 0 = shoulders only. 1 = hips only.
 */
const BODY_CENTER_HIP_BLEND = 0.28;

/**
 * How far the new two-zone renderer's BOTTOM zone anchor sits toward the
 * actual hip midpoint (vs. a fixed offset below the shoulders). Much
 * higher than BODY_CENTER_HIP_BLEND above because this zone's entire job
 * is to visually follow the hips — that's requirement 4 ("bottom must
 * naturally follow hip position").
 */
const BOTTOM_ZONE_HIP_BLEND = 0.85;

/**
 * How far (in shoulder-widths) a wrist must travel past the body
 * centerline before arm-crossing confidence reaches 1.0. Smaller values
 * make the occlusion effect trigger more eagerly on a small reach;
 * larger values require a more decisive crossing gesture.
 */
const OCCLUSION_CROSS_DISTANCE_RATIO = 0.5;

function distance(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Rotates a vector by `angle` radians. Used to offset zone centers along a shared rotated axis. */
function rotateVector(v: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
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
// Arm occlusion heuristic (shoulders + elbows + wrists — no segmentation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-arm occlusion result. `crossing` and `confidence` describe whether
 * (and how confidently) this arm has moved in front of the torso;
 * `elbow`/`wrist` are the pixel-space points a caller would erase a
 * capsule between to reveal the real arm through the garment.
 */
export interface ArmOcclusionSide {
  /** True once both elbow and wrist have crossed past the body centerline. */
  crossing: boolean;
  /** 0–1 — how confidently this arm reads as being in front of the torso. */
  confidence: number;
  elbow: Point2D;
  wrist: Point2D;
}

export interface ArmOcclusionMeasurement {
  left: ArmOcclusionSide;
  right: ArmOcclusionSide;
}

function sideOfCenterline(x: number, centerlineX: number): number {
  return x >= centerlineX ? 1 : -1;
}

function calculateArmSide(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions,
  elbowIdx: number,
  wristIdx: number,
  shoulderPx: Point2D,
  centerlineX: number,
  shoulderWidthPx: number
): ArmOcclusionSide {
  const elbowLm = landmarks[elbowIdx];
  const wristLm = landmarks[wristIdx];

  const visible =
    (elbowLm?.visibility ?? 0) >= MIN_VISIBILITY &&
    (wristLm?.visibility ?? 0) >= MIN_VISIBILITY;

  if (!visible || shoulderWidthPx <= 0) {
    return { crossing: false, confidence: 0, elbow: shoulderPx, wrist: shoulderPx };
  }

  const elbow = normalizedToPixel(elbowLm, dimensions);
  const wrist = normalizedToPixel(wristLm, dimensions);

  const shoulderSide = sideOfCenterline(shoulderPx.x, centerlineX);
  const elbowSide = sideOfCenterline(elbow.x, centerlineX);
  const wristSide = sideOfCenterline(wrist.x, centerlineX);

  const crossing = elbowSide !== shoulderSide && wristSide !== shoulderSide;

  if (!crossing) {
    return { crossing: false, confidence: 0, elbow, wrist };
  }

  const crossDistancePx = Math.abs(wrist.x - centerlineX);
  const confidence = clamp(
    crossDistancePx / (shoulderWidthPx * OCCLUSION_CROSS_DISTANCE_RATIO),
    0,
    1
  );

  return { crossing: true, confidence, elbow, wrist };
}

/**
 * Heuristic (landmarks only — no segmentation, no additional models)
 * estimate of whether either arm is currently in front of the torso, and
 * where along that arm the "in front" region is. Callers with low
 * confidence should treat it as "not crossing" and render normally —
 * confidence is continuous specifically so that fallback is automatic
 * rather than a separate branch.
 */
export function calculateArmOcclusion(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions,
  shoulder: ShoulderMeasurement
): ArmOcclusionMeasurement {
  const empty: ArmOcclusionSide = {
    crossing: false,
    confidence: 0,
    elbow: shoulder.midpoint,
    wrist: shoulder.midpoint,
  };

  if (!shoulder.isReliable) {
    return { left: empty, right: empty };
  }

  const leftShoulderLm = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
  const rightShoulderLm = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
  const leftShoulderPx = normalizedToPixel(leftShoulderLm, dimensions);
  const rightShoulderPx = normalizedToPixel(rightShoulderLm, dimensions);
  const centerlineX = shoulder.midpoint.x;

  const left = calculateArmSide(
    landmarks,
    dimensions,
    LANDMARK_INDICES.LEFT_ELBOW,
    LANDMARK_INDICES.LEFT_WRIST,
    leftShoulderPx,
    centerlineX,
    shoulder.widthPx
  );
  const right = calculateArmSide(
    landmarks,
    dimensions,
    LANDMARK_INDICES.RIGHT_ELBOW,
    LANDMARK_INDICES.RIGHT_WRIST,
    rightShoulderPx,
    centerlineX,
    shoulder.widthPx
  );

  return { left, right };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual calculation exports (legacy single-rect path — kept intact)
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

/**
 * Legacy single-rect transform. No longer called by useGarmentRenderer.ts
 * (which now uses calculateGarmentZones below), but kept fully functional
 * and exported — nothing that already imports this needs to change.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Body-fit zones (new — two-zone shoulder/hip-aware renderer)
// ─────────────────────────────────────────────────────────────────────────────

/** Per-fit-style tuning. Not exported — an implementation detail of calculateGarmentZones. */
interface GarmentFitProfile {
  /** How closely the TOP zone's width tracks measured shoulder width. 1 = exact. */
  shoulderHug: number;
  /** How much wider the BOTTOM zone is than the top zone. 1 = straight silhouette, >1 = flares toward hips. */
  hipFlare: number;
  /** How strongly torso-height proportions stretch/compress garment length. 0 = ignore, 1 = fully follow. */
  verticalStretchSensitivity: number;
  /** Fraction of total garment height given to the top zone (rest goes to bottom). */
  topZoneRatio: number;
}

/**
 * Tuned per garment archetype. Values are deliberately simple/explainable
 * rather than derived from any dataset — this is a lightweight heuristic
 * renderer, not a fabric simulation.
 */
const FIT_PROFILES: Record<GarmentFitStyle, GarmentFitProfile> = {
  "t-shirt": {
    shoulderHug: 1.0,
    hipFlare: 1.05,
    verticalStretchSensitivity: 0.65, // soft jersey fabric follows torso proportions closely
    topZoneRatio: 0.45,
  },
  hoodie: {
    shoulderHug: 1.1, // boxier — room for hood/bulk at the shoulder line
    hipFlare: 1.18, // relaxed fit, flares more at the hem
    verticalStretchSensitivity: 0.55,
    topZoneRatio: 0.4,
  },
  jacket: {
    shoulderHug: 1.03, // fitted, close to measured shoulder scale
    hipFlare: 1.0, // structured blazer silhouette — doesn't flare
    verticalStretchSensitivity: 0.45, // structured fabric/lining resists stretch
    topZoneRatio: 0.5,
  },
  coat: {
    shoulderHug: 1.18, // boxiest — worn over other layers
    hipFlare: 1.3, // coats flare the most dramatically toward the hem
    verticalStretchSensitivity: 0.35, // heaviest fabric, least responsive to torso stretch
    topZoneRatio: 0.35, // proportionally longer body/bottom zone
  },
};

/**
 * Computes a two-zone body-fit transform for one frame: a shoulder-locked
 * top zone and a hip-following bottom zone, each independently scaled on
 * X and Y and sourced from a horizontal slice of the garment texture.
 *
 * Returns null under the same conditions as the legacy
 * calculateGarmentTransform (disabled garment, unsupported anchor type,
 * unreliable shoulders) — when shoulders ARE reliable but hips aren't
 * visible, this still returns two zones, using a straight-down fallback
 * for the bottom anchor so behavior degrades gracefully rather than
 * disappearing.
 */
export function calculateGarmentZones(
  landmarks: NormalizedLandmark[],
  dimensions: Dimensions,
  garment: GarmentDefinition
): GarmentZone[] | null {
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
  const fit = FIT_PROFILES[garment.fitStyle ?? "t-shirt"];
  const rotation = shoulder.angle + garment.rotationOffsetRad;

  const effectiveScale = clamp(
    garment.defaultScale,
    garment.scaleLimits.min,
    garment.scaleLimits.max
  );

  // Widths — independent X scaling per zone (requirement 3).
  const topWidthPx = shoulder.widthPx * effectiveScale * fit.shoulderHug;
  const bottomWidthPx = topWidthPx * fit.hipFlare;

  // Total height — reuses the aspect-ratio-from-top-width basis, then
  // applies a per-fit-style-sensitized torso stretch (requirement 1),
  // still hard-clamped to ±15% so nothing looks exaggerated.
  const aspectRatio = garment.naturalHeight / garment.naturalWidth;
  const baseHeight = topWidthPx * aspectRatio;

  let totalHeight = baseHeight;
  if (torso.isReliable) {
    const rawRatio = torso.torsoHeightPx / shoulder.widthPx / REFERENCE_TORSO_ASPECT;
    const sensitizedRatio = lerp(1, rawRatio, fit.verticalStretchSensitivity);
    const heightStretch = clamp(sensitizedRatio, MIN_HEIGHT_STRETCH, MAX_HEIGHT_STRETCH);
    totalHeight = baseHeight * heightStretch;
  }

  const topZoneHeightPx = totalHeight * fit.topZoneRatio;
  const bottomZoneHeightPx = totalHeight - topZoneHeightPx;

  // Top zone: its TOP EDGE is locked exactly to the shoulder anchor
  // (requirement 4, "top must lock to shoulders"). The zone's center is
  // then offset downward by half its own height, along the shared
  // rotation axis, so it stays correctly oriented at any lean angle.
  const topEdgeWorld = calculateGarmentPosition(shoulder.midpoint, topWidthPx, garment);
  const topCenterOffset = rotateVector({ x: 0, y: topZoneHeightPx / 2 }, rotation);
  const topPosition: Point2D = {
    x: topEdgeWorld.x + topCenterOffset.x,
    y: topEdgeWorld.y + topCenterOffset.y,
  };

  // Bottom zone: its BOTTOM EDGE naturally follows the hip position
  // (requirement 4) — blended heavily toward the actual hip midpoint
  // rather than a fixed offset below the shoulders, so it genuinely
  // tracks hip movement independent of shoulder lean. Falls back to a
  // straight-down point when hips aren't visible.
  const bottomEdgeWorld = torso.isReliable
    ? {
        x: lerp(shoulder.midpoint.x, torso.hipMidpoint.x, BOTTOM_ZONE_HIP_BLEND),
        y: lerp(shoulder.midpoint.y, torso.hipMidpoint.y, BOTTOM_ZONE_HIP_BLEND),
      }
    : {
        x: topEdgeWorld.x + rotateVector({ x: 0, y: totalHeight }, rotation).x,
        y: topEdgeWorld.y + rotateVector({ x: 0, y: totalHeight }, rotation).y,
      };
  const bottomCenterOffset = rotateVector({ x: 0, y: -bottomZoneHeightPx / 2 }, rotation);
  const bottomPosition: Point2D = {
    x: bottomEdgeWorld.x + bottomCenterOffset.x,
    y: bottomEdgeWorld.y + bottomCenterOffset.y,
  };

  return [
    {
      position: topPosition,
      width: topWidthPx,
      height: topZoneHeightPx,
      rotation,
      sourceY: 0,
      sourceHeight: garment.naturalHeight * fit.topZoneRatio,
    },
    {
      position: bottomPosition,
      width: bottomWidthPx,
      height: bottomZoneHeightPx,
      rotation,
      sourceY: garment.naturalHeight * fit.topZoneRatio,
      sourceHeight: garment.naturalHeight * (1 - fit.topZoneRatio),
    },
  ];
}