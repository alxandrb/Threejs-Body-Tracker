/**
 * settings.js
 * Wires up the settings panel: panel open/close, sliders, toggles.
 * Mutates the shared opts object in config.js.
 * Has no knowledge of Three.js internals — delegates side-effects
 * through callbacks or direct material/DOM mutations.
 */

import { opts }       from './config.js';
import { DOM }        from './ui.js';
import { boneMat }    from './hand.js';
import { setMPRate }  from './tracking.js';

// ─── Panel open / close ──────────────────────────────────────────────
function initPanel() {
  const btn   = document.getElementById('sbtn');
  const panel = document.getElementById('spanel');
  let isOpen  = false;

  const open  = () => {
    isOpen = true;
    panel.classList.add('open');
    btn.classList.add('open');
    btn.textContent = '✕ CLOSE';
  };

  const close = () => {
    isOpen = false;
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.textContent = '⚙ SETTINGS';
  };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    isOpen ? close() : open();
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (isOpen && !panel.contains(e.target) && e.target !== btn) close();
  });

  // Don't close when clicking inside the panel
  panel.addEventListener('click', e => e.stopPropagation());
}

// ─── Slider factory ──────────────────────────────────────────────────
/**
 * @param {string}   slId      - Suffix used in HTML ids (sl-X, sf-X, sv-X)
 * @param {string}   optsKey   - Key in opts to update
 * @param {number}   min
 * @param {number}   max
 * @param {Function} fmt       - (value) => display string
 * @param {Function} [onInput] - Optional side-effect callback (value)
 */
function makeSlider(slId, optsKey, min, max, fmt, onInput) {
  const slider = document.getElementById('sl-' + slId);
  const fill   = document.getElementById('sf-' + slId);
  const label  = document.getElementById('sv-' + slId);

  const update = () => {
    const v = parseFloat(slider.value);
    opts[optsKey]     = v;
    label.textContent = fmt(v);
    fill.style.width  = ((v - min) / (max - min) * 100) + '%';
    if (onInput) onInput(v);
  };

  slider.addEventListener('input', update);
  update(); // sync display on init
}

// ─── Toggle factory ───────────────────────────────────────────────────
/**
 * @param {string}   id       - Checkbox element id
 * @param {string}   optsKey  - Key in opts to update
 * @param {Function} [onChange] - Optional side-effect callback (checked)
 */
function makeToggle(id, optsKey, onChange) {
  const el = document.getElementById(id);
  el.addEventListener('change', () => {
    opts[optsKey] = el.checked;
    if (onChange) onChange(el.checked);
  });
}

// ─── Smooth label helper ─────────────────────────────────────────────
const smoothLabel = v => {
  if (v >= 0.8) return 'RAW';
  if (v >= 0.5) return 'LOW';
  if (v >= 0.2) return 'MED';
  return 'HIGH';
};

// ─── Init all sliders ────────────────────────────────────────────────
function initSliders() {
  makeSlider('sm', 'smooth', 0.02, 1.0, smoothLabel, v => {
    DOM.bSm.textContent = smoothLabel(v);
  });

  makeSlider('sc', 'scale', 0.5, 2.5, v => v.toFixed(2));

  makeSlider('mp', 'mpFPS', 5, 30, v => v + 'fps', v => {
    setMPRate(v);
  });
}

// ─── Init all toggles ────────────────────────────────────────────────
function initToggles() {
  makeToggle('t-jo', 'joints');
  makeToggle('t-bo', 'bones');
  makeToggle('t-ti', 'tips');
  makeToggle('t-pa', 'particles');
  makeToggle('t-pu', 'pulse');

  makeToggle('t-ca', 'cam', checked => {
    DOM.video.classList.toggle('hidden', !checked);
  });

  makeToggle('t-wi', 'wire', checked => {
    boneMat.wireframe = checked;
  });
}

// ─── Public API ─────────────────────────────────────────────────────
export function initSettings() {
  initPanel();
  initSliders();
  initToggles();
}
