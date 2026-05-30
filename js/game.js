import * as THREE from 'three';
import { scene, camera, composer, fireLight } from './scene.js';
import { obstacles, recycleObstacles, updateGround, updateClouds, loadWorldAssets } from './world.js';
import { charizard, flame, loadCharizard, loadStandingCharizard, getCharizardForward, updateAnimation } from './charizard.js';
import { golbat, golbatVelocity, loadGolbat, updateGolbat } from './golbat.js';
import { coins, updateCoins } from './coins.js';
import { magikarp, loadMagikarp } from './magikarp.js';
import { keys, state } from './controls.js';
import { updateIntro } from './intro.js';
import { updateOutro, triggerOutro } from './outro.js';

// ── Golbat AI constants ───────────────────────────────────────────────────────
const GOLBAT_FLEE_SPEED  = 10;  // comfortable cruising away from Charizard
const GOLBAT_PANIC_SPEED = 14;  // when Charizard closes within PANIC_DIST
const GOLBAT_PANIC_DIST  = 10;
const GOLBAT_ACCEL       = 9;   // how fast Golbat adjusts its velocity

// ── Phase & pause ─────────────────────────────────────────────────────────────
let phase  = 'intro';
let paused = false;

const clock     = new THREE.Clock();
let golbatTimer = 0;

// ── HUD elements (cached) ─────────────────────────────────────────────────────
const elSpeed        = document.getElementById('speed');
const elAltitude     = document.getElementById('altitude');
const elBoostPct     = document.getElementById('boost-pct');
const elBoostBar     = document.getElementById('boost-bar');
const elBoostReady   = document.getElementById('boost-ready');
const elHearts       = document.getElementById('hearts');
const elMsg          = document.getElementById('msg');
const elHud          = document.getElementById('hud');
const elPauseOverlay = document.getElementById('pause-overlay');
const elFade         = document.getElementById('fade');
const elCutsceneTitle = document.getElementById('cutscene-title');

function updateHeartsHUD() {
    elHearts.textContent = '❤️'.repeat(state.hearts) + '🖤'.repeat(state.maxHearts - state.hearts);
}

// ── Pause / resume ────────────────────────────────────────────────────────────
function setPaused(val) {
    paused = val;
    elPauseOverlay.style.display = val ? 'flex' : 'none';
    if (val) clock.getDelta(); // drain accumulated delta so resume doesn't jump
}

// ── Reset / retry (skipIntro = true jumps straight to playing) ────────────────
function resetGame() {
    // Reset state
    state.hearts          = state.maxHearts;
    state.boost           = 0;
    state.boostActive     = false;
    state.invincible      = false;
    state.invincibleTimer = 0;
    state.gameOver        = false;
    state.retrievedLighter = false;
    state.yaw = 0; state.pitch = 0; state.roll = 0;
    state.speed = 5;

    golbatTimer = 0;
    golbatVelocity.set(0, 0, 0);

    // Reset Charizard
    charizard.visible = true;
    charizard.position.set(0, 3, 0);
    charizard.rotation.set(0, 0, 0);
    flame.scale.set(1, 1, 1);

    // Reset Golbat
    golbat.position.set(0, 4, 20);

    // Reset Magikarp — attach back to Golbat
    magikarp.visible = true;
    magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
    magikarp.rotation.set(0, 0, Math.PI * 0.08);

    // Clear UI
    elMsg.textContent           = '';
    elFade.style.transition     = 'none';
    elFade.style.opacity        = '0';
    elCutsceneTitle.style.opacity = '0';
    elHud.style.display         = '';
    updateHeartsHUD();

    // Go straight to gameplay — skip cutscene
    phase = 'playing';
    setPaused(false);
}

// ── Key & button listeners ────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (phase === 'playing' || paused)) {
        setPaused(!paused);
    }
});
document.getElementById('btn-resume').addEventListener('click', () => setPaused(false));
document.getElementById('btn-retry').addEventListener('click', resetGame);

