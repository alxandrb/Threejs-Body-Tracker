/**
 * avatar.js
 * Handles loading a custom rigged 3D model (GLTF/GLB) and mapping
 * MediaPipe landmarks to its skeletal bones via quaternion rotations.
 */

import { scene } from './renderer.js';

export let isAvatarVisible = false;
export let avatarModel = null;
const boneMap = {}; // Maps MediaPipe index (e.g., 13) to THREE.Bone instances
const initialBinds = {}; // Stores initial quaternions to compute relative transforms
const bindDirs = {};     // Stores rest direction of each bone in parent-local space
const debugSpheres = {}; // Visual debugging spheres for each mapped bone
const debugLabels = {};  // HTML div labels for each mapped bone

// Exact mapping provided by the user (Blender Metarig -> MediaPipe Index)
export const METARIG_MAPPING = {
    "0": "spine.006",
    "7": "ear.L",
    "8": "ear.R",
    "11": "shoulder.L",
    "12": "shoulder.R",
    "13": "upper_arm.L",
    "14": "upper_arm.R",
    "15": "forearm.L",
    "16": "forearm.R",
    "19": "hand.L",
    "20": "hand.R",
    "23": "pelvis.L",
    "24": "pelvis.R",
    "25": "thigh.L",
    "26": "thigh.R",
    "27": "shin.L",
    "28": "shin.R",
    "29": "foot.L",
    "30": "foot.R",
    "31": "toe.L",
    "32": "toe.R"
};

/**
 * Identify bones in the loaded GLTF hierarchy
 */
function mapBones(gltfScene) {
    // Clear previous allocations
    for (let key in boneMap) delete boneMap[key];
    for (let key in initialBinds) delete initialBinds[key];
    for (let key in bindDirs) delete bindDirs[key];

    gltfScene.traverse((child) => {
        if (child.isBone) {
            const bname = child.name; // Keep exact casing first, fallback to stripped
            const strippedName = bname.replace(/\./g, ''); // E.g., upper_arm.L -> upper_armL

            for (const [mpIndex, targetName] of Object.entries(METARIG_MAPPING)) {
                if (!boneMap[mpIndex]) {
                    // Match EXACT user-provided string or the stripped variant
                    if (bname === targetName || strippedName === targetName.replace(/\./g, '')) {
                        boneMap[mpIndex] = child;
                        initialBinds[mpIndex] = child.quaternion.clone();
                        // Compute this bone's rest direction in parent-local space
                        // Bones grow along local Y axis in Blender; the bind quaternion
                        // rotates that Y axis to match the A-pose orientation
                        bindDirs[mpIndex] = new THREE.Vector3(0, 1, 0).applyQuaternion(child.quaternion);
                        console.log(`Mapped MP Index [${mpIndex}] -> ${child.name}`);

                        // Visual Debugger: Create a red sphere at the bone
                        const sphereGeom = new THREE.SphereGeometry(0.05, 16, 16);
                        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
                        const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
                        sphereMesh.renderOrder = 999; // Draw on top
                        scene.add(sphereMesh);
                        debugSpheres[mpIndex] = sphereMesh;

                        // HTML Label
                        const lbl = document.createElement('div');
                        lbl.textContent = `[${mpIndex}] ${child.name}`;
                        lbl.style.position = 'absolute';
                        lbl.style.color = '#ff0000';
                        lbl.style.fontFamily = 'monospace';
                        lbl.style.fontSize = '17.5px';
                        lbl.style.fontWeight = 'bold';
                        lbl.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
                        lbl.style.pointerEvents = 'none';
                        lbl.style.zIndex = '9999';
                        lbl.style.display = 'none';
                        lbl.style.left = '0';
                        lbl.style.top = '0';

                        document.body.appendChild(lbl);
                        debugLabels[mpIndex] = lbl;

                        break;
                    }
                }
            }
        }

        // Auto-fix materials if needed (basic PBR adjustment)
        if (child.isMesh) {
            child.frustumCulled = false; // Prevent disappearing bounding boxes
            if (child.material) {
                child.material.envMapIntensity = 0.5;
            }
        }
    });

    console.log("Avatar bones mapped:", Object.keys(boneMap).length);
}

/**
 * Setup File Drag & Drop listeners
 */
