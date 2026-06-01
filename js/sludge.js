import * as THREE from 'three';
import { scene } from './scene.js';

const FIRE_INTERVAL = 4.0;
const BOMB_SPEED    = 10;
const HIT_DIST_SQ   = 1.5 * 1.5;
const MAX_LIFE      = 10;
const POOL_SIZE     = 4; // max bombs in flight at once

// Shared geometry and materials — allocated once, reused by every bomb
const blobGeo = new THREE.SphereGeometry(0.55, 12, 12);
const ringGeo = new THREE.TorusGeometry(0.75, 0.12, 8, 24);
const blobMat = new THREE.MeshToonMaterial({ color: 0x7700cc, emissive: 0x550099 });
const ringMat = new THREE.MeshToonMaterial({ color: 0xcc44ff, emissive: 0xaa22ff });

const _dirScratch = new THREE.Vector3();

// Pre-allocate a fixed pool — no allocations during gameplay
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(blobGeo, blobMat));
    group.add(new THREE.Mesh(ringGeo, ringMat));
    group.add(new THREE.PointLight(0xaa00ff, 6, 10));
    group.visible = false;
    scene.add(group);
    pool.push({ group, velocity: new THREE.Vector3(), life: 0, active: false });
}

let fireTimer = 4.0; // first shot after 4 s
const activeBombs = [];

export function updateSludge(golbatPos, charizardPos, dt, invincible) {
    // ── Fire ─────────────────────────────────────────────────────────────────
    fireTimer += dt;
    if (fireTimer >= FIRE_INTERVAL) {
        fireTimer = 0;
        const slot = pool.find(b => !b.active);
        if (slot) {
            _dirScratch.subVectors(charizardPos, golbatPos).normalize();
            slot.velocity.copy(_dirScratch).multiplyScalar(BOMB_SPEED);
            slot.life = 0;
            slot.active = true;
            slot.group.position.copy(golbatPos);
            slot.group.rotation.set(0, 0, 0);
            slot.group.visible = true;
            activeBombs.push(slot);
        }
    }

    // ── Update ───────────────────────────────────────────────────────────────
    let hit = false;
    for (let i = activeBombs.length - 1; i >= 0; i--) {
        const b = activeBombs[i];
        b.life += dt;
        b.group.position.addScaledVector(b.velocity, dt);
        b.group.rotation.y += dt * 3;

        const expired = b.life > MAX_LIFE;
        const struck  = !invincible && b.group.position.distanceToSquared(charizardPos) < HIT_DIST_SQ;

        if (expired || struck) {
            b.active = false;
            b.group.visible = false;
            activeBombs.splice(i, 1);
            if (struck) hit = true;
        }
    }
    return hit;
}

export function clearSludge() {
    for (const b of pool) {
        b.active = false;
        b.group.visible = false;
    }
    activeBombs.length = 0;
    fireTimer = 1.5;
}