// ── Gameplay update ───────────────────────────────────────────────────────────
function updateGameplay(dt) {
    if (state.gameOver) return;

    // ── Flight controls ───────────────────────────────────────────────────────
    if (keys['a']) state.yaw   += state.rotationSpeed * dt;
    if (keys['d']) state.yaw   -= state.rotationSpeed * dt;
    if (keys['w']) state.pitch  = Math.min( 0.8, state.pitch + state.rotationSpeed * dt);
    if (keys['s']) state.pitch  = Math.max(-0.8, state.pitch - state.rotationSpeed * dt);
    if (keys['q']) state.roll  -= state.rotationSpeed * dt;
    if (keys['e']) state.roll  += state.rotationSpeed * dt;

    if (keys['arrowup'])   state.speed = Math.min(state.maxSpeed, state.speed + 5 * dt);
    if (keys['arrowdown']) state.speed = Math.max(state.minSpeed, state.speed - 5 * dt);

    // ── Boost (Shift) ─────────────────────────────────────────────────────────
    const wantsBoost = keys['shift'] && state.boost > 0;
    if (wantsBoost) {
        state.boostActive = true;
        state.boost = Math.max(0, state.boost - state.BOOST_DRAIN * dt);
    } else {
        state.boostActive = false;
    }
    const currentMaxSpeed = state.boostActive ? state.BOOST_SPEED : state.maxSpeed;
    state.speed = Math.min(state.speed, currentMaxSpeed);

    // ── Apply orientation ─────────────────────────────────────────────────────
    charizard.rotation.order = 'YXZ';
    charizard.rotation.y = state.yaw;
    charizard.rotation.x = state.pitch;
    charizard.rotation.z = state.roll;

    const forward = getCharizardForward();

    // ── Movement ──────────────────────────────────────────────────────────────
    const flySpeed = state.boostActive
        ? THREE.MathUtils.lerp(state.speed, state.BOOST_SPEED, 0.15)
        : state.speed;
    charizard.position.addScaledVector(forward, flySpeed * dt);
    charizard.position.y = Math.max(1.5, Math.min(18, charizard.position.y));

    // Fire glow
    fireLight.position.copy(charizard.position)
        .add(new THREE.Vector3(0, 0.5, 0).addScaledVector(forward, 1.2));

    // ── Golbat velocity-based AI ──────────────────────────────────────────────
    // Golbat chases a target 20 m ahead + sinusoidal weave.
    // It has a capped max speed, so a fast-enough Charizard can actually catch it.
    golbatTimer += dt;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(charizard.quaternion);
    const desiredPos = charizard.position.clone()
        .addScaledVector(forward, 20)
        .addScaledVector(right, Math.sin(golbatTimer * 1.8) * 7)
        .add(new THREE.Vector3(0, 3 + Math.cos(golbatTimer * 1.2) * 2, 0));

    const distToPlayer = charizard.position.distanceTo(golbat.position);
    const maxGolbatSpd = distToPlayer < GOLBAT_PANIC_DIST
        ? GOLBAT_PANIC_SPEED
        : GOLBAT_FLEE_SPEED;

    // Steer toward desired position
    const toDesired = desiredPos.clone().sub(golbat.position);
    if (toDesired.length() > 0.1) {
        golbatVelocity.addScaledVector(toDesired.normalize(), GOLBAT_ACCEL * dt);
    }
    // Clamp to max speed
    if (golbatVelocity.length() > maxGolbatSpd) golbatVelocity.setLength(maxGolbatSpd);

    golbat.position.addScaledVector(golbatVelocity, dt);

    // Keep Golbat in a sensible altitude band — same ceiling as Charizard
    golbat.position.y = Math.max(2.5, Math.min(18, golbat.position.y));

    // Push Golbat away from obstacles so it doesn't clip through them
    for (const obs of obstacles) {
        const { collisionRadius, collisionHeight } = obs.userData;
        if (golbat.position.y > collisionHeight) continue;
        const odx = golbat.position.x - obs.position.x;
        const odz = golbat.position.z - obs.position.z;
        const odist = Math.sqrt(odx * odx + odz * odz);
        const avoid = collisionRadius + 2.5;
        if (odist < avoid && odist > 0) {
            const push = (avoid - odist) * 4;
            golbatVelocity.x += (odx / odist) * push * dt;
            golbatVelocity.z += (odz / odist) * push * dt;
            // Also nudge upward to fly over instead of into the obstacle
            golbatVelocity.y += push * dt * 0.5;
        }
    }

    golbat.lookAt(charizard.position);

    // Magikarp dangles from Golbat during the chase
    magikarp.position.copy(golbat.position).add(new THREE.Vector3(0, -0.4, 0.5));
    magikarp.rotation.z = Math.PI * 0.08 + Math.sin(golbatTimer * 4) * 0.12; // flop

    // ── Coins → boost ─────────────────────────────────────────────────────────
    const gained = updateCoins(charizard.position, dt);
    if (gained > 0) {
        state.boost = Math.min(state.BOOST_MAX, state.boost + gained);
    }

    // ── Invincibility blink ───────────────────────────────────────────────────
    if (state.invincible) {
        state.invincibleTimer += dt;
        charizard.visible = Math.floor(state.invincibleTimer / 0.1) % 2 === 0;
        if (state.invincibleTimer >= state.INVINCIBLE_DURATION) {
            state.invincible  = false;
            charizard.visible = true;
        }
    }

    // ── Obstacle collision ────────────────────────────────────────────────────
    if (!state.invincible) {
        const py = charizard.position.y;
        for (const obs of obstacles) {
            const { collisionRadius, collisionHeight, isMountain } = obs.userData;
            if (py > collisionHeight) continue;
            const dx = charizard.position.x - obs.position.x;
            const dz = charizard.position.z - obs.position.z;
            const xzDist = Math.sqrt(dx * dx + dz * dz);
            const effR   = isMountain
                ? collisionRadius * (1 - py / collisionHeight)
                : collisionRadius;
            if (xzDist < effR + 0.4) {
                state.hearts--;
                updateHeartsHUD();
                if (state.hearts <= 0) {
                    state.gameOver = true;
                    phase = 'gameover';
                    elMsg.textContent = '💀 Game Over!';
                    setPaused(true);
                    return;
                }
                // Brief knockback + invincibility window
                charizard.position.addScaledVector(forward, -2);
                state.invincible      = true;
                state.invincibleTimer = 0;
                break;
            }
        }
    }

    // ── Catch Golbat ──────────────────────────────────────────────────────────
    if (distToPlayer < 0.5) {
        phase = 'outro';
        triggerOutro();
        return;
    }

    // ── World upkeep ──────────────────────────────────────────────────────────
    updateGround(charizard.position);
    recycleObstacles(charizard.position, forward);
    updateClouds(charizard.position, dt);

    // ── Chase camera ──────────────────────────────────────────────────────────
    const behindOffset    = new THREE.Vector3(0, 3, -6).applyQuaternion(charizard.quaternion);
    const lookAheadOffset = new THREE.Vector3(0, 1,  2).applyQuaternion(charizard.quaternion);
    camera.position.lerp(charizard.position.clone().add(behindOffset), 0.1);
    camera.lookAt(charizard.position.clone().add(lookAheadOffset));

    // ── HUD ───────────────────────────────────────────────────────────────────
    const displaySpeed = state.boostActive ? flySpeed : state.speed;
    elSpeed.textContent    = displaySpeed.toFixed(1);
    elAltitude.textContent = charizard.position.y.toFixed(1);
    const boostPct = Math.round((state.boost / state.BOOST_MAX) * 100);
    elBoostPct.textContent        = boostPct + '%';
    elBoostBar.style.width        = boostPct + '%';
    elBoostBar.style.background   = state.boostActive ? '#ff8800' : '#00ccff';
    elBoostReady.style.display    = state.boost > 0 && !state.boostActive ? 'inline' : 'none';
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (paused) { composer.render(); return; }

    updateAnimation(dt);
    updateGolbat(dt);

    if (phase === 'intro') {
        const done = updateIntro(dt);
        if (done) {
            phase = 'playing';
            charizard.position.set(0, 3, 0);
            charizard.rotation.set(0, 0, 0);
            state.yaw = 0; state.pitch = 0; state.roll = 0;
            // Make sure Magikarp is attached to Golbat for gameplay
            magikarp.visible = true;
        }
    } else if (phase === 'playing') {
        updateGameplay(dt);
    } else if (phase === 'outro') {
        updateOutro(dt);
    }

    composer.render();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
Promise.all([loadCharizard(), loadStandingCharizard(), loadGolbat(), loadMagikarp(), loadWorldAssets()]).then(() => {
    animate();
    console.log('Ready — WASD steer | ↑↓ speed | SHIFT boost (collect coins to charge)');
});
