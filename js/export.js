/**
 * export.js
 * Generates the Blender Python import script and packages
 * everything into a downloadable ZIP file.
 */

import { LANDMARK_NAMES, TIPS } from './config.js';
import { recFrames } from './recording.js';

const $ = id => document.getElementById(id);

// ─── Blender script generator ────────────────────────────────────────
/**
 * Path resolution order (in the generated .py):
 *  1. JSON_PATH manually set at top of script  ← most reliable
 *  2. Same folder as the .py file              ← File > Open workflow
 *  3. Same folder as the open .blend file
 *  4. User Desktop
 *  5. User Downloads folder
 *
 * @param {string} jsonFilename
 * @returns {string} Python source
 */
function buildBlenderScript(jsonFilename) {
  const namesLiteral = JSON.stringify(LANDMARK_NAMES);
  const tipsLiteral = [...TIPS].join(', ');

  const lines = [
    '# =================================================================',
    '# BODY.TRACK 3D — Blender Import Script',
    '# Blender 3.0+  |  Scripting workspace → Open → Run Script ▶',
    '# =================================================================',
    'import bpy',
    'import json',
    'import os',
    'from mathutils import Vector',
    '',
    '',
    '# ── 1. MANUAL OVERRIDE ───────────────────────────────────────────',
    '# Paste your path using FORWARD SLASHES (avoids Python unicode errors).',
    '# Forward slashes work on Windows too!',
    '# Example: JSON_PATH = "C:/Users/Alex/Downloads/' + jsonFilename + '"',
    'JSON_PATH = ""',
    '',
    '',
    '# ── 2. AUTO-DETECT (skipped when JSON_PATH is set above) ─────────',
    'if not JSON_PATH:',
    '    _candidates = []',
    '',
    '    # A) Same folder as this .py (works when opened via File > Open)',
    '    try:',
    '        _here = os.path.dirname(os.path.abspath(__file__))',
    '        _candidates.append(os.path.join(_here, "' + jsonFilename + '"))',
    '    except (NameError, ValueError):',
    '        # __file__ is not set when the script is pasted into the',
    '        # text editor without being saved first — this is expected.',
    '        pass',
    '',
    '    # B) Same folder as the open .blend file',
    '    if bpy.data.filepath:',
    '        _blend_dir = os.path.dirname(os.path.abspath(bpy.data.filepath))',
    '        _candidates.append(os.path.join(_blend_dir, "' + jsonFilename + '"))',
    '',
    '    # C) Desktop',
    '    _candidates.append(',
    '        os.path.join(os.path.expanduser("~"), "Desktop", "' + jsonFilename + '")',
    '    )',
    '',
    '    # D) Downloads',
    '    _candidates.append(',
    '        os.path.join(os.path.expanduser("~"), "Downloads", "' + jsonFilename + '")',
    '    )',
    '',
    '    for _c in _candidates:',
    '        if os.path.exists(_c):',
    '            JSON_PATH = _c',
    '            print(f"  Auto-detected JSON at: {_c}")',
    '            break',
    '',
    '',
    '# ── 3. GUARD ─────────────────────────────────────────────────────',
    'if not JSON_PATH or not os.path.exists(JSON_PATH):',
    '    raise FileNotFoundError(',
    '        "\\n\\n"',
    '        "Could not find: ' + jsonFilename + '\\n"',
    '        "Searched: Desktop, Downloads, .blend folder.\\n\\n"',
    '        "FIX: Open this script in Blender\'s text editor,\\n"',
    '        "find the line   JSON_PATH = \\"\\"   near the top,\\n"',
    '        "and paste the full path to your JSON file:\\n"',
    '        r\'  JSON_PATH = r"C:\\Users\\Alex\\Downloads\\' + jsonFilename + '"\' ',
    '    )',
    '',
    '',
    '# ─────────────────────────────────────────────────────────────────',
    '# ── Configuration ────────────────────────────────────────────────',
    'SCALE      = 1.0   # Manual uniform scale (used when AUTO_FIT = False)',
    'AUTO_FIT   = True  # Auto-scale data to match your rig (recommended)',
    'RIG_NAME   = ""    # Armature object name in Blender (e.g. "BodyRig")',
    'ROOT_BONE  = ""    # Root or Hip bone name (e.g. "hips")',
    'TIP_BONE   = ""    # Head or Nose bone (e.g. "head")',
    '# Leave RIG_NAME empty to use manual SCALE + auto-center on wrist.',
    '',
    `NAMES = ${namesLiteral}`,
    `TIPS  = {${tipsLiteral}}`,
    '',
    '# Landmark indices used for scale reference',
    'IDX_ROOT = 23   # Left Hip',
    'IDX_TIP  = 0    # Nose',
    '',
    '',
    '# ── Coordinate conversion ────────────────────────────────────────',
    'def to_blender(x, y, z, scale=1.0, offset=(0, 0, 0)):',
    '    return Vector((',
    '        x * scale + offset[0],',
    '       -z * scale + offset[1],',
    '        y * scale + offset[2],',
    '    ))',
    '',
    '',
    '# ── Auto-fit: compute scale + offset from rig bones ─────────────',
    'def compute_fit(frames):',
    '    # -- Option A: fit to rig bones --',
    '    if AUTO_FIT and RIG_NAME and ROOT_BONE and TIP_BONE:',
    '        arm_obj = bpy.data.objects.get(RIG_NAME)',
    '        if arm_obj and arm_obj.type == "ARMATURE":',
    '            arm   = arm_obj.data',
    '            bw    = arm.bones.get(ROOT_BONE)',
    '            bt    = arm.bones.get(TIP_BONE)',
    '            if bw and bt:',
    '                mw = arm_obj.matrix_world',
    '                rig_size = (mw @ bt.head_local - mw @ bw.head_local).length',
    '                lm0 = frames[0]["lm"]',
    '                p0 = Vector((lm0[IDX_ROOT*3], lm0[IDX_ROOT*3+1], lm0[IDX_ROOT*3+2]))',
    '                p1 = Vector((lm0[IDX_TIP*3],   lm0[IDX_TIP*3+1],   lm0[IDX_TIP*3+2]))',
    '                data_size = (p1 - p0).length',
    '                if data_size > 0.0001:',
    '                    sc = rig_size / data_size',
    '                    wbl = to_blender(p0.x, p0.y, p0.z, sc)',
    '                    rig_wrist = mw @ bw.head_local',
    '                    off = tuple(rig_wrist[i] - wbl[i] for i in range(3))',
    '                    print(f"  Auto-fit: data={data_size:.4f} rig={rig_size:.4f} scale={sc:.4f}")',
    '                    print(f"  Offset: {tuple(round(v,4) for v in off)}")',
    '                    return sc, off',
    '                print("  WARNING: data_size too small, using manual SCALE")',
    '            else:',
    '                print(f"  WARNING: bones not found in {RIG_NAME}")',
    '        else:',
    '            print(f"  WARNING: armature {RIG_NAME!r} not found")',
    '',
    '    # -- Option B: auto-center root at origin, use manual SCALE --',
    '    lm0   = frames[0]["lm"]',
    '    wx,wy,wz = lm0[IDX_ROOT*3], lm0[IDX_ROOT*3+1], lm0[IDX_ROOT*3+2]',
    '    wbl = to_blender(wx, wy, wz, SCALE)',
    '    off = (-wbl.x, -wbl.y, -wbl.z)',
    '    # Print bounding box so user knows what SCALE to use',
    '    xs = [lm0[i*3]   for i in range(21)]',
    '    ys = [lm0[i*3+1] for i in range(21)]',
    '    zs = [lm0[i*3+2] for i in range(21)]',
    '    bx = (max(xs)-min(xs))*SCALE',
    '    by = (max(ys)-min(ys))*SCALE',
    '    bz = (max(zs)-min(zs))*SCALE',
    '    print(f"  Bounding box at SCALE={SCALE}: X={bx:.3f}  Y={by:.3f}  Z={bz:.3f} Blender units")',
    '    print("  Tip: adjust SCALE so the bounding box matches your rig body size")',
    '    return SCALE, off',
    '',
    '',
    '# ── Load JSON ────────────────────────────────────────────────────',
    'with open(JSON_PATH, encoding="utf-8") as f:',
    '    data = json.load(f)',
    '',
    'fps    = data.get("fps", 30)',
    'frames = data["frames"]',
    'N      = len(frames)',
    'print(f"\\n▶ Importing: {N} frames @ {fps} fps  ({data.get(\'duration\', \'?\')}s)")',
    '',
    '',
    '',
    '# ── Compute scale + offset to fit rig ─────────────────────────',
    '_scale, _offset = compute_fit(frames)',
    '',
    '# ── Scene setup ──────────────────────────────────────────────────',
    'scene              = bpy.context.scene',
    'scene.render.fps   = fps',
    'scene.frame_start  = 1',
    'scene.frame_end    = N',
    '',
    '',
    '# ── Clean previous import ────────────────────────────────────────',
    'if "BodyTracking" in bpy.data.collections:',
    '    col = bpy.data.collections["BodyTracking"]',
    '    for obj in list(col.objects):',
    '        bpy.data.objects.remove(obj, do_unlink=True)',
    '    bpy.data.collections.remove(col)',
    '',
    'col = bpy.data.collections.new("BodyTracking")',
    'scene.collection.children.link(col)',
    '',
    '',
    '# ── Create one Empty per landmark ────────────────────────────────',
    'empties = []',
    'for i, name in enumerate(NAMES):',
    '    bpy.ops.object.empty_add(type="SPHERE", location=(0, 0, 0))',
    '    obj                    = bpy.context.active_object',
    '    obj.name               = f"Body_{name}"',
    '    obj.empty_display_size = 0.014 if i in TIPS else 0.009',
    '    obj.color              = (1, 0, 0.67, 1) if i in TIPS else (0, 1, 0.91, 1)',
    '    for c in list(obj.users_collection):',
    '        c.objects.unlink(obj)',
    '    col.objects.link(obj)',
    '    empties.append(obj)',
    '',
    '',
    '# ── Insert keyframes ─────────────────────────────────────────────',
    'print("▶ Inserting keyframes...")',
    'for fi, frame_data in enumerate(frames):',
    '    lm = frame_data["lm"]',
    '    for i, obj in enumerate(empties):',
    '        obj.location = to_blender(lm[i*3], lm[i*3+1], lm[i*3+2], _scale, _offset)',
    '        obj.keyframe_insert(data_path="location", frame=fi + 1)',
    '    if fi % 100 == 0:',
    '        print(f"  {fi + 1} / {N}")',
    '',
    '',
    '# ── Linear interpolation (no Bezier overshoot) ───────────────────',
    '# Compatible with Blender 3.x, 4.x and 4.4+ (new Action API)',
    'def set_linear(action):',
    '    try:',
    '        # Blender 3.x / 4.0–4.3 — classic API',
    '        for fc in action.fcurves:',
    '            for kp in fc.keyframe_points:',
    '                kp.interpolation = "LINEAR"',
    '    except AttributeError:',
    '        # Blender 4.4+ — layered Action API',
    '        try:',
    '            for layer in action.layers:',
    '                for strip in layer.strips:',
    '                    for channelbag in strip.channelbags:',
    '                        for fc in channelbag.fcurves:',
    '                            for kp in fc.keyframe_points:',
    '                                kp.interpolation = "LINEAR"',
    '        except Exception:',
    '            pass  # Non-critical — animation works with Bezier too',
    '',
    'for obj in empties:',
    '    if obj.animation_data and obj.animation_data.action:',
    '        set_linear(obj.animation_data.action)',
    '',
    '',
    'print(f"\\n✓ Done!  BodyTracking → {len(empties)} empties x {N} keyframes @ {fps} fps")',
    'print("  Tip: use Copy Location constraints on a Rigify armature")',
  ];

  return lines.join('\n');
}

