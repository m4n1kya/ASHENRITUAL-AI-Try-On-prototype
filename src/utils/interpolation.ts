/**
 * Generic interpolation primitives.
 *
 * Kept separate from smoothing.ts because these are stateless, reusable
 * math functions (no notion of "previous frame"), while smoothing.ts
 * builds stateful per-frame smoothing on top of them.
 */

/** Clamps a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Linear interpolation between `a` and `b` by factor `t` (0–1).
 * t = 0 returns a, t = 1 returns b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Interpolates between two angles (radians) along the shortest angular
 * path, so rotation doesn't spin the long way around when crossing
 * the -π/π boundary.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  let delta = (b - a) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return a + delta * clamp(t, 0, 1);
}

/**
 * Converts a "smoothing strength" in [0, 1] and a frame delta-time into a
 * frame-rate-independent lerp factor.
 *
 * Without this, smoothing would visibly change speed if the camera runs
 * at 24fps vs 60fps. `smoothing` of 0 = no smoothing (snaps instantly),
 * 1 = never catches up. Typical values sit around 0.75–0.9.
 */
export function frameIndependentFactor(
  smoothing: number,
  deltaMs: number,
  referenceFrameMs = 16.6667
): number {
  const s = clamp(smoothing, 0, 0.999);
  const frames = deltaMs / referenceFrameMs;
  return 1 - Math.pow(s, frames);
}
