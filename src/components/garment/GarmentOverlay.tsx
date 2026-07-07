import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { GarmentDefinition, Dimensions } from "@/types/garment";
import { useGarmentRenderer } from "@/hooks/useGarmentRenderer";

interface GarmentOverlayProps {
  /** Canvas the garment is drawn onto — created and owned by the parent. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Ref holding the latest pose landmarks (shared with PoseOverlay). */
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  /** The garment currently selected in the garment rail, or null. */
  garment: GarmentDefinition | null;
  /** Live pixel dimensions of the webcam feed. */
  videoDimensions: Dimensions;
  /** Whether the feed is live and the overlay should render. */
  enabled: boolean;
}

/**
 * Transparent canvas layer that renders the selected garment, anchored to
 * the wearer's shoulders and continuously updated from the shared pose
 * landmark stream produced by usePoseLandmarker.
 *
 * Purely presentational: all math and animation logic lives in
 * useGarmentRenderer / garmentMath / smoothing, so this component stays a
 * thin, easily testable shell. The rendering pipeline (transform →
 * smoothing → draw) is intentionally generic so future garment physics
 * (sway, cloth simulation, layered garments) can extend
 * useGarmentRenderer without this component changing.
 *
 * Layered above the video, below the pose skeleton canvas, so the
 * skeleton overlay used for debugging/QA remains fully visible.
 */
export default function GarmentOverlay({
  canvasRef,
  landmarksRef,
  garment,
  videoDimensions,
  enabled,
}: GarmentOverlayProps) {
  useGarmentRenderer({
    canvasRef,
    landmarksRef,
    garment,
    videoDimensions,
    enabled,
  });

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
