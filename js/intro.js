import * as THREE from 'three';
import { camera } from './scene.js';
import { charizard, standingCharizard } from './charizard.js';
import { golbat } from './golbat.js';
import { magikarp } from './magikarp.js';

// ── DOM helpers ───────────────────────────────────────────────────────────────
const titleEl = document.getElementById('cutscene-title');
const fadeEl  = document.getElementById('fade');
const hudEl   = document.getElementById('hud');

function setTitle(text) { titleEl.textContent = text; titleEl.classList.add('visible'); }
function clearTitle()   { titleEl.classList.remove('visible'); }

// ── Timeline ──────────────────────────────────────────────────────────────────
const phases = [

    // 0 → 0.8 s : fade in — Charizard standing, Magikarp flopping on the ground
    {
        start: 0, end: 0.8,
        onEnter() {
            hudEl.style.display = 'none';
            fadeEl.style.transition = 'none';
            fadeEl.style.opacity = '1';

            charizard.visible         = false;
            standingCharizard.visible = true;
            standingCharizard.position.set(0, 0, 0);
            standingCharizard.rotation.set(0, Math.PI, 0); // face camera

            // Magikarp held in front of Charizard
            magikarp.visible = true;
            magikarp.position.set(0, 1.2, -0.55);
            magikarp.rotation.set(0, 0, Math.PI * 0.08);

            // Golbat high up, out of frame initially
            golbat.position.set(6, 10, 4);

            // Low cinematic angle
            camera.position.set(-4, 1.2, -5);
            camera.lookAt(0, 1.2, 0);
        },
        update(t) {
            fadeEl.style.transition = 'none';
            fadeEl.style.opacity    = String(1 - t);
        },
    },

    // 0.8 → 2.2 s : "Charizard found a Magikarp…" — fish flops, Charizard looms over it
    {
        start: 0.8, end: 2.2,
        onEnter() { setTitle('Charizard found a Magikarp…'); },
        update(t) {
            // Magikarp flops in Charizard's grip
            magikarp.position.set(0, 1.2 + Math.sin(Date.now() * 0.006) * 0.05, -0.55);
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(Date.now() * 0.006) * 0.15;
            camera.position.set(-4 + t * 1.2, 1.2 + t * 0.3, -5 + t * 0.8);
            camera.lookAt(0, 1.0, 0.6);
        },
        onExit() { clearTitle(); },
    },

    // 2.2 → 2.8 s : dramatic pause — "Dinner time. 🔥"
    {
        start: 2.2, end: 2.8,
        onEnter() { setTitle('Dinner time. 🔥'); },
        update() {
            magikarp.position.set(0, 1.2 + Math.sin(Date.now() * 0.006) * 0.05, -0.55);
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(Date.now() * 0.006) * 0.15;
        },
        onExit() { clearTitle(); },
    },

    // 2.8 → 4.0 s : Golbat dives in and snatches Magikarp
    {
        start: 2.8, end: 4.0,
        onEnter() { setTitle('But Golbat swoops in!'); },
        _startPos: null,
        onEnterCapture() { this._startPos = golbat.position.clone(); },
        update(t) {
            const ease   = t * t * (3 - 2 * t);
            const target = new THREE.Vector3(0.2, 0.8, 1.5); // swoop toward Magikarp
            golbat.position.lerpVectors(this._startPos, target, ease);
            golbat.lookAt(magikarp.position);
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(Date.now() * 0.006) * 0.15;
            camera.position.set(-2.8, 1.5, -4 + t * 1.5);
            camera.lookAt(0, 1.0, 0.6);
        },
        onExit() {
            clearTitle();
            // Magikarp is now "held" by Golbat — park it relative to Golbat
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
        },
    },

    // 4.0 → 5.2 s : Golbat escapes with Magikarp
    {
        start: 4.0, end: 5.2,
        onEnter() { setTitle('It stole the Magikarp — CHASE IT!'); },
        _startGolbat: null,
        onEnterCapture() { this._startGolbat = golbat.position.clone(); },
        update(t) {
            const ease   = t * t * (3 - 2 * t);
            const target = new THREE.Vector3(0, 5, 18);
            golbat.position.lerpVectors(this._startGolbat, target, ease);
            // Magikarp travels with Golbat
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(Date.now() * 0.01) * 0.3; // frantic flop
            // Camera tilts up to follow
            camera.position.set(-2, 2 + t * 2, -1 + t * 5);
            camera.lookAt(golbat.position);
        },
        onExit() { clearTitle(); },
    },

    // 5.2 → 6.0 s : fade to black, swap to flying model
    {
        start: 5.2, end: 6.0,
        onEnter() {
            fadeEl.style.transition = 'opacity 0.8s ease';
            fadeEl.style.opacity    = '1';
        },
        update() {
            // Keep Magikarp with Golbat during fade
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
        },
        onExit() {
            standingCharizard.visible = false;
            charizard.visible         = true;
        },
    },
];

// ── Public API ────────────────────────────────────────────────────────────────
export const INTRO_DURATION = 6.0;

let elapsed    = 0;
let phaseIndex = 0;
let entered    = false;

export function resetIntro() {
    elapsed = 0; phaseIndex = 0; entered = false;
}

export function updateIntro(dt) {
    elapsed += dt;

    while (phaseIndex < phases.length && elapsed >= phases[phaseIndex].end) {
        if (phases[phaseIndex].onExit) phases[phaseIndex].onExit();
        phaseIndex++;
        entered = false;
    }

    if (phaseIndex >= phases.length) {
        hudEl.style.display  = '';
        fadeEl.style.opacity = '0';
        return true;
    }

    const phase = phases[phaseIndex];
    if (!entered) {
        entered = true;
        if (phase.onEnter)        phase.onEnter();
        if (phase.onEnterCapture) phase.onEnterCapture();
    }

    const t = (elapsed - phase.start) / (phase.end - phase.start);
    if (phase.update) phase.update(Math.max(0, Math.min(1, t)));

    return false;
}
