import * as THREE from 'three';
import { camera, fireLight, scene } from './scene.js';
import { charizard, standingCharizard, flame } from './charizard.js';
import { golbat } from './golbat.js';
import { magikarp } from './magikarp.js';
import { obstacles } from './world.js';
import { pikachu, pikachuRiding } from './pikachu.js';

// ── DOM helpers ───────────────────────────────────────────────────────────────
const titleEl = document.getElementById('cutscene-title');
const fadeEl  = document.getElementById('fade');
const hudEl   = document.getElementById('hud');

function setTitle(text) { titleEl.textContent = text; titleEl.classList.add('visible'); }
function clearTitle()   { titleEl.classList.remove('visible'); }

// ── Outro table ───────────────────────────────────────────────────────────────
// Double-width version of the intro table. Golbat lands on it; Charizard stands
// on Golbat's back above it. Surface at world y = TABLE_SURFACE_Y.
const TABLE_SURFACE_Y = 0.77;

const tableMat  = new THREE.MeshToonMaterial({ color: 0x7a4e2d });
const outroTable = new THREE.Group();

const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.6), tableMat);
tableTop.position.y = 0.735;
tableTop.castShadow = true;
tableTop.receiveShadow = true;
outroTable.add(tableTop);

const legGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.70, 8);
for (const [lx, lz] of [[0.94, 0.25], [-0.94, 0.25], [0.94, -0.25], [-0.94, -0.25]]) {
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(lx, 0.35, lz);
    leg.castShadow = true;
    outroTable.add(leg);
}

outroTable.position.set(0, 0, -0.5);
outroTable.visible = false;
scene.add(outroTable);

// ── Timeline ──────────────────────────────────────────────────────────────────
const phases = [

    // 0 → 0.8 s : freeze — catch flash
    {
        start: 0, end: 0.8,
        onEnter() {
            hudEl.style.display = 'none';
            setTitle('Got it! 🎉');
            // Freeze Golbat with Magikarp still attached
            magikarp.visible = true;
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
        },
        update() {
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
        },
        onExit() { clearTitle(); },
    },

    // 0.8 → 2.2 s : Golbat + flying Charizard descend; blackout just before landing
    {
        start: 0.8, end: 2.2,
        _startGolbatY: null,
        _startCharizardPos: null,
        onEnterCapture() {
            this._startGolbatY      = golbat.position.y;
            this._startCharizardPos = charizard.position.clone();
            charizard.visible     = true;
            pikachuRiding.visible = true;
            outroTable.visible    = true;
        },
        update(t) {
            const ease = t * t * (3 - 2 * t);

            // Golbat descends onto the table surface
            golbat.position.y = THREE.MathUtils.lerp(this._startGolbatY, TABLE_SURFACE_Y + golbatHalfHeight, ease);
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));

            // Flying Charizard + Pikachu descend with Golbat
            charizard.position.set(
                golbat.position.x,
                golbat.position.y + golbatHalfHeight + 1.2,
                golbat.position.z + 0.5
            );
            pikachuRiding.position.copy(charizard.position)
                .add(new THREE.Vector3(0, 1.2, 0));
            pikachuRiding.rotation.copy(charizard.rotation);

            // Camera orbits around Golbat
            const angle  = t * Math.PI;
            const center = golbat.position.clone();
            camera.position.set(
                center.x + Math.sin(angle) * 5,
                center.y + 2,
                center.z + Math.cos(angle) * 5
            );
            camera.lookAt(center);

            // Quick blackout in the last 15% of the phase
            if (t > 0.85) {
                const bf = (t - 0.85) / 0.15;
                fadeEl.style.transition = 'none';
                fadeEl.style.opacity = String(bf);
            }
        },
    },

    // 2.2 → 3.2 s : blackout clears — everyone snaps to ground, standing models appear
    {
        start: 2.2, end: 3.2,
        onEnter() {
            setTitle('Charizard reclaims his meal!');

            // Snap Golbat onto the table, offset to one side so Magikarp fits
            golbat.position.set(0, TABLE_SURFACE_Y + golbatHalfHeight, -0.5);
            // Magikarp rests on the table beside Golbat
            magikarp.visible = true;
            magikarp.position.set(0.4, TABLE_SURFACE_Y + 0.05, -0.5);
            magikarp.rotation.set(0, 0, Math.PI * 0.08);

            // Swap flying → standing; Charizard on the ground facing camera (like the intro)
            charizard.visible         = false;
            pikachuRiding.visible     = false;
            standingCharizard.visible = true;
            standingCharizard.position.set(0, 0, 0);
            standingCharizard.rotation.set(0, Math.PI, 0);

            // Pikachu beside Charizard on the ground
            pikachu.visible = true;
            pikachu.rotation.set(0, Math.PI, 0);
            pikachu.position.set(0.9, 0, -0.2);

            // Camera framing — low angle looking at the table scene
            camera.position.set(-3.5, 1.5, -4.5);
            camera.lookAt(0, 0.8, -0.4);

            // Fade back in
            fadeEl.style.transition = 'opacity 0.25s ease';
            fadeEl.style.opacity    = '0';
        },
        update(t) {
            // Magikarp flops gently on the table
            magikarp.position.y = TABLE_SURFACE_Y + 0.05 + Math.sin(t * Math.PI * 5) * 0.02;
            magikarp.rotation.z = Math.PI * 0.08 + Math.sin(t * Math.PI * 5) * 0.12;
            camera.lookAt(0, 0.8, -0.4);
        },
        onExit() { clearTitle(); },
    },

    // 3.2 → 4.8 s : Charizard holds Magikarp over his flame and cooks it
    {
        start: 3.2, end: 4.8,
        onEnter() { setTitle('Charizard used Flame Thrower! 🔥'); },
        update(t) {
            const ease = t * t * (3 - 2 * t);

            // Magikarp stays on the table and spins slowly (being cooked)
            magikarp.position.set(0.4, TABLE_SURFACE_Y + 0.05, -0.5);
            magikarp.rotation.y += 0.04;

            // Flame swells
            const s = 1 + ease * 4;
            flame.scale.set(s, s, s);

            // Fire glow rises above the Magikarp on the table
            fireLight.position.set(0.4, TABLE_SURFACE_Y + 0.4, -0.5);
            fireLight.intensity = 3 + ease * 8;

            // Camera pulls back to frame the whole scene
            const center = standingCharizard.position;
            camera.position.lerp(
                new THREE.Vector3(center.x - 4, center.y + 2, center.z - 6), 0.05
            );
            camera.lookAt(center);
        },
        onExit() { clearTitle(); },
    },

    // 4.8 → 6.2 s : "Dinner is Cooked!" — hold then fade
    {
        start: 4.8, end: 6.2,
        onEnter() {
            setTitle('Dinner is Cooked! 🍽️');
            fadeEl.style.transition = 'opacity 1.2s ease';
        },
        update(t) {
            // Keep cooking
            magikarp.rotation.y += 0.02;
            fireLight.intensity = 11 - t * 8;
            if (t > 0.4) fadeEl.style.opacity = String((t - 0.4) / 0.6);
        },
        onExit() { clearTitle(); },
    },

    // 6.2 → 7.0 s : hold on black screen before win overlay appears
    {
        start: 6.2, end: 7.0,
        onEnter() { fadeEl.style.opacity = '1'; },
        update() {},
    },
];

