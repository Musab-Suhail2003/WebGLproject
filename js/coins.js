import * as THREE from 'three';
import { scene } from './scene.js';

const COIN_COUNT    = 25;
const COIN_RADIUS   = 0.4;
const COLLECT_DIST  = 2.2;
const BOOST_PER_COIN = 20;   // boost fuel added per coin collected

// Glowing gold coin mesh
const coinGeo = new THREE.TorusGeometry(COIN_RADIUS, 0.12, 8, 16);
const coinMat = new THREE.MeshToonMaterial({
    color:    0xFFD700,
    emissive: 0xFFAA00,
});

export const coins = [];

for (let i = 0; i < COIN_COUNT; i++) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.castShadow = false;
    // Scatter in a wide radius around origin, not too close to start
    const angle = (i / COIN_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const dist  = 15 + Math.random() * 50;
    mesh.position.set(
        Math.cos(angle) * dist,
        2 + Math.random() * 5,
        Math.sin(angle) * dist
    );
    scene.add(mesh);
    coins.push(mesh);
}

/**
 * Call every frame.
 * Returns the amount of boost fuel collected this frame (0 or BOOST_PER_COIN).
 */
export function updateCoins(playerPos, dt) {
    let gained = 0;

    coins.forEach(coin => {
        if (!coin.visible) return;

        // Spin
        coin.rotation.y += dt * 2.5;

        // Collect
        if (playerPos.distanceTo(coin.position) < COLLECT_DIST) {
            coin.visible = false;
            gained += BOOST_PER_COIN;

            // Respawn the coin somewhere new after a short delay
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const dist  = 20 + Math.random() * 60;
                coin.position.set(
                    playerPos.x + Math.cos(angle) * dist,
                    2 + Math.random() * 5,
                    playerPos.z + Math.sin(angle) * dist
                );
                coin.visible = true;
            }, 8000);
        }
    });

    return gained;
}
