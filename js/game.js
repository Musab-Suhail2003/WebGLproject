import * as THREE from 'three';
import { scene, camera, composer, fireLight } from './scene.js';
import { obstacles, recycleObstacles, updateGround, updateClouds, loadWorldAssets } from './world.js';
import { charizard, standingCharizard, flame, loadCharizard, loadStandingCharizard, getCharizardForward, updateAnimation } from './charizard.js';
import { golbat, golbatVelocity, loadGolbat, updateGolbat } from './golbat.js';
import { coins, updateCoins, resetCoins } from './coins.js';
import { magikarp, loadMagikarp } from './magikarp.js';
import { pikachu, pikachuRiding, loadpikachu } from './pikachu.js';
import { keys, state } from './controls.js';
import { updateIntro, resetIntro } from './intro.js';
import { updateOutro, triggerOutro } from './outro.js';
import { updateSludge, clearSludge } from './sludge.js';

// ── Golbat AI constants ───────────────────────────────────────────────────────
const GOLBAT_FLEE_SPEED  = 10;  // comfortable cruising away from Charizard
const GOLBAT_PANIC_SPEED = 14;  // when Charizard closes within PANIC_DIST
const GOLBAT_PANIC_DIST  = 10;
const GOLBAT_ACCEL       = 9;   // how fast Golbat adjusts its velocity

// Squared-distance culling radii for collision loops — obstacles beyond this
// distance cannot possibly overlap, so skip them before computing sqrt
const GOLBAT_CULL_SQ    = 15 * 15;
const CHARIZARD_CULL_SQ = 15 * 15;

// ── Phase & pause ─────────────────────────────────────────────────────────────
let phase  = 'intro';
let paused = false;

const clock     = new THREE.Clock();
let golbatTimer = 0;

// Scratch vectors — reused every frame to avoid GC pressure
const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpV3 = new THREE.Vector3();
const _tmpV4 = new THREE.Vector3();
const _tmpV5 = new THREE.Vector3();
const _tmpV6 = new THREE.Vector3();

// ── HUD elements (cached) ─────────────────────────────────────────────────────
const elSpeed        = document.getElementById('speed');
const elAltitude     = document.getElementById('altitude');
const elBoostPct     = document.getElementById('boost-pct');
const elBoostBar     = document.getElementById('boost-bar');
const elBoostReady   = document.getElementById('boost-ready');
const elHearts        = document.getElementById('hearts');
const elMsg           = document.getElementById('msg');
const elHud           = document.getElementById('hud');
const elPauseOverlay  = document.getElementById('pause-overlay');
const elPauseTitle    = document.getElementById('pause-title');
const elBtnResume     = document.getElementById('btn-resume');
const elFade          = document.getElementById('fade');
const elCutsceneTitle = document.getElementById('cutscene-title');
const elLoading       = document.getElementById('loading');
const elCompassRing   = document.getElementById('compass-ring');

function updateHeartsHUD() {
    let html = '';
    for (let i = 0; i < state.maxHearts; i++) {
        if (state.hearts >= i + 1)
            html += '<span class="heart heart-full">♥</span>';
        else if (state.hearts >= i + 0.5)
            html += '<span class="heart heart-half">♥</span>';
        else
            html += '<span class="heart heart-empty">♥</span>';
    }
    elHearts.innerHTML = html;
}

// ── Pause / resume ────────────────────────────────────────────────────────────
function showOverlay(title, showResume) {
    elPauseTitle.textContent        = title;
    elBtnResume.style.display       = showResume ? '' : 'none';
    elPauseOverlay.style.display    = 'flex';
    paused = true;
    clock.getDelta();
}

function hideOverlay() {
    elPauseOverlay.style.display = 'none';
    paused = false;
}

