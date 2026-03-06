/**
 * smoothing.js
 * Bridges the MediaPipe loop (~20fps) and the render loop (~60fps).
 *
 * MediaPipe writes raw positions into rawBuf (Float32Array).
 * The render loop calls applySmoothing() every frame, which lerps
 * smoothPos toward rawBuf — producing fluid motion at full framerate
 * even when inference runs slower.
 *
 * Zero allocations in the hot path: lerp is computed in-place.
 */

import { NJ } from './config.js';
import { state } from './state.js';

/**
 * Raw landmark positions written directly by the MediaPipe callback.
 * Layout: [x0, y0, z0, x1, y1, z1, ...] — flat for cache efficiency.
 * @type {Float32Array}
 */
export const rawBuf = new Float32Array(NJ * 3);

/**
 * Smoothed (lerped) positions consumed by the renderer.
 * Stored as plain {x, y, z} objects to avoid a Three.js import here.
 * body.js reads these directly when building instance matrices.
 * @type {Array<{x: number, y: number, z: number}>}
 */
export const smoothPos = Array.from(
  { length: NJ },
  () => ({ x: 0, y: 0, z: 0 }),
);

/**
 * Apply one lerp step from rawBuf → smoothPos.
 * Must be called once per render frame while a body is detected.
 *
 * @param {number} alpha - Lerp factor [0.02 … 1.0].
 *                         Lower = smoother (more lag).
 *                         Higher = snappier (more jitter).
 */
export function applySmoothing(alpha) {
  for (let i = 0; i < NJ; i++) {
    const b = i * 3;

    if (!state.firstFrame) {
      // First frame: snap directly — avoid body flying in from (0,0,0).
      smoothPos[i].x = rawBuf[b];
      smoothPos[i].y = rawBuf[b + 1];
      smoothPos[i].z = rawBuf[b + 2];
    } else {
      smoothPos[i].x += (rawBuf[b] - smoothPos[i].x) * alpha;
      smoothPos[i].y += (rawBuf[b + 1] - smoothPos[i].y) * alpha;
      smoothPos[i].z += (rawBuf[b + 2] - smoothPos[i].z) * alpha;
    }
  }

  state.firstFrame = true;
}
