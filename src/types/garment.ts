import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// ─────────────────────────────────────────────
// Core geometry primitives
// ─────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

// ─────────────────────────────────────────────
// Garment definition
// ─────────────────────────────────────────────

export type GarmentCategory = "top" | "outerwear" | "dress" | "bottom";

/**
 * Which pose landmark group a garment anchors to. Only "shoulders" is
 * implemented by the renderer today — this is a union rather than a
 * single literal so future categories (e.g. "hips" for trousers, "head"
 * for hats) can be added to the catalog and type-checked everywhere
 * without another schema change. garmentMath.ts safely no-ops on any
 * anchor type it doesn't yet know how to compute.
 */
export type GarmentAnchorType = "shoulders";

/**
 * Hard bounds on a garment's effective scale multiplier. Exists so a bad
 * or extreme value can never render an absurdly large or tiny garment,
 * and doubles as the exact range a future "Adjust Fit" control (already
 * stubbed in the UI) will read from once live scale adjustment is wired
 * up — no schema change needed when that ships.
 */
export interface GarmentScaleLimits {
  min: number;
  max: number;
}

export interface GarmentDefinition {
  /** Unique identifier. */
  id: string;
  /** Display label shown in the garment rail. */
  name: string;
  /** Category used to pick anchor strategy. */
  category: GarmentCategory;
  /** Path or URL to the transparent PNG asset. */
  imageUrl: string;
  /**
   * Intrinsic pixel dimensions of the source asset.
   * Used to maintain aspect ratio during scaling.
   */
  naturalWidth: number;
  naturalHeight: number;

  /** Which landmark group this garment anchors to. */
  anchorType: GarmentAnchorType;

  /**
   * Fraction of shoulder width that maps to garment width at 1.0 scale.
   * e.g. 1.8 means the garment renders at 1.8× the detected shoulder span.
   * Clamped at render time to scaleLimits below.
   */
  defaultScale: number;

  /** Hard clamp applied to defaultScale (and any future live adjustment). */
  scaleLimits: GarmentScaleLimits;

  /**
   * Vertical offset in garment-widths from the shoulder midpoint to the
   * top edge of the garment anchor point.
   * Negative = shift upward (e.g. collar sits above shoulders).
   */
  verticalAnchorOffset: number;

  /**
   * Static rotation bias, in radians, added on top of the measured
   * shoulder angle. Useful when a garment's source art is drawn at a
   * slight inherent tilt and needs a fixed correction independent of
   * the wearer's actual pose. 0 for perfectly upright artwork.
   */
  rotationOffsetRad: number;

  /**
   * Paint order when multiple garments render at once. Not yet consumed
   * by the renderer (today's UI is single-select, one garment at a time),
   * but reserved so future layering (e.g. a coat drawn over a top)
   * doesn't require another schema change.
   */
  zIndex: number;

  /**
   * Whether this garment appears in the catalog's selectable set.
   * Lets a garment be kept in the data file (e.g. a work-in-progress
   * asset) without appearing in the UI, rather than commenting it out.
   */
  enabled: boolean;
}

// ─────────────────────────────────────────────
// Per-frame computed transform
// ─────────────────────────────────────────────

export interface GarmentTransform {
  /** Canvas-pixel centre of the garment. */
  position: Point2D;
  /** Rendered pixel width. Height is derived from the asset aspect ratio. */
  width: number;
  /** Rendered pixel height. */
  height: number;
  /** Body rotation in radians (positive = leaning right). */
  rotation: number;
}

// ─────────────────────────────────────────────
// Smoothed internal state (lives in a ref, not React state)
// ─────────────────────────────────────────────

export interface SmoothedTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// ─────────────────────────────────────────────
// Shoulder measurement extracted from landmarks
// ─────────────────────────────────────────────

export interface ShoulderMeasurement {
  /** Pixel-space midpoint between the two shoulders. */
  midpoint: Point2D;
  /** Pixel-space distance between the two shoulder landmarks. */
  widthPx: number;
  /** Angle in radians of the shoulder line relative to horizontal. */
  angle: number;
  /** True when both landmarks have acceptable visibility scores. */
  isReliable: boolean;
}

// ─────────────────────────────────────────────
// Hook input / output
// ─────────────────────────────────────────────

export interface UseGarmentRendererOptions {
  /** Canvas drawn on by the garment overlay. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /**
   * Ref holding the latest detected landmark array (or null when no pose
   * is currently detected). A ref rather than a plain value — the same
   * ref usePoseLandmarker already writes to on every detection frame — so
   * the garment render loop can read the newest frame without forcing a
   * React re-render on every single detection.
   */
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  /** The garment to render, or null to clear the canvas. */
  garment: GarmentDefinition | null;
  /** Pixel dimensions of the live video feed. */
  videoDimensions: Dimensions;
  /** Set false to pause rendering (e.g. camera is off). */
  enabled: boolean;
}