import * as THREE from 'three';
import { camera, scene } from './scene.js';
import { charizard, standingCharizard } from './charizard.js';
import { golbat } from './golbat.js';
import { magikarp } from './magikarp.js';
import { pikachu } from './pikachu.js';

// ── DOM helpers ───────────────────────────────────────────────────────────────
const titleEl = document.getElementById('cutscene-title');
const fadeEl  = document.getElementById('fade');
const hudEl   = document.getElementById('hud');

function setTitle(text) { titleEl.textContent = text; titleEl.classList.add('visible'); }
function clearTitle()   { titleEl.classList.remove('visible'); }

// ── Intro table ───────────────────────────────────────────────────────────────
// Simple wood table: flat BoxGeometry top + four CylinderGeometry legs.
// Sits at z = -0.65 (in front of standing Charizard, toward the camera).
// Table top surface is at world y ≈ 0.77.
const tableMat = new THREE.MeshToonMaterial({ color: 0x7a4e2d });
const introTable = new THREE.Group();

const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.6), tableMat);
tableTop.position.y = 0.735;
tableTop.castShadow = true;
tableTop.receiveShadow = true;
introTable.add(tableTop);

const legGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.70, 8);
for (const [lx, lz] of [[0.44, 0.25], [-0.44, 0.25], [0.44, -0.25], [-0.44, -0.25]]) {
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(lx, 0.35, lz);
    leg.castShadow = true;
    introTable.add(leg);
}

introTable.position.set(0, 0, -0.65);
introTable.visible = false;
scene.add(introTable);

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

            // Pikachu beside Charizard
            pikachu.visible = true;
            pikachu.position.set(0.9, 0, -0.2);
            pikachu.rotation.set(0, Math.PI, 0);

            // Table and Magikarp on top of it
            introTable.visible = true;
            magikarp.visible = true;
            magikarp.position.set(0, 0.80, -0.65);
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
        update(t, elapsed) {
            // Magikarp flops on the table
            magikarp.position.set(0, 0.80 + Math.sin(elapsed * 6) * 0.03, -0.65);
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(elapsed * 6) * 0.15;
            camera.position.set(-4 + t * 1.2, 1.2 + t * 0.3, -5 + t * 0.8);
            camera.lookAt(0, 1.0, 0.6);
        },
        onExit() { clearTitle(); },
    },

    // 2.2 → 2.8 s : dramatic pause — "Dinner time. 🔥"
    {
        start: 2.2, end: 2.8,
        onEnter() { setTitle('Dinner time. 🔥'); },
        update(t, elapsed) {
            magikarp.position.set(0, 0.80 + Math.sin(elapsed * 6) * 0.03, -0.65);
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(elapsed * 6) * 0.15;
        },
        onExit() { clearTitle(); },
    },

    // 2.8 → 4.0 s : Golbat dives in and snatches Magikarp
    {
        start: 2.8, end: 4.0,
        onEnter() { setTitle('But Golbat swoops in!'); },
        _startPos: null,
        onEnterCapture() { this._startPos = golbat.position.clone(); },
        update(t, elapsed) {
            const ease   = t * t * (3 - 2 * t);
            const target = new THREE.Vector3(0.2, 1.1, -0.4); // swoop down to the table
            golbat.position.lerpVectors(this._startPos, target, ease);
            golbat.lookAt(magikarp.position);
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(elapsed * 6) * 0.15;
            camera.position.set(-2.8, 1.5, -4 + t * 1.5);
            camera.lookAt(0, 1.0, 0.6);
        },
        onExit() {
            clearTitle();
            introTable.visible = false;
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
        update(t, elapsed) {
            const ease   = t * t * (3 - 2 * t);
            const target = new THREE.Vector3(0, 5, 18);
            golbat.position.lerpVectors(this._startGolbat, target, ease);
            // Magikarp travels with Golbat
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(elapsed * 10) * 0.3; // frantic flop
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
            pikachu.visible           = false; // riding model takes over in gameplay
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
    introTable.visible = false;
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
    if (phase.update) phase.update(Math.max(0, Math.min(1, t)), elapsed);

    return false;
}
