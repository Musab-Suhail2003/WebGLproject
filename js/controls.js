export const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true;  e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; e.preventDefault(); });

export const state = {
    yaw:   0,
    pitch: 0,
    roll:  0,
    speed:         5.0,
    maxSpeed:     20,
    minSpeed:      2,
    rotationSpeed: 2.5,
    // ── Boost ──────────────────────────────────────────────────────────────────
    boost:         0,       // 0–100 fuel tank
    boostActive:   false,
    BOOST_MAX:     100,
    BOOST_DRAIN:   22,      // units/s while active
    BOOST_SPEED:   32,      // max speed during boost
    // ── Hearts / invincibility ────────────────────────────────────────────────
    hearts:          3,
    maxHearts:       3,
    invincible:      false,
    invincibleTimer: 0,
    INVINCIBLE_DURATION: 1.8,   // seconds of invincibility after a hit
    // ── Game flow ─────────────────────────────────────────────────────────────
    gameOver:          false,
    retrievedLighter:  false,
};
