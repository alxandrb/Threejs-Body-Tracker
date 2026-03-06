/**
 * tracking.js
 * MediaPipe Pose inference loop — completely decoupled from rendering.
 */

import { NJ, opts } from './config.js';
import { state } from './state.js';
import { rawBuf } from './smoothing.js';
import { DOM } from './ui.js';
import { stopRec } from './recording.js';
import { setBodyData } from './ui.js';

let _pose = null;
let _timeout = null;
let _running = false;

function schedule() {
  _timeout = setTimeout(runInference, 1000 / opts.mpFPS);
}

async function runInference() {
  const video = DOM.video;

  if (!_running || !_pose || video.readyState < 2) {
    schedule();
    return;
  }

  try {
    await _pose.send({ image: video });
  } catch (_) { }

  schedule();
}

function onResults(results) {
  DOM.dMp.classList.add('on');

  if (results.poseLandmarks) {
    const lms = results.poseLandmarks;
    const scale = opts.scale;

    for (let i = 0; i < NJ; i++) {
      const b = i * 3;
      rawBuf[b] = -(lms[i].x - 0.5) * scale;
      rawBuf[b + 1] = -(lms[i].y - 0.5) * scale;
      rawBuf[b + 2] = -lms[i].z * 1.2;
    }

    state.detected = true;
    setBodyData(true, 'TRACKING');
  } else {
    state.detected = false;
    state.firstFrame = false;
    setBodyData(false, '-');
    if (state.isRecording) stopRec();
  }
}

export async function initTracking() {
  _pose = new window.Pose({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`,
  });

  _pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.5,
  });

  _pose.onResults(onResults);

  const video = DOM.video;
  await new Promise(resolve => {
    if (video.readyState >= 2) { resolve(); return; }
    video.addEventListener('loadeddata', resolve, { once: true });
  });

  try { await _pose.send({ image: video }); } catch (_) { }
}

export function startMPLoop() {
  _running = true;
  schedule();
}

export function setMPRate(fps) {
  if (_timeout) clearTimeout(_timeout);
  opts.mpFPS = fps;
  if (_running) schedule();
}
