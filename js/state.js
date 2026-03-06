/**
 * state.js
 * Single source of truth for shared runtime flags.
 *
 * Kept minimal — only values that need to be read/written
 * by multiple independent modules belong here.
 * Do NOT store derived or UI-only state here.
 */
export const state = {
  /** True when MediaPipe is actively tracking a hand */
  detected: false,

  /**
   * True after the first MediaPipe frame has been received.
   * Used by smoothing to skip the lerp on the very first frame
   * (avoids the hand "flying in" from origin).
   */
  firstFrame: false,

  /** True while the animation recorder is capturing frames */
  isRecording: false,
};
