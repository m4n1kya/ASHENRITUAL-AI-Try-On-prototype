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
  /**
   * Fraction of shoulder width that maps to garment width.
   * e.g. 1.8 means the garment renders at 1.8× the detected shoulder span.
   * Tuned per-garment so a slim blazer can differ from a wide coat.
   */
  shoulderWidthMultiplier: number;
  /**
   * Vertical offset in garment-widths from the shoulder midpoint to the
   * top edge of the garment anchor point.
   * Negative = shift upward (e.g. collar sits above shoulders).
   */
  verticalAnchorOffset: number;
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