// ── Public API ────────────────────────────────────────────────────────────────
export const OUTRO_DURATION = 7.0;

let elapsed    = 0;
let phaseIndex = 0;
let entered    = false;
let active     = false;

// Computed at outro start from actual model bounds
let golbatHalfHeight  = 1.0;  // fallback
let charizardHeight   = 1.5;  // fallback

// Intro scene origin — outro plays in the same spot
const SCENE_ORIGIN = new THREE.Vector3(0, 0, 0);

export function triggerOutro() {
    elapsed    = 0;
    phaseIndex = 0;
    entered    = false;
    active     = true;
    outroTable.visible = false;

    // Widen FOV for a more cinematic outro feel
    camera.fov = 75;
    camera.updateProjectionMatrix();

    // Hide both pikachu models until the perch phase shows the standing one
    pikachu.visible       = false;
    pikachuRiding.visible = false;

    // Teleport back to intro location so outro plays at the same spot
    golbat.position.set(SCENE_ORIGIN.x, 4, SCENE_ORIGIN.z);
    magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));

    // Move any obstacles within 15 units of the scene origin far away
    for (const obs of obstacles) {
        const dx = obs.position.x - SCENE_ORIGIN.x;
        const dz = obs.position.z - SCENE_ORIGIN.z;
        if (Math.sqrt(dx * dx + dz * dz) < 15) {
            obs.position.x += 300;
            obs.position.z += 300;
        }
    }

    // Measure Golbat origin-to-bottom so we can land it on the ground
    const golbatBox = new THREE.Box3().setFromObject(golbat);
    golbatHalfHeight = golbat.position.y - golbatBox.min.y;

    // Measure standing Charizard height
    if (standingCharizard.children.length > 0) {
        standingCharizard.visible = true;
        standingCharizard.position.set(0, 0, 0);
        const czBox = new THREE.Box3().setFromObject(standingCharizard);
        standingCharizard.visible = false;
        charizardHeight = czBox.max.y - czBox.min.y;
    }

    console.log(`Outro: golbat originToBottom=${golbatHalfHeight.toFixed(2)}, charizardH=${charizardHeight.toFixed(2)}`);
}

export function updateOutro(dt) {
    if (!active) return false;
    elapsed += dt;

    while (phaseIndex < phases.length && elapsed >= phases[phaseIndex].end) {
        if (phases[phaseIndex].onExit) phases[phaseIndex].onExit();
        phaseIndex++;
        entered = false;
    }

    if (phaseIndex >= phases.length) {
        camera.fov = 50;
        camera.updateProjectionMatrix();
        outroTable.visible = false;
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
