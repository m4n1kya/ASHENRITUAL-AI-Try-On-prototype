import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { SKELETON_CONNECTIONS, DRAW_CONFIG } from "@/utils/poseConstants";

/**
 * Draws one frame of pose landmarks onto a 2D canvas.
 *
 * Kept as a pure utility (no React, no hooks) so it can be called directly
 * inside the rAF loop without any component coupling, and tested in
 * isolation if needed.
 *
 * Coordinates: MediaPipe returns landmarks normalised to [0, 1]. We scale
 * them to canvas pixel space here. The webcam feed is mirrored (CSS
 * `transform: scaleX(-1)`) so we mirror the X axis too (1 - x) so the
 * skeleton stays aligned with the reflected image.
 *
 * @param ctx   2D rendering context of the overlay canvas.
 * @param landmarks  Array of 33 normalised landmarks from one pose result.
 * @param width  Canvas pixel width.
 * @param height Canvas pixel height.
 */
export function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);

  const { lineColor, lineWidth, dotColor, dotRadius, minVisibility } = DRAW_CONFIG;

  // Helper: normalised → pixel coords, accounting for mirror.
  const px = (lm: NormalizedLandmark) => ({
    x: (1 - lm.x) * width,
    y: lm.y * height,
  });

  // 1. Skeleton bones
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    const a = landmarks[startIdx];
    const b = landmarks[endIdx];
    if (!a || !b) continue;
    if ((a.visibility ?? 1) < minVisibility) continue;
    if ((b.visibility ?? 1) < minVisibility) continue;

    const pa = px(a);
    const pb = px(b);

    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // 2. Joint dots (drawn on top of bones so they're always visible)
  ctx.fillStyle = dotColor;

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    for (const idx of [startIdx, endIdx]) {
      const lm = landmarks[idx];
      if (!lm) continue;
      if ((lm.visibility ?? 1) < minVisibility) continue;

      const { x, y } = px(lm);
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
