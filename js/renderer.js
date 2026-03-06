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
import { applySmoothing, smoothPos } from './smoothing.js';
import {
  jointMesh, boneMesh, glowMesh,
  jointMat, boneMat,
  updateJointInstances,
  updateBoneInstances,
  updateJointLabels
} from './body.js';
import { captureFrame } from './recording.js';
import { applyAvatarPose, isAvatarVisible } from './avatar.js';

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
const camBasePos = new THREE.Vector3(0, 1.2, 3.5);
camera.position.copy(camBasePos);

// ─── Keyboard Camera Controls (WASD + FPS Mouse) ───────────────────────────────
const keys = { w: false, a: false, s: false, d: false, q: false, e: false };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = true;
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = false;
});

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let camRotX = 0; // Pitch
let camRotY = 0; // Yaw

window.addEventListener('mousedown', (e) => {
  isDragging = true;
  previousMousePosition = { x: e.offsetX, y: e.offsetY };
});
window.addEventListener('mouseup', () => isDragging = false);
window.addEventListener('mouseleave', () => isDragging = false);
window.addEventListener('mousemove', (e) => {
  if (isDragging && state.detected) {
    const deltaMove = {
      x: e.offsetX - previousMousePosition.x,
      y: e.offsetY - previousMousePosition.y
    };

    camRotY -= deltaMove.x * 0.005; // Left/Right (Yaw)
    camRotX -= deltaMove.y * 0.005; // Up/Down (Pitch)

    // Clamp pitch to prevent flipping upside down
    camRotX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, camRotX));

    camera.quaternion.setFromEuler(new THREE.Euler(camRotX, camRotY, 0, 'YXZ'));

    previousMousePosition = { x: e.offsetX, y: e.offsetY };
  }
});

// ─── Lights ────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x112233, 1.0));

const rimLight = new THREE.DirectionalLight(0x00ff41, 0.9);
rimLight.position.set(-2, 2, 1);
scene.add(rimLight);

export const pinkLight = new THREE.PointLight(0x008f11, 1.0, 3);
pinkLight.position.set(1, -1, 0.5);
scene.add(pinkLight);

export const fillLight = new THREE.PointLight(0x00ff41, 0.5, 3);
fillLight.position.set(-0.5, 0.5, 1);
scene.add(fillLight);

// ─── Add body meshes to scene ───────────────────────────────────────
scene.add(jointMesh, boneMesh, glowMesh);

// ─── Grid ──────────────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(10, 20, 0x00ff41, 0x005511);
gridHelper.position.set(0, 0, 0); // Center of the world
scene.add(gridHelper);

// ─── Camera movement ─────────────────────────────────────────────────
let _t = 0;

function updateCamera() {
  const speed = 0.05;

  if (state.detected) {
    if (keys.w) camera.translateZ(-speed); // Forward (FPS)
    if (keys.s) camera.translateZ(speed);  // Backward
    if (keys.a) camera.translateX(-speed); // Strafe Left
    if (keys.d) camera.translateX(speed);  // Strafe Right
    if (keys.q) camera.position.y -= speed; // Down
    if (keys.e) camera.position.y += speed; // Up

    // Save new position so drift knows where to return
    camBasePos.copy(camera.position);
  } else {
    camera.position.x = camBasePos.x + Math.sin(_t * 0.3) * 0.05;
    camera.position.y = camBasePos.y + Math.cos(_t * 0.2) * 0.03;
    camera.position.z = camBasePos.z;
    camera.lookAt(0, 0, 0); // Keep looking at center while drifting
  }
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

    // The raw default glowing body
    jointMesh.visible = opts.joints && !isAvatarVisible;
    boneMesh.visible = opts.bones && !isAvatarVisible;
    glowMesh.visible = opts.particles && !isAvatarVisible;

    applyAvatarPose(smoothPos);

    // Show wireframe joint labels if wireframe is active
    updateJointLabels(camera, opts.wire);
  } else {
    jointMesh.visible = false;
    boneMesh.visible = false;
    glowMesh.visible = false;

    updateJointLabels(camera, false);
  }

  updateCamera();

  if (opts.pulse) applyPulse();

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