export function initAvatarLoader() {
    const overlay = document.getElementById('dd-overlay');

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        overlay.classList.remove('hidden');
        overlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (e.relatedTarget === null) {
            overlay.classList.add('hidden');
            overlay.classList.remove('active');
        }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        overlay.classList.add('hidden');
        overlay.classList.remove('active');

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
            loadAvatarFile(file);
        } else {
            console.warn("Please drop a valid .glb or .gltf file");
        }
    });

    // UI Button upload
    const uploadInput = document.getElementById('av-upload');
    const uploadBtn = document.getElementById('av-btn');

    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadAvatarFile(file);
            // Reset to allow uploading same file again if needed
            e.target.value = '';
        });
    }

    // Auto-load default avatar 
    loadAvatarUrl('assets/StandardMan.glb');
}

export function loadAvatarUrl(url) {
    const loader = new THREE.GLTFLoader();
    loader.load(url, (gltf) => {
        if (avatarModel) scene.remove(avatarModel);
        avatarModel = gltf.scene;
        avatarModel.rotation.y = Math.PI;
        avatarModel.scale.setScalar(1.0);
        avatarModel.position.set(0, 0, 0); // Center of the world
        scene.add(avatarModel);
        mapBones(avatarModel);
        setAvatarVisibility(isAvatarVisible);

        const btn = document.getElementById('av-btn');
        if (btn) btn.textContent = `✓ LOADED: Default Avatar`;
    }, undefined, (error) => {
        console.error('An error happened loading default avatar', error);
    });
}

function loadAvatarFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const contents = e.target.result;
        const loader = new THREE.GLTFLoader();

        loader.parse(contents, '', (gltf) => {
            // Remove old avatar if one exists
            if (avatarModel) {
                scene.remove(avatarModel);
            }

            avatarModel = gltf.scene;

            avatarModel.rotation.y = Math.PI;

            // Scale 1.0 = real-world meters (matches poseWorldLandmarks)
            avatarModel.scale.setScalar(1.0);
            avatarModel.position.set(0, 0, 0); // Center of the world

            scene.add(avatarModel);
            mapBones(avatarModel);
            setAvatarVisibility(isAvatarVisible);

            const btn = document.getElementById('av-btn');
            if (btn) btn.textContent = `✓ LOADED: ${file.name}`;
        });
    };
    reader.readAsArrayBuffer(file);
}

export function setAvatarVisibility(visible) {
    isAvatarVisible = visible;
    if (avatarModel) {
        avatarModel.visible = visible;
    }

    // Also toggle the debug spheres and labels visibility immediately
    updateDebugVisuals();
}

// Global math instances for performance
const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();
const _parentWorldQuat = new THREE.Quaternion();
const _invParentWorldQuat = new THREE.Quaternion();

// Helper to extract a Vector3 from the object array
function getVec3(out, buf, index) {
    if (!buf[index]) return out;
    out.set(buf[index].x, buf[index].y, buf[index].z);
    return out;
}

/**
 * Compute the direction from landmark p1Idx to p2Idx, then
 * derive a rotation DELTA relative to the bone's A-pose rest direction.
 * The final rotation = deltaRotation * bindQuaternion
 * This ensures A-pose = no delta, movements are relative.
 */
function applyBoneRotation(boneIndex, p1Idx, p2Idx, buf) {
    const bone = boneMap[boneIndex];
    if (!bone) return;

    const bindQuat = initialBinds[boneIndex];
    const bindDir = bindDirs[boneIndex];
    if (!bindQuat || !bindDir) return;

    getVec3(v0, buf, p1Idx); // Parent landmark
    getVec3(v1, buf, p2Idx); // Child landmark

    // Direction from parent to child in world space
    v1.sub(v0);
    if (v1.lengthSq() < 0.0001) return;
    v1.normalize();

    // Convert world-space direction to bone-parent-local space
    if (bone.parent) {
        bone.parent.getWorldQuaternion(_parentWorldQuat);
        _invParentWorldQuat.copy(_parentWorldQuat).invert();
        v1.applyQuaternion(_invParentWorldQuat);
    }

    // Compute delta rotation: from bind direction to target direction
    // bindDir is the direction the bone points in rest/A-pose (parent-local space)
    q0.setFromUnitVectors(bindDir, v1);

    // Final rotation = delta * bindQuat
    // This applies the bind pose first, then the delta on top
    q1.multiplyQuaternions(q0, bindQuat);

    // Smooth blend toward the target
    bone.quaternion.slerp(q1, 0.5);
}

