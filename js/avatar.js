/**
 * avatar.js
 * Handles loading a custom rigged 3D model (GLTF/GLB) and mapping
 * MediaPipe landmarks to its skeletal bones via quaternion rotations.
 */

import { scene } from './renderer.js';

export let isAvatarVisible = true;
export let avatarModel = null;
const boneMap = {}; // Maps logical names (e.g., 'LeftArm') to THREE.Bone instances
const initialBinds = {}; // Stores initial quaternions to compute relative transforms

// Basic dictionary to find bones by common naming conventions
const BONE_NAMES = {
    Hips: ['hips', 'pelvis', 'root', 'mixamorig:hips'],
    Spine: ['spine', 'chest', 'torso', 'mixamorig:spine'],
    Spine1: ['spine1', 'spine_1', 'chest1', 'mixamorig:spine1'],
    Spine2: ['spine2', 'spine_2', 'chest2', 'mixamorig:spine2'],
    Neck: ['neck', 'mixamorig:neck'],
    Head: ['head', 'mixamorig:head'],

    LeftShoulder: ['leftshoulder', 'shoulder_l', 'l_shoulder', 'mixamorig:leftshoulder'],
    LeftArm: ['leftarm', 'arm_l', 'l_arm', 'bicep_l', 'mixamorig:leftarm'],
    LeftForeArm: ['leftforearm', 'forearm_l', 'l_forearm', 'elbow_l', 'mixamorig:leftforearm'],
    LeftHand: ['lefthand', 'hand_l', 'l_hand', 'wrist_l', 'mixamorig:lefthand'],

    RightShoulder: ['rightshoulder', 'shoulder_r', 'r_shoulder', 'mixamorig:rightshoulder'],
    RightArm: ['rightarm', 'arm_r', 'r_arm', 'bicep_r', 'mixamorig:rightarm'],
    RightForeArm: ['rightforearm', 'forearm_r', 'r_forearm', 'elbow_r', 'mixamorig:rightforearm'],
    RightHand: ['righthand', 'hand_r', 'r_hand', 'wrist_r', 'mixamorig:righthand'],

    LeftUpLeg: ['leftupleg', 'upleg_l', 'l_upleg', 'thigh_l', 'mixamorig:leftupleg'],
    LeftLeg: ['leftleg', 'leg_l', 'l_leg', 'calf_l', 'mixamorig:leftleg'],
    LeftFoot: ['leftfoot', 'foot_l', 'l_foot', 'ankle_l', 'mixamorig:leftfoot'],

    RightUpLeg: ['rightupleg', 'upleg_r', 'r_upleg', 'thigh_r', 'mixamorig:rightupleg'],
    RightLeg: ['rightleg', 'leg_r', 'r_leg', 'calf_r', 'mixamorig:rightleg'],
    RightFoot: ['rightfoot', 'foot_r', 'r_foot', 'ankle_r', 'mixamorig:rightfoot']
};

/**
 * Identify bones in the loaded GLTF hierarchy
 */
function mapBones(gltfScene) {
    // Clear previous allocations
    for (let key in boneMap) delete boneMap[key];
    for (let key in initialBinds) delete initialBinds[key];

    gltfScene.traverse((child) => {
        if (child.isBone) {
            const bname = child.name.toLowerCase();

            // Check which logical bone this matches
            for (const [logicalName, synonyms] of Object.entries(BONE_NAMES)) {
                if (!boneMap[logicalName]) {
                    const match = synonyms.find(s => bname.includes(s));
                    if (match) {
                        boneMap[logicalName] = child;
                        initialBinds[logicalName] = child.quaternion.clone();
                        console.log(`Mapped [${logicalName}] -> ${child.name}`);
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
        avatarModel.scale.setScalar(1.5);
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

            // Face the camera (Three.js standard vs Mixamo standard)
            avatarModel.rotation.y = Math.PI;

            // Default scale/position adjustments
            avatarModel.scale.setScalar(1.5);
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
}

// Global math instances for performance
const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const q0 = new THREE.Quaternion();

/**
 * Apply MediaPipe smooth coordinates to the Bones
 * @param {Float32Array} smoothBuf - 33x3 xyz flat array
 */
// Helper to extract a Vector3 from the object array
function getVec3(out, buf, index) {
    if (!buf[index]) return out;
    out.set(buf[index].x, buf[index].y, buf[index].z);
    return out;
}

// Applies rotation from parent->child vector to target bone
function applyBoneRotation(boneName, p1Idx, p2Idx, buf) {
    const bone = boneMap[boneName];
    if (!bone) return;

    getVec3(v0, buf, p1Idx); // Parent
    getVec3(v1, buf, p2Idx); // Child

    // Vector pointing from Parent to Child
    v1.sub(v0);
    if (v1.lengthSq() < 0.0001) return; // Guard against NaN
    v1.normalize();

    // THREE.js Y-up assumption vs Mixamo bones. 
    // We align the bone's Y-axis (or another axis based on initial rigging) 
    // towards the new target vector.
    // We use lookAt behavior or setFromUnitVectors.

    // In a standard T-pose, the left arm points along +X, right along -X, etc.
    // We simplify by creating a quaternion from an implicit up vector.
    // For production quality, one should use Inverse Kinematics (CCD), but 
    // direct forward kinematics works well enough for simple tracking.

    // Reference vector (assuming bones grow along Y in local space)
    const up = new THREE.Vector3(0, -1, 0); // Assuming MediaPipe Y is down

    q0.setFromUnitVectors(up, v1);
    bone.quaternion.slerp(q0, 0.5); // Smooth apply
}

export function applyAvatarPose(smoothBuf) {
    if (!avatarModel || !isAvatarVisible) return;

    // Map MediaPipe indices to standard humanoid bones:
    // 11: Left Shoulder, 13: Left Elbow, 15: Left Wrist
    applyBoneRotation('LeftArm', 11, 13, smoothBuf);
    applyBoneRotation('LeftForeArm', 13, 15, smoothBuf);

    // 12: Right Shoulder, 14: Right Elbow, 16: Right Wrist 
    applyBoneRotation('RightArm', 12, 14, smoothBuf);
    applyBoneRotation('RightForeArm', 14, 16, smoothBuf);

    // 23: Left Hip, 25: Left Knee, 27: Left Ankle
    applyBoneRotation('LeftUpLeg', 23, 25, smoothBuf);
    applyBoneRotation('LeftLeg', 25, 27, smoothBuf);

    // 24: Right Hip, 26: Right Knee, 28: Right Ankle
    applyBoneRotation('RightUpLeg', 24, 26, smoothBuf);
    applyBoneRotation('RightLeg', 26, 28, smoothBuf);

    // Spine & Head 
    // MediaPipe: 0 is Nose, 11/12 are shoulders
    // Extremely simplified torso rotation:
    getVec3(v0, smoothBuf, 11);
    getVec3(v1, smoothBuf, 12);
    v0.add(v1).multiplyScalar(0.5); // Mid-shoulder

    getVec3(v1, smoothBuf, 23);
    getVec3(q0, smoothBuf, 24); // repurpose q0 vector temporarily
    v1.add(q0).multiplyScalar(0.5); // Mid-hip

    const spine = boneMap['Spine'] || boneMap['Hips'];
    if (spine) {
        v0.sub(v1); // Hip to Shoulder
        if (v0.lengthSq() > 0.0001) {
            v0.normalize();
            const up = new THREE.Vector3(0, 1, 0); // Spine usually grows up
            q0.setFromUnitVectors(up, v0);
            spine.quaternion.slerp(q0, 0.2);
        }
    }
}
