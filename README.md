<div align="center">

```
██████╗  ██████╗ ██████╗ ██╗   ██╗    ████████╗██████╗  █████╗  ██████╗██╗  ██╗███████╗██████╗ 
██╔══██╗██╔═══██╗██╔══██╗╚██╗ ██╔╝    ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
██████╔╝██║   ██║██║  ██║ ╚████╔╝        ██║   ██████╔╝███████║██║     █████╔╝ █████╗  ██████╔╝
██╔══██╗██║   ██║██║  ██║  ╚██╔╝         ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
██████╔╝╚██████╔╝██████╔╝   ██║          ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║
╚═════╝  ╚═════╝ ╚═════╝    ╚═╝          ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
```

### Real-time 3D full body tracking · MediaPipe × Three.js · Blender export

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-ff0018?style=for-the-badge&logoColor=black)](https://YOUR-USERNAME.github.io/body-tracking/)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-181717?style=for-the-badge&logo=github&logoColor=white)](https://pages.github.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-0097A7?style=for-the-badge&logo=google&logoColor=white)](https://mediapipe.dev/)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-ff00aa?style=for-the-badge)](LICENSE)

</div>

---

## ✦ What is this?

A **single HTML file** that turns your webcam into a real-time 3D full body motion capture studio — directly in the browser, zero install required. Track your body's 33 landmarks, visualize them as a glowing 3D rig, record the motion, and export it straight into **Blender** as keyframed animation data.

<div align="center">

|       🎯 Track        |          💀 Rig          |      ⏺ Record       |     🐍 Export     |
| :-------------------: | :----------------------: | :-----------------: | :---------------: |
| 33 landmarks at 30fps | Instanced joints + bones | Up to 30fps capture | ZIP → Blender .py |

</div>

---

## ⚡ Quick Start

**No install. No build step. No dependencies to download.**

```
1. Open index.html in Chrome / Edge / Firefox
2. Allow camera access
3. Point your body at the webcam
4. Done.
```

Or visit the **[live demo →](https://alxandrb.github.io/Threejs-Body-Tracker/)**

> ⚠️ Requires HTTPS or localhost for camera access. GitHub Pages handles this automatically.

---

## 🏗 Architecture

The core insight that makes this run smoothly is **fully decoupled loops**:

```
┌─────────────────────────────────────────┐     ┌────────────────────────────────────┐
│         RENDER LOOP  (rAF ~60fps)       │     │    MEDIAPIPE LOOP (setTimeout)     │
│                                         │     │                                    │
│  reads smoothPos[]                      │     │  captures video frame              │
│  lerp(smoothPos → rawBuf)               │◀────│  runs inference (complexity=1)     │
│  updates InstancedMesh matrices         │     │  writes rawBuf[Float32Array]       │
│  renders scene                          │     │  reschedules after inference done  │
│                                         │     │                                    │
│  NEVER waits for MediaPipe              │     │  rate: 5–30fps (configurable)      │
└─────────────────────────────────────────┘     └────────────────────────────────────┘
         ↑ always runs at full speed                      ↑ never blocks rendering
```

The **smoothing lerp** in the render loop bridges the gap — even at low fps MediaPipe input, motion appears fluid.

---

## 🔧 Performance Optimizations

| Optimization            | Before                               | After                                    |
| ----------------------- | ------------------------------------ | ---------------------------------------- |
| Draw calls              | **68** (33 spheres + 35 cylinders)   | **2** (InstancedMesh)                    |
| Allocations in hot path | `new Vector3()` every frame          | **zero** (pre-allocated scratch objects) |
| MediaPipe resolution    | 640×480                              | **320×240** (4× fewer pixels)            |
| MediaPipe model         | full                            | **complexity=1**       |
| Renderer                | ACESFilmic, antialias on, PR=device  | **NoToneMapping, antialias off, PR≤1.5** |
| CSS                     | `backdrop-filter: blur()` everywhere | **removed** (GPU expensive)              |
| DOM updates             | Every frame                          | **Throttled every 8 frames**             |
| Tone mapping            | ACESFilmic                           | **None** (saves shader overhead)         |

---

## 🎛 Settings Panel

Click **⚙ SETTINGS** to access:

**Motion**

- `Smoothing` — lerp alpha from `HIGH` (very smooth, slight lag) to `RAW` (instant, jittery)
- `Scale` — body size in 3D space

**Visibility**

- Toggle joints, bones, extremity highlights, particles, camera feed independently

**Effects**

- Pulse animation, wireframe bones

**Performance**

- `MediaPipe Rate` — 5 to 30fps inference rate. Lower = faster render, higher = more responsive tracking

---

## ⏺ Recording & Export

```
1. Choose duration (5s / 10s / 15s / 30s / ∞)
2. Click  ⏺ START RECORDING
3. Move your body — captured at 30fps
4. Click  ⬇ EXPORT FOR BLENDER
5. Download the ZIP
```

The ZIP contains:

```
body_track_TIMESTAMP.zip
├── body_animation.json        ← 33 landmarks × N frames × [x,y,z]
├── import_body_blender.py     ← Run this in Blender
└── README.txt
```

---

## 🐍 Blender Import

**Requirements:** Blender 3.0+

```
1. Extract the ZIP (keep both files in the same folder)
2. Open Blender
3. Go to the Scripting workspace
4. Click Open → select import_body_blender.py
5. Click ▶ Run Script
```

This creates a **`BodyTracking` collection** with 33 keyframed Empty objects — one per landmark, named anatomically:

```
BodyTracking/
├── Body_Nose
├── Body_Left_Shoulder
├── Body_Right_Shoulder
├── ...
```

All keyframes use **LINEAR interpolation** — no Bezier overshoot on fast movements.

**Tip:** Drive a Rigify armature using **Copy Location** constraints targeting these empties, or use them directly as IK targets.

---

## 📐 Data Format

```json
{
  "version": "2.0",
  "fps": 30,
  "frameCount": 150,
  "duration": 5.0,
  "landmarks": 33,
  "format": "lm: flat array [x0,y0,z0,...] Three.js Y-up",
  "frames": [
    { "t": 0.0000, "lm": [0.012, -0.103, 0.001,  0.024, ...] },
    { "t": 0.0333, "lm": [...] }
  ]
}
```

**Coordinate system:**

```
Three.js (Y-up)     →    Blender (Z-up)
  X  (right)               X  (right)
  Y  (up)                  Z  (up)
  Z  (forward)            -Y  (forward)
```

The import script handles this conversion automatically.

---

## 🛠 Tech Stack

|                   |                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **3D Rendering**  | [Three.js r128](https://threejs.org/) — WebGL via `InstancedMesh`                                                             |
| **Body Tracking** | [MediaPipe Pose 0.5](https://google.github.io/mediapipe/solutions/pose) — 33 landmark model                                 |
| **Export**        | [JSZip 3.10](https://stuk.github.io/jszip/) — client-side ZIP generation                                                      |
| **Fonts**         | [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) + [Rajdhani](https://fonts.google.com/specimen/Rajdhani) |
| **Deploy**        | GitHub Pages — zero config, free HTTPS                                                                                        |

**Zero build tools. Zero npm. Zero bundlers.** Pure HTML + vanilla JS.

---

## 🧠 MediaPipe Pose Landmark Map

See the official [MediaPipe Pose topology](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker).

---

## 📁 File Structure

```
body-tracking/
└── index.html     ← The entire application (single file)
```

That's it.

---

## 🚀 Deploy Your Own

```bash
# Fork or clone
git clone https://github.com/YOUR-USERNAME/body-tracking.git

# No install needed — just serve it
npx serve .           # or
python -m http.server # or just open index.html in Chrome
```

**GitHub Pages:**

1. Repo → **Settings → Pages**
2. Source: `main` branch, `/ (root)`
3. Save → live at `https://alxandrb.github.io/Threejs-Body-Tracker/`

---

## 📜 License

**Proprietary — All Rights Reserved.**

This code may not be used, copied, modified, or distributed without explicit written permission from the author. Viewing the source does not grant any rights. See [`LICENSE`](LICENSE) for full terms.

---

<div align="center">

Made with `Three.js` + `MediaPipe` + one HTML file

_Built for speed. Built for Blender. Built in the browser._

</div>
