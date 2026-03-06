/**
 * config.js
 * Application-wide constants and mutable options object.
 * All magic numbers live here — nowhere else.
 */

/** Number of body landmarks (MediaPipe Pose) */
export const NJ = 33;

/** Number of bone connections */
export const NC = 35;

/**
 * Bone connection pairs [from, to] — indices into the 33 landmarks.
 */
export const CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Torso / shoulders
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Arms
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Legs
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]
];

/** Indices of extremity landmarks */
export const TIPS = new Set([0, 15, 16, 27, 28, 31, 32]);

/** Anatomical names for all 33 landmarks (used in Blender export) */
export const LANDMARK_NAMES = [
  'Nose', 'Left_Eye_Inner', 'Left_Eye', 'Left_Eye_Outer', 'Right_Eye_Inner', 'Right_Eye', 'Right_Eye_Outer', 'Left_Ear', 'Right_Ear', 'Mouth_Left', 'Mouth_Right',
  'Left_Shoulder', 'Right_Shoulder', 'Left_Elbow', 'Right_Elbow', 'Left_Wrist', 'Right_Wrist', 'Left_Pinky', 'Right_Pinky', 'Left_Index', 'Right_Index', 'Left_Thumb', 'Right_Thumb',
  'Left_Hip', 'Right_Hip', 'Left_Knee', 'Right_Knee', 'Left_Ankle', 'Right_Ankle', 'Left_Heel', 'Right_Heel', 'Left_Foot_Index', 'Right_Foot_Index'
];

/**
 * Runtime options — mutated by the settings panel.
 * Exported as a plain object so all modules share the same reference.
 */
export const opts = {
  /** Lerp alpha applied each render frame (0.02 = max smooth, 1.0 = raw) */
  smooth: 0.18,

  /** World-space scale factor for landmark positions */
  scale: 2.50,

  /** Visibility toggles */
  joints: true,
  bones: true,
  tips: true,
  particles: true,
  cam: true,

  /** Effect toggles */
  pulse: true,
  wire: false,

  /** MediaPipe inference target FPS (independent of render loop) */
  mpFPS: 20,
};