// ─── Modal helpers ───────────────────────────────────────────────────
function openModal() {
  if (!recFrames.length) return;

  const el = recFrames[recFrames.length - 1].t;
  const fps = recFrames.length / Math.max(el, 0.001);

  $('ex-d').textContent = el.toFixed(2) + 's';
  $('ex-f').textContent = recFrames.length;
  $('ex-fps').textContent = fps.toFixed(1);

  $('emodal').classList.add('visible');
}

function closeModal() {
  $('emodal').classList.remove('visible');
}

// ─── ZIP download ────────────────────────────────────────────────────
async function downloadZip() {
  if (!recFrames.length) return;

  const el = recFrames[recFrames.length - 1].t;
  const fps = Math.round(recFrames.length / Math.max(el, 0.001)) || 30;
  const filename = 'hand_animation.json';

  const jsonPayload = {
    version: '2.0',
    generator: 'Body.Track 3D',
    fps,
    frameCount: recFrames.length,
    duration: +el.toFixed(3),
    landmarks: 33,
    format: 'lm: flat array [x0,y0,z0,...] Three.js Y-up world space',
    frames: recFrames,
  };

  const readme = [
    'BODY.TRACK 3D — EXPORT',
    '======================',
    '',
    `Frames   : ${recFrames.length}`,
    `Duration : ${el.toFixed(2)}s`,
    `FPS      : ${fps}`,
    `Recorded : ${new Date().toLocaleString()}`,
    '',
    'HOW TO IMPORT IN BLENDER',
    '  1. Blender → Scripting workspace',
    '  2. Click "Open" → select import_body_blender.py',
    '  3. Click Run Script ▶',
    '',
    'If you get a FileNotFoundError:',
    `  Open import_body_blender.py, find  JSON_PATH = ""  near the top`,
    `  and paste your full path to ${filename}, e.g.:`,
    `  JSON_PATH = r"C:\\Users\\Alex\\Downloads\\${filename}"`,
  ].join('\n');

  const zip = new window.JSZip();
  zip.file(filename, JSON.stringify(jsonPayload));
  zip.file('import_body_blender.py', buildBlenderScript(filename));
  zip.file('README.txt', readme);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `body_track_${Date.now()}.zip`,
  });
  a.click();
  URL.revokeObjectURL(url);

  closeModal();
}

// ─── Public API ─────────────────────────────────────────────────────
export function initExport() {
  $('expbtn').addEventListener('click', openModal);
  $('dlbtn').addEventListener('click', downloadZip);
  $('closebtn').addEventListener('click', closeModal);
}
