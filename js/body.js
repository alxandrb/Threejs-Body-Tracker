/**
 * body.js
 * Three.js body geometry: two InstancedMeshes (joints + bones)
 * and a Points glow layer.
 *
 * Performance contract:
 *  - Only 2 draw calls for the entire body skeleton.
 *  - All scratch objects are pre-allocated at module load.
 *  - updateJointInstances() and updateBoneInstances() perform
 *    zero heap allocations per call.
 */

/* global THREE */
import { NJ, NC, CONNECTIONS, TIPS, LANDMARK_NAMES } from './config.js';
import { smoothPos } from './smoothing.js';

// ─── Colours ───────────────────────────────────────────────────────
const CYAN = new THREE.Color(0x00ff41);
const MAGENTA = new THREE.Color(0x008f11);

// ─── Materials (exported so settings.js can mutate them) ───────────
export const jointMat = new THREE.MeshStandardMaterial({
  metalness: 0.6,
  roughness: 0.2,
  emissive: CYAN,
  emissiveIntensity: 0.35,
});

export const boneMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0xff3747),
  emissive: new THREE.Color(0x00ff41),
  emissiveIntensity: 0.12,
  metalness: 0.8,
  roughness: 0.3,
  transparent: true,
  opacity: 0.8,
});

// ─── Joint InstancedMesh ────────────────────────────────────────────
export const jointMesh = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.011, 8, 6),
  jointMat,
  NJ,
);
jointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

// Per-instance colour: tips = magenta, others = cyan
for (let i = 0; i < NJ; i++) {
  jointMesh.setColorAt(i, TIPS.has(i) ? MAGENTA : CYAN);
}
jointMesh.instanceColor.needsUpdate = true;
jointMesh.visible = false;

// ─── Bone InstancedMesh ─────────────────────────────────────────────
export const boneMesh = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.005, 0.005, 1, 6),
  boneMat,
  NC,
);
boneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
boneMesh.visible = false;

// ─── Glow particles ─────────────────────────────────────────────────
export const glowBuf = new Float32Array(NJ * 3);
const _glowGeo = new THREE.BufferGeometry();
_glowGeo.setAttribute('position', new THREE.BufferAttribute(glowBuf, 3));

export const glowMesh = new THREE.Points(
  _glowGeo,
  new THREE.PointsMaterial({
    color: 0x00ff41,
    size: 0.022,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
glowMesh.visible = false;

// ─── Pre-allocated scratch objects (NO new() in hot path) ──────────
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0); // constant up axis for bones
const _vMid = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _iq = new THREE.Quaternion();      // identity quaternion for joints
const _s = new THREE.Vector3();
const _os = new THREE.Vector3(1, 1, 1); // uniform scale for joints
const _m = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0); // hides a bone instance

// ─── Hot path: update joint instance matrices ───────────────────────
/**
 * Writes a compose(position, identity, scale=1) matrix for each joint
 * and copies positions into the glow particle buffer.
 * Zero allocations.
 */
export function updateJointInstances() {
  for (let i = 0; i < NJ; i++) {
    const p = smoothPos[i];
    _v0.set(p.x, p.y, p.z);
    _m.compose(_v0, _iq, _os);
    jointMesh.setMatrixAt(i, _m);

    const b = i * 3;
    glowBuf[b] = p.x;
    glowBuf[b + 1] = p.y;
    glowBuf[b + 2] = p.z;
  }

  jointMesh.instanceMatrix.needsUpdate = true;
  _glowGeo.attributes.position.needsUpdate = true;
}

// ─── Hot path: update bone instance matrices ────────────────────────
/**
 * For each bone: computes midpoint, direction, length, then builds
 * a matrix that places a unit cylinder between the two joint positions.
 * Zero allocations.
 */
export function updateBoneInstances() {
  for (let i = 0; i < NC; i++) {
    const [a, b] = CONNECTIONS[i];
    const pa = smoothPos[a];
    const pb = smoothPos[b];

    _v0.set(pa.x, pa.y, pa.z);
    _v1.set(pb.x, pb.y, pb.z);
    _vMid.addVectors(_v0, _v1).multiplyScalar(0.5);
    _v1.sub(_v0); // direction vector

    const len = _v1.length();
    if (len < 0.001) {
      boneMesh.setMatrixAt(i, _zero);
      continue;
    }

    _q.setFromUnitVectors(_vUp, _v1.divideScalar(len));
    _s.set(1, len, 1);
    _m.compose(_vMid, _q, _s);
    boneMesh.setMatrixAt(i, _m);
  }

  boneMesh.instanceMatrix.needsUpdate = true;
}

// ─── Joint Labels (Wireframe mode) ──────────────────────────────────
const jointLabels = [];
for (let i = 0; i < NJ; i++) {
  const lbl = document.createElement('div');
  lbl.textContent = `[${i}] ${LANDMARK_NAMES[i]}`;
  lbl.style.position = 'absolute';
  lbl.style.color = '#00ff41';
  lbl.style.fontFamily = 'monospace';
  lbl.style.fontSize = '17.5px';
  lbl.style.pointerEvents = 'none';
  lbl.style.display = 'none';
  lbl.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
  lbl.style.left = '0'; // Use translate3d instead of top/left for performance
  lbl.style.top = '0';
  lbl.style.transform = 'translate(-50%, -50%)';

  document.body.appendChild(lbl);
  jointLabels.push(lbl);
}

const _lblPos = new THREE.Vector3();

let _labelTick = 0;

export function updateJointLabels(camera, isVisible) {
  if (!isVisible) {
    for (let i = 0; i < NJ; i++) {
      if (jointLabels[i].style.display !== 'none') {
        jointLabels[i].style.display = 'none';
      }
    }
    return;
  }

  // Throttle DOM updates: ~60fps render loop / 3 = ~20fps updates (matches MediaPipe target)
  if (++_labelTick < 3) return;
  _labelTick = 0;

  for (let i = 0; i < NJ; i++) {
    const p = smoothPos[i];
    if (!p) continue;

    // We must get the world position incorporating the jointMesh's matrixWorld if the scene was transformed
    // but here jointMesh is at 0,0,0 so raw positions are world positions.
    _lblPos.set(p.x, p.y, p.z);

    // Project returns coordinates in range [-1, 1] relative to the camera frustum
    _lblPos.project(camera);

    // If z > 1, the point is behind the camera
    if (_lblPos.z > 1) {
      if (jointLabels[i].style.display !== 'none') {
        jointLabels[i].style.display = 'none';
      }
      continue;
    }

    // Convert normalized device coordinates [-1, +1] to screen CSS coordinates [0, width/height]
    const x = (_lblPos.x + 1) / 2 * window.innerWidth;
    const y = -(_lblPos.y - 1) / 2 * window.innerHeight;

    if (jointLabels[i].style.display !== 'block') {
      jointLabels[i].style.display = 'block';
    }
    jointLabels[i].style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;
  }
}
