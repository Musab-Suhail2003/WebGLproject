import * as THREE from 'three';
import { camera, fireLight } from './scene.js';
import { charizard, standingCharizard, flame } from './charizard.js';
import { golbat } from './golbat.js';
import { magikarp } from './magikarp.js';
import { obstacles } from './world.js';

// ── DOM helpers ───────────────────────────────────────────────────────────────
const titleEl = document.getElementById('cutscene-title');
const fadeEl  = document.getElementById('fade');
const hudEl   = document.getElementById('hud');

function setTitle(text) { titleEl.textContent = text; titleEl.classList.add('visible'); }
function clearTitle()   { titleEl.classList.remove('visible'); }

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

    // 0.8 → 2.2 s : Golbat descends and "lands" (hovers low), camera orbits
    {
        start: 0.8, end: 2.2,
        _center: null,
        _startGolbatY: null,
        onEnterCapture() {
            this._center      = golbat.position.clone();
            this._startGolbatY = golbat.position.y;
        },
        update(t) {
            const ease = t * t * (3 - 2 * t);
            // Golbat descends so its bottom edge sits at y=0
            golbat.position.y = THREE.MathUtils.lerp(this._startGolbatY, golbatHalfHeight/4, ease);
            magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
            // Orbit camera
            const angle  = t * Math.PI;
            const center = new THREE.Vector3(golbat.position.x, 0.8, golbat.position.z);
            camera.position.set(
                center.x + Math.sin(angle) * 5,
                center.y + 2,
                center.z + Math.cos(angle) * 5
            );
            camera.lookAt(center);
        },
    },

    // 2.2 → 3.2 s : standingCharizard appears on top of Golbat
    {
        start: 2.2, end: 3.2,
        onEnter() {
            setTitle('Charizard reclaims his meal!');
            charizard.visible         = false;
            standingCharizard.visible = true;
            // Face forward, stay upright (Y-up)
            standingCharizard.rotation.set(0, Math.PI, 0);
        },
        update(t) {
            // Sit Charizard on top of Golbat — top of Golbat + half Charizard height
            const targetY = golbat.position.y + golbatHalfHeight;
            standingCharizard.position.set(
                golbat.position.x,
                THREE.MathUtils.lerp(golbat.position.y + 4, targetY, t * t),
                golbat.position.z
            );
            // Magikarp in front of standingCharizard (faces -z like in intro)
            magikarp.position.set(
                standingCharizard.position.x,
                standingCharizard.position.y + 1.2,
                standingCharizard.position.z - 0.55
            );
            camera.lookAt(standingCharizard.position);
        },
        onExit() { clearTitle(); },
    },

    // 3.2 → 4.8 s : Charizard holds Magikarp over his flame and cooks it
    {
        start: 3.2, end: 4.8,
        onEnter() { setTitle('Time to cook! 🔥'); },
        update(t) {
            const ease = t * t * (3 - 2 * t);
            // Magikarp floats up to flame height (Charizard "holds" it)
            const cookPos = standingCharizard.position.clone().add(new THREE.Vector3(0, 1.2 + t * 0.4, -0.55));
            magikarp.position.lerp(cookPos, 0.12);
            // Magikarp rotates slowly (being cooked)
            magikarp.rotation.y += 0.04;

            // Flame swells
            const s = 1 + ease * 4;
            flame.scale.set(s, s, s);

            // Fire glow intensifies around Magikarp
            fireLight.position.copy(magikarp.position);
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

    // 4.8 → 6.2 s : "Dinner is served!" — hold then fade
    {
        start: 4.8, end: 6.2,
        onEnter() {
            setTitle('Dinner is served! 🍽️');
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

    // Teleport back to intro location so outro plays at the same spot
    golbat.position.set(SCENE_ORIGIN.x, 8, SCENE_ORIGIN.z);
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

    if (phaseIndex >= phases.length) return true;

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
