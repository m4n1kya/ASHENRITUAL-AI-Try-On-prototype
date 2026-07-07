/**
 * MediaPipe Tasks Vision — Pose Landmarker constants.
 *
 * All magic numbers and CDN paths live here so the hook and the drawing
 * utility stay readable and free of hard-coded strings.
 */

// The WASM runtime is served from jsDelivr — no build-time bundle cost.
export const MEDIAPIPE_WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

// The lite model is accurate enough for clothing try-on body tracking and
// runs comfortably above 30 FPS on mid-range hardware.
export const POSE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

/**
 * MediaPipe BlazePose landmark indices used for the try-on skeleton.
 * Only the joints relevant to garment fitting are drawn: shoulders, elbows,
 * wrists, hips, knees, and ankles. The full 33-landmark set is available
 * but would add visual noise on top of a live webcam feed.
 */
export const LANDMARK_INDICES = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Skeleton connections drawn as line segments. Each tuple is [startIndex, endIndex].
 * Defined as paired joints so the draw function can loop over them directly.
 */
export const SKELETON_CONNECTIONS: [number, number][] = [
  // Torso
  [LANDMARK_INDICES.LEFT_SHOULDER,  LANDMARK_INDICES.RIGHT_SHOULDER],
  [LANDMARK_INDICES.LEFT_SHOULDER,  LANDMARK_INDICES.LEFT_HIP],
  [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_HIP],
  [LANDMARK_INDICES.LEFT_HIP,       LANDMARK_INDICES.RIGHT_HIP],
  // Left arm
  [LANDMARK_INDICES.LEFT_SHOULDER,  LANDMARK_INDICES.LEFT_ELBOW],
  [LANDMARK_INDICES.LEFT_ELBOW,     LANDMARK_INDICES.LEFT_WRIST],
  // Right arm
  [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW],
  [LANDMARK_INDICES.RIGHT_ELBOW,    LANDMARK_INDICES.RIGHT_WRIST],
  // Left leg
  [LANDMARK_INDICES.LEFT_HIP,       LANDMARK_INDICES.LEFT_KNEE],
  [LANDMARK_INDICES.LEFT_KNEE,      LANDMARK_INDICES.LEFT_ANKLE],
  // Right leg
  [LANDMARK_INDICES.RIGHT_HIP,      LANDMARK_INDICES.RIGHT_KNEE],
  [LANDMARK_INDICES.RIGHT_KNEE,     LANDMARK_INDICES.RIGHT_ANKLE],
];

/** Visual style for the overlay — matches the project's monochrome palette. */
export const DRAW_CONFIG = {
  /** Skeleton line colour — bright white at partial opacity. */
  lineColor: "rgba(255, 255, 255, 0.75)",
  lineWidth: 2,

  /** Joint dot colour — solid white. */
  dotColor: "rgba(255, 255, 255, 0.95)",
  dotRadius: 4,

  /**
   * Minimum landmark visibility score to draw a joint or bone.
   * MediaPipe scores visibility 0–1; joints occluded or off-screen score
   * low. 0.5 is a reliable cut-off that keeps rendering stable without
   * flickering on partially visible limbs.
   */
  minVisibility: 0.5,
} as const;