function setPaused(val) {
    if (val) showOverlay('⏸ PAUSED', true);
    else     hideOverlay();
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
    clearSludge();
    resetCoins();
    elCompassRing.style.display = 'none';

    // Reset models
    charizard.visible = true;
    charizard.position.set(0, 3, 0);
    charizard.rotation.set(0, 0, 0);
    flame.scale.set(1, 1, 1);
    pikachu.visible = false;
    pikachuRiding.visible = false;

    // Reset Golbat
    golbat.position.set(0, 4, 20);

    // Reset Magikarp — attach back to Golbat
    magikarp.visible = true;
    magikarp.position.copy(golbat.position).add(_tmpV5.set(0, -0.4, 0.5));
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
    if (e.key !== 'Escape') return;

    if (phase === 'intro') {
        // Skip intro — clean up and jump straight to gameplay
        resetIntro();
        standingCharizard.visible = false;
        charizard.visible = true;
        charizard.position.set(0, 3, 0);
        charizard.rotation.set(0, 0, 0);
        state.yaw = 0; state.pitch = 0; state.roll = 0;
        magikarp.visible = true;
        elFade.style.transition = 'none';
        elFade.style.opacity = '0';
        elCutsceneTitle.classList.remove('visible');
        elHud.style.display = '';
        phase = 'playing';
    } else if (phase === 'outro') {
        // Skip outro — jump straight to win screen
        phase = 'win';
        showOverlay('🍽️ YOU WIN!', false);
    } else if (phase === 'playing' || paused) {
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
        .add(_tmpV1.set(0, 0.5, 0).addScaledVector(forward, 1.2));

    // Riding Pikachu — model already has Pikachu on Charizard's back baked in
    pikachuRiding.visible = true;
    pikachuRiding.position.copy(charizard.position)
        .add(_tmpV1.set(0, 0.7, 0.1).applyQuaternion(charizard.quaternion));
    pikachuRiding.rotation.copy(charizard.rotation);

    // ── Golbat velocity-based AI ──────────────────────────────────────────────
    // Golbat chases a target 20 m ahead + sinusoidal weave.
    // It has a capped max speed, so a fast-enough Charizard can actually catch it.
    golbatTimer += dt;
    const right = _tmpV1.set(1, 0, 0).applyQuaternion(charizard.quaternion);
    const desiredPos = _tmpV2.copy(charizard.position)
        .addScaledVector(forward, 20)
        .addScaledVector(right, Math.sin(golbatTimer * 1.8) * 7)
        .add(_tmpV3.set(0, 3 + Math.cos(golbatTimer * 1.2) * 2, 0));

    const distToPlayer = charizard.position.distanceTo(golbat.position);
    const maxGolbatSpd = distToPlayer < GOLBAT_PANIC_DIST
        ? GOLBAT_PANIC_SPEED
        : GOLBAT_FLEE_SPEED;

    // Steer toward desired position
    const toDesired = _tmpV4.copy(desiredPos).sub(golbat.position);
    if (toDesired.length() > 0.1) {
        golbatVelocity.addScaledVector(toDesired.normalize(), GOLBAT_ACCEL * dt);
    }
    // Clamp to max speed
    if (golbatVelocity.length() > maxGolbatSpd) golbatVelocity.setLength(maxGolbatSpd);

    golbat.position.addScaledVector(golbatVelocity, dt);

    // Keep Golbat in a sensible altitude band — same ceiling as Charizard
    golbat.position.y = Math.max(2.5, Math.min(18, golbat.position.y));

    // Push Golbat away from obstacles — velocity push + hard position correction
    for (const obs of obstacles) {
        const odx = golbat.position.x - obs.position.x;
        const odz = golbat.position.z - obs.position.z;
        if (odx * odx + odz * odz > GOLBAT_CULL_SQ) continue;
        const { collisionRadius, collisionHeight, isMountain } = obs.userData;
        if (golbat.position.y > collisionHeight) continue;
        const odist = Math.sqrt(odx * odx + odz * odz);
        const effR = isMountain
            ? collisionRadius * (1 - golbat.position.y / collisionHeight)
            : collisionRadius;
        const avoid = effR + 2.0;
        if (odist < avoid && odist > 0.01) {
            const nx = odx / odist;
            const nz = odz / odist;
            // Hard correction — snap Golbat to the surface immediately
            const penetration = avoid - odist;
            golbat.position.x += nx * penetration;
            golbat.position.z += nz * penetration;
            // Cancel inward velocity component and add outward impulse
            const inward = golbatVelocity.x * (-nx) + golbatVelocity.z * (-nz);
            if (inward > 0) {
                golbatVelocity.x += nx * inward;
                golbatVelocity.z += nz * inward;
            }
            golbatVelocity.x += nx * 6;
            golbatVelocity.z += nz * 6;
            golbatVelocity.y += 3;
        }
    }

    golbat.lookAt(charizard.position);

    // Magikarp dangles from Golbat during the chase
    magikarp.position.copy(golbat.position).add(_tmpV5.set(0, -0.4, 0.5));
    magikarp.rotation.z = Math.PI * 0.08 + Math.sin(golbatTimer * 4) * 0.12; // flop

    // ── Sludge bombs ──────────────────────────────────────────────────────────
    const sludgeHit = updateSludge(golbat.position, charizard.position, dt, state.invincible);
    if (sludgeHit) {
        state.hearts = Math.max(0, state.hearts - 0.5);
        updateHeartsHUD();
        if (state.hearts <= 0) {
            state.gameOver = true;
            phase = 'gameover';
            showOverlay('💀 GAME OVER', false);
            return;
        }
        state.invincible      = true;
        state.invincibleTimer = 0;
    }

    // ── Golbat compass ────────────────────────────────────────────────────────
    {
        const ndc = _tmpV6.copy(golbat.position).project(camera);
        const sx = ndc.z < 1 ?  ndc.x : -ndc.x;
        const sy = ndc.z < 1 ?  ndc.y : -ndc.y;
        const angle = Math.atan2(sx, sy); // clockwise from screen-up
        // Rotate the div around its bottom-centre (transform-origin: 50% 120px)
        elCompassRing.style.transform = `translateX(-50%) rotate(${angle}rad)`;
        const onScreen = ndc.z < 1 && Math.abs(ndc.x) < 0.6 && Math.abs(ndc.y) < 0.6;
        elCompassRing.style.display = onScreen ? 'none' : '';
    }

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
    {
        const py = charizard.position.y;
        for (const obs of obstacles) {
            const dx = charizard.position.x - obs.position.x;
            const dz = charizard.position.z - obs.position.z;
            if (dx * dx + dz * dz > CHARIZARD_CULL_SQ) continue;
            const { collisionRadius, collisionHeight, isMountain } = obs.userData;
            if (py > collisionHeight) continue;
            const xzDist = Math.sqrt(dx * dx + dz * dz);
            const effR = isMountain
                ? collisionRadius * (1 - py / collisionHeight)
                : collisionRadius;
            const boundary = effR + 0.5;
            if (xzDist < boundary) {
                // Always push out — even during invincibility frames
                const nx = xzDist > 0.01 ? dx / xzDist : 1;
                const nz = xzDist > 0.01 ? dz / xzDist : 0;
                charizard.position.x = obs.position.x + nx * boundary;
                charizard.position.z = obs.position.z + nz * boundary;

                // Damage only once per hit (not during invincibility)
                if (!state.invincible) {
                    state.hearts--;
                    updateHeartsHUD();
                    if (state.hearts <= 0) {
                        state.gameOver = true;
                        phase = 'gameover';
                        showOverlay('💀 GAME OVER', false);
                        return;
                    }
                    state.invincible      = true;
                    state.invincibleTimer = 0;
                }
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
    const behindOffset    = _tmpV1.set(0, 3, -6).applyQuaternion(charizard.quaternion);
    const lookAheadOffset = _tmpV2.set(0, 1,  2).applyQuaternion(charizard.quaternion);
    camera.position.lerp(_tmpV3.copy(charizard.position).add(behindOffset), 0.1);
    camera.lookAt(_tmpV4.copy(charizard.position).add(lookAheadOffset));

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
        elCompassRing.style.display = 'none';
        const won = updateOutro(dt);
        if (won) {
            phase = 'win';
            showOverlay('🍽️ YOU WIN!', false);
        }
    }

    composer.render();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
Promise.all([loadCharizard(), loadStandingCharizard(), loadGolbat(), loadMagikarp(), loadpikachu(), loadWorldAssets()]).then(() => {
    elLoading.style.display = 'none';
    updateHeartsHUD();
    animate();
});
