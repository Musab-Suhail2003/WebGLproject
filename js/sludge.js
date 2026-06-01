import * as THREE from 'three';
import { scene } from './scene.js';

const FIRE_INTERVAL = 4.0;
const BOMB_SPEED    = 10;
const HIT_DIST      = 1.5;
const MAX_LIFE      = 10;

const bombs    = [];
let fireTimer  = 4.0; // first shot after 4 s

// Shared geometry and materials — allocated once, reused by every bomb
const blobGeo = new THREE.SphereGeometry(0.55, 12, 12);
const ringGeo = new THREE.TorusGeometry(0.75, 0.12, 8, 24);
const blobMat = new THREE.MeshToonMaterial({ color: 0x7700cc, emissive: 0x550099 });
const ringMat = new THREE.MeshToonMaterial({ color: 0xcc44ff, emissive: 0xaa22ff });

function makeBomb(origin) {
    const group = new THREE.Group();
    group.position.copy(origin);

    // Blob — sphere so it's visible from any angle
    const blob = new THREE.Mesh(blobGeo, blobMat);
    group.add(blob);

    // Outer glow ring (always faces camera via world-Y rotation each frame)
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // Purple point light for aura
    const light = new THREE.PointLight(0xaa00ff, 6, 10);
    group.add(light);

    scene.add(group);
    return group;
}

export function updateSludge(golbatPos, charizardPos, dt, invincible) {
    // ── Fire ─────────────────────────────────────────────────────────────────
    fireTimer += dt;
    if (fireTimer >= FIRE_INTERVAL) {
        fireTimer = 0;
        const dir = new THREE.Vector3()
            .subVectors(charizardPos, golbatPos)
            .normalize();
        const group = makeBomb(golbatPos);
        bombs.push({ group, velocity: dir.clone().multiplyScalar(BOMB_SPEED), life: 0 });
    }

    // ── Update ───────────────────────────────────────────────────────────────
    let hit = false;
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        b.life += dt;
        b.group.position.addScaledVector(b.velocity, dt);
        b.group.rotation.y += dt * 3;

        if (b.life > MAX_LIFE) {
            scene.remove(b.group);
            bombs.splice(i, 1);
            continue;
        }

        if (!invincible && b.group.position.distanceTo(charizardPos) < HIT_DIST) {
            scene.remove(b.group);
            bombs.splice(i, 1);
            hit = true;
        }
    }
    return hit;
}

export function clearSludge() {
    for (const b of bombs) scene.remove(b.group);
    bombs.length = 0;
    fireTimer = 1.5;
}