import { camera } from './renderer.js';
const _worldPos = new THREE.Vector3();

let _avatarDebugTick = 0;

// Updates 2D HTML labels to stick to the 3D bones
function updateDebugVisuals() {
    // Throttle label updates to ~20FPS instead of 60FPS to avoid Layout Thrashing
    // But always run immediately if we need to hide the avatar
    if (isAvatarVisible && ++_avatarDebugTick < 3) return;
    _avatarDebugTick = 0;

    for (const [mpIndex, bone] of Object.entries(boneMap)) {
        if (!isAvatarVisible) {
            if (debugSpheres[mpIndex]) debugSpheres[mpIndex].visible = false;
            if (debugLabels[mpIndex] && debugLabels[mpIndex].style.display !== 'none') {
                debugLabels[mpIndex].style.display = 'none';
            }
            continue;
        }

        bone.getWorldPosition(_worldPos);

        // Update red 3D sphere
        if (debugSpheres[mpIndex]) {
            debugSpheres[mpIndex].visible = true;
            debugSpheres[mpIndex].position.copy(_worldPos);
        }

        // Project 3D vector to 2D screen coordinates for the HTML label
        _worldPos.project(camera);

        const x = (_worldPos.x * .5 + .5) * window.innerWidth;
        const y = (_worldPos.y * -.5 + .5) * window.innerHeight;

        if (debugLabels[mpIndex]) {
            // Hide if behind camera
            if (_worldPos.z > 1) {
                if (debugLabels[mpIndex].style.display !== 'none') {
                    debugLabels[mpIndex].style.display = 'none';
                }
            } else {
                if (debugLabels[mpIndex].style.display !== 'block') {
                    debugLabels[mpIndex].style.display = 'block';
                }
                debugLabels[mpIndex].style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
        }
    }
}

export function applyAvatarPose(smoothBuf) {
    if (!avatarModel || !isAvatarVisible) return;

    // ── Arms ─────────────────────────────────────────────────────
    applyBoneRotation('13', 11, 13, smoothBuf); // upper_arm.L
    applyBoneRotation('15', 13, 15, smoothBuf); // forearm.L
    applyBoneRotation('14', 12, 14, smoothBuf); // upper_arm.R
    applyBoneRotation('16', 14, 16, smoothBuf); // forearm.R

    // ── Legs ─────────────────────────────────────────────────────
    applyBoneRotation('25', 23, 25, smoothBuf); // thigh.L
    applyBoneRotation('27', 25, 27, smoothBuf); // shin.L
    applyBoneRotation('29', 27, 31, smoothBuf); // foot.L: ankle(27) → foot_index(31) = forward
    applyBoneRotation('26', 24, 26, smoothBuf); // thigh.R
    applyBoneRotation('28', 26, 28, smoothBuf); // shin.R
    applyBoneRotation('30', 28, 32, smoothBuf); // foot.R: ankle(28) → foot_index(32) = forward

    // ── Spine & Head ─────────────────────────────────────────────
    // Torso rotation from hip-center to shoulder-center
    const spine = boneMap['0'];
    const spineBindQuat = initialBinds['0'];
    const spineBindDir = bindDirs['0'];
    if (spine && spineBindQuat && spineBindDir) {
        getVec3(v0, smoothBuf, 11);
        getVec3(v1, smoothBuf, 12);
        v0.add(v1).multiplyScalar(0.5); // Mid-shoulder

        getVec3(v1, smoothBuf, 23);
        getVec3(v2, smoothBuf, 24);
        v1.add(v2).multiplyScalar(0.5); // Mid-hip

        v0.sub(v1); // Hip to Shoulder direction
        if (v0.lengthSq() > 0.0001) {
            v0.normalize();
            if (spine.parent) {
                spine.parent.getWorldQuaternion(_parentWorldQuat);
                _invParentWorldQuat.copy(_parentWorldQuat).invert();
                v0.applyQuaternion(_invParentWorldQuat);
            }
            q0.setFromUnitVectors(spineBindDir, v0);
            q1.multiplyQuaternions(q0, spineBindQuat);
            spine.quaternion.slerp(q1, 0.3);
        }
    }

    updateDebugVisuals();
}

