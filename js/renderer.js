/**
 * renderer.js
 * Three.js setup and the main render loop.
 *
 * The render loop NEVER waits for MediaPipe.
 * It reads from smoothPos (written by smoothing.js) and runs
 * unconditionally at ~60fps regardless of inference speed.
 */

/* global THREE */
import { opts } from './config.js';
import { state } from './state.js';
import { tickFPS, updateUI } from './ui.js';
import { applySmoothing } from './smoothing.js';
import {
  jointMesh, boneMesh, glowMesh,
  jointMat, boneMat,
  updateJointInstances,
  updateBoneInstances
} from './body.js';
import { captureFrame } from './recording.js';

// ─── Renderer ──────────────────────────────────────────────────────
const canvas = document.getElementById('c');

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // off for performance
  alpha: true,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;

// ─── Scene ─────────────────────────────────────────────────────────
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera.position.set(0, 0, 1.4);

// ─── Lights ────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x112233, 1.0));

const rimLight = new THREE.DirectionalLight(0x00ffe7, 0.9);
rimLight.position.set(-2, 2, 1);
scene.add(rimLight);

export const pinkLight = new THREE.PointLight(0xff00aa, 1.0, 3);
pinkLight.position.set(1, -1, 0.5);
scene.add(pinkLight);

export const fillLight = new THREE.PointLight(0x00ffe7, 0.5, 3);
fillLight.position.set(-0.5, 0.5, 1);
scene.add(fillLight);

// ─── Add body meshes to scene ───────────────────────────────────────
scene.add(jointMesh, boneMesh, glowMesh);

// ─── Idle camera drift (no body detected) ──────────────────────────
let _t = 0;

function driftCamera() {
  camera.position.x = Math.sin(_t * 0.3) * 0.05;
  camera.position.y = Math.cos(_t * 0.2) * 0.03;
}

// ─── Pulse effect ───────────────────────────────────────────────────
function applyPulse() {
  const p = Math.sin(_t * 2.5) * 0.5 + 0.5;
  pinkLight.intensity = 0.8 + p * 0.45;
  fillLight.intensity = 0.35 + p * 0.25;

  if (state.detected) {
    jointMat.emissiveIntensity = 0.25 + p * 0.3;
    boneMat.emissiveIntensity = 0.08 + p * 0.12;
  }
}

// ─── Render loop ────────────────────────────────────────────────────
function loop(now) {
  requestAnimationFrame(loop);

  _t += 0.01;
  tickFPS(now);
  updateUI();

  if (state.detected) {
    applySmoothing(opts.smooth);

    if (state.isRecording) captureFrame();

    updateJointInstances();
    updateBoneInstances();

    jointMesh.visible = opts.joints;
    boneMesh.visible = opts.bones;
    glowMesh.visible = opts.particles;
  } else {
    driftCamera();
    jointMesh.visible = false;
    boneMesh.visible = false;
    glowMesh.visible = false;
  }

  if (opts.pulse) applyPulse();

  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

// ─── Public API ─────────────────────────────────────────────────────
export function startRenderLoop() {
  requestAnimationFrame(loop);
}

// ─── Resize handler ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
