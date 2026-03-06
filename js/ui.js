/**
 * ui.js
 * Centralised DOM cache and UI update utilities.
 *
 * Rules:
 *  - All getElementById calls happen once at module load.
 *  - Render-loop callers must go through updateUI() which is throttled.
 *  - No Three.js or business logic here.
 */

// ─── DOM cache ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

export const DOM = {
  // Webcam
  video: $('video'),

  // Status dots
  dCam: $('d-cam'),
  dMp: $('d-mp'),
  dHand: $('d-hand'),
  dStatus: $('d-status'),

  // Bottom bar spans
  bLm: $('b-lm'),
  bFi: $('b-fi'),
  bHa: $('b-ha'),
  bSm: $('b-sm'),

  // FPS badge
  fps: $('fps'),

  // Loading screen
  loaderBar: $('lb'),
  loaderMsg: $('lm'),
  loadingScreen: $('ls'),
};

// ─── Loading progress ───────────────────────────────────────────────
export function setProgress(pct, msg) {
  DOM.loaderBar.style.width = pct + '%';
  DOM.loaderMsg.textContent = msg;
}

// ─── FPS counter ────────────────────────────────────────────────────
let _fpsLast = 0;
let _fpsCount = 0;

/**
 * Call once per render frame with the rAF timestamp.
 * Updates the FPS badge every ~600 ms.
 */
export function tickFPS(now) {
  _fpsCount++;

  if (now - _fpsLast < 600) return;

  const fps = Math.round(_fpsCount / ((now - _fpsLast) / 1000));
  _fpsCount = 0;
  _fpsLast = now;

  DOM.fps.textContent = fps + ' FPS';
  DOM.fps.className = fps >= 50 ? 'good' : fps >= 28 ? 'mid' : 'bad';
}

// ─── Throttled hand-state UI ─────────────────────────────────────────
/** Staging object written by tracking.js, read by updateUI(). */
const _pending = { detected: false, label: '-' };

/** Called by tracking.js whenever MediaPipe produces a result. */
export function setBodyData(detected, label) {
  _pending.detected = detected;
  _pending.label = label;
}

let _uiTick = 0;

/**
 * Call once per render frame.
 * Flushes pending hand data to the DOM every 8 frames (~8 ms at 60fps).
 * Avoids touching the DOM on every single frame.
 */
export function updateUI() {
  if (++_uiTick < 8) return;
  _uiTick = 0;

  if (_pending.detected) {
    DOM.dHand.classList.add('on');
    DOM.bLm.textContent = '33';
    DOM.bFi.textContent = '';
    DOM.bHa.textContent = _pending.label;
  } else {
    DOM.dHand.classList.remove('on');
    DOM.bLm.textContent = '0';
    DOM.bFi.textContent = '';
    DOM.bHa.textContent = '-';
  }
}
