/**
 * main.js
 * Application entry point.
 *
 * Responsibilities:
 *  - Camera permission
 *  - Sequential initialisation with loading progress
 *  - Starting the two independent loops (render + MediaPipe)
 *
 * This module should contain NO business logic —
 * only orchestration of the other modules.
 */

import { DOM, setProgress }          from './ui.js';
import { startRenderLoop }           from './renderer.js';
import { initTracking, startMPLoop } from './tracking.js';
import { initRecording }             from './recording.js';
import { initExport }                from './export.js';
import { initSettings }              from './settings.js';

// ─── Helpers ─────────────────────────────────────────────────────────
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── Camera init ─────────────────────────────────────────────────────
async function initCamera() {
  // 320×240: 4× fewer pixels than 640×480 for MediaPipe to process.
  // The video element is only used as a source for inference — not displayed
  // at full resolution — so quality doesn't matter here.
  DOM.video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: {
      width:     320,
      height:    240,
      facingMode: 'user',
      frameRate:  { ideal: 30 },
    },
  });

  DOM.dCam.classList.add('on');
}

// ─── Boot sequence ────────────────────────────────────────────────────
async function init() {
  setProgress(10, 'THREE.JS READY');
  await delay(150);

  // Step 1 — Camera
  setProgress(25, 'REQUESTING CAMERA...');
  try {
    await initCamera();
    setProgress(50, 'CAMERA ACTIVE');
  } catch (err) {
    setProgress(25, 'CAMERA ACCESS DENIED — PLEASE ALLOW');
    console.error('[main] Camera error:', err);
    return; // Cannot continue without camera
  }

  // Step 2 — MediaPipe model load + warm-up
  setProgress(65, 'LOADING MEDIAPIPE...');
  await delay(150);
  await initTracking();
  setProgress(85, 'MODEL READY');

  // Step 3 — UI modules
  initRecording();
  initExport();
  initSettings();

  // Step 4 — Start loops
  setProgress(95, 'STARTING LOOPS...');
  startMPLoop();      // MediaPipe inference (~20fps, setTimeout-based)
  startRenderLoop();  // Three.js render (~60fps, rAF-based)

  // Done
  setProgress(100, 'READY');
  DOM.dStatus.textContent = 'LIVE';

  await delay(250);
  DOM.loadingScreen.classList.add('hidden');
}

init();
