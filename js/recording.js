/**
 * recording.js
 * Manages the capture of hand animation frames.
 *
 * Captures smoothed landmark positions at up to 30fps,
 * independently of the render loop frame rate.
 * Stores frames in memory until export.js serialises them.
 */

import { state }      from './state.js';
import { smoothPos }  from './smoothing.js';
import { DOM }        from './ui.js';

// ─── Constants ──────────────────────────────────────────────────────
const MAX_CAPTURE_FPS = 30;
const CAP_INTERVAL_MS = 1000 / MAX_CAPTURE_FPS;

// ─── State ──────────────────────────────────────────────────────────
export let recFrames = []; // exported so export.js can read it
let _recStart  = 0;
let _recDur    = 5;        // seconds (0 = unlimited)
let _recTimer  = null;
let _lastCap   = 0;

// ─── Cached DOM refs ────────────────────────────────────────────────
// Resolved lazily (called after DOMContentLoaded)
let _dom = null;

function getRecDom() {
  if (_dom) return _dom;
  const $ = id => document.getElementById(id);
  _dom = {
    rdot:   $('rd'),
    rst:    $('rst'),
    timer:  $('rtimer'),
    fcount: $('rfc'),
    ffps:   $('rfps'),
    pbar:   $('rpb'),
    recbtn: $('recbtn'),
    expbtn: $('expbtn'),
    hint:   $('rhint'),
  };
  return _dom;
}

// ─── Public: start ───────────────────────────────────────────────────
export function startRec() {
  const d = getRecDom();
  recFrames  = [];
  _recStart  = performance.now();
  _lastCap   = 0;
  state.isRecording = true;

  d.recbtn.textContent = '⏹ STOP RECORDING';
  d.recbtn.classList.add('stop');
  d.rdot.classList.add('recording');
  d.rst.textContent = 'REC';
  d.timer.classList.add('active');
  d.expbtn.classList.remove('visible');
  d.pbar.style.width = '0%';
  DOM.video.classList.add('rec-on');

  document.querySelectorAll('.db').forEach(b => { b.disabled = true; });
  _recTimer = setInterval(_tickUI, 100);
}

// ─── Public: stop ────────────────────────────────────────────────────
export function stopRec() {
  if (!state.isRecording) return;

  state.isRecording = false;
  clearInterval(_recTimer);

  const d   = getRecDom();
  const el  = recFrames.length > 0 ? recFrames[recFrames.length - 1].t : 0;
  const fps = (recFrames.length / Math.max(el, 0.001)).toFixed(1);

  d.recbtn.textContent = '⏺ START RECORDING';
  d.recbtn.classList.remove('stop');
  d.rdot.classList.remove('recording');
  d.rdot.classList.add('ready');
  d.rst.textContent = 'DONE';
  d.timer.classList.remove('active');
  d.pbar.style.width = '100%';
  DOM.video.classList.remove('rec-on');

  document.querySelectorAll('.db').forEach(b => { b.disabled = false; });

  if (recFrames.length > 0) {
    d.expbtn.classList.add('visible');
    d.hint.textContent = `✓ ${recFrames.length} frames @ ${fps}fps`;
  }
}

// ─── Public: capture (called by renderer each frame) ─────────────────
export function captureFrame() {
  const now = performance.now();
  if (now - _lastCap < CAP_INTERVAL_MS) return;
  _lastCap = now;

  recFrames.push({
    t: +((now - _recStart) / 1000).toFixed(4),
    // Flat array: [x0,y0,z0, x1,y1,z1, ...] — minimal JSON footprint
    lm: smoothPos.flatMap(p => [
      +p.x.toFixed(5),
      +p.y.toFixed(5),
      +p.z.toFixed(5),
    ]),
  });
}

// ─── Public: init (wire up panel controls) ───────────────────────────
export function initRecording() {
  const d = getRecDom();

  d.recbtn.addEventListener('click', () => {
    state.isRecording ? stopRec() : startRec();
  });

  document.querySelectorAll('.db').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.isRecording) return;
      document.querySelectorAll('.db').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _recDur = parseInt(btn.dataset.sec, 10);
      d.pbar.style.width = '0%';
    });
  });
}

// ─── Internal: UI tick (runs every 100ms while recording) ───────────
function _tickUI() {
  if (!state.isRecording) return;
  const d  = getRecDom();
  const el = (performance.now() - _recStart) / 1000;
  const m  = Math.floor(el / 60);
  const s  = Math.floor(el % 60);

  d.timer.textContent  = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  d.fcount.textContent = recFrames.length + ' FRAMES';

  if (el > 0) {
    d.ffps.textContent = (recFrames.length / el).toFixed(1) + ' fps';
  }

  if (_recDur > 0) {
    d.pbar.style.width = Math.min(100, (el / _recDur) * 100) + '%';
    if (el >= _recDur) stopRec();
  }
}
