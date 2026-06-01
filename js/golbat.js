import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './scene.js';

const MODEL_SCALE = 0.002;

// ── Groups ────────────────────────────────────────────────────────────────────
// golbat       → world-space position used by AI / collision
// golbat.inner → visual wrapper that bobs / banks without affecting logic position
export const golbat = new THREE.Group();
golbat.position.set(0, 4, 10);
scene.add(golbat);

// Velocity used by the AI in game.js (stored here so golbat.js can read it for visuals)
export const golbatVelocity = new THREE.Vector3();

// ── Loader ────────────────────────────────────────────────────────────────────
export function loadGolbat() {
    return new Promise(resolve => {
        const loader = new GLTFLoader();
        loader.load(
            './models/golbat.glb',
            gltf => {
                const model = gltf.scene;
                model.scale.setScalar(MODEL_SCALE);
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.roughness = 1.0;
                            child.material.metalness = 0.0;
                            child.material.envMapIntensity = 0;
                        }
                    }
                });

                // Wrap model in an inner group for visual-only transforms
                const inner = new THREE.Group();
                inner.add(model);
                golbat.add(inner);
                golbat.userData.inner = inner;

                // Play skeletal animation if one exists
                if (gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(model);
                    mixer.clipAction(gltf.animations[0]).play();
                    golbat.userData.mixer = mixer;
                } else {
                    // No skeletal anim — we'll drive wing-like meshes procedurally
                    const wings = [];
                    model.traverse(obj => {
                        if (obj.isMesh && /wing|ear|arm/i.test(obj.name)) wings.push(obj);
                    });
                    golbat.userData.wings = wings;
                }
                resolve();
            },
            undefined,
            err => {
                console.warn('golbat.glb failed, using placeholder', err);
                const body = new THREE.Mesh(
                    new THREE.SphereGeometry(0.6, 16, 16),
                    new THREE.MeshToonMaterial({ color: 0x6A0DAD })
                );
                body.castShadow = true;
                const inner = new THREE.Group();
                inner.add(body);
                golbat.add(inner);
                golbat.userData.inner = inner;
                resolve();
            }
        );
    });
}

// ── Per-frame animation ───────────────────────────────────────────────────────
let wingTime = 0;

export function updateGolbat(dt) {
    // Tick skeletal mixer if present
    if (golbat.userData.mixer) golbat.userData.mixer.update(dt);

    wingTime += dt;

    const inner = golbat.userData.inner;
    if (!inner) return;

    // Bob up and down — gives life even with no skeletal anim
    inner.position.y = Math.sin(wingTime * 4.5) * 0.12;

    // Derive lateral (X) and forward (Z) velocity components in world space
    const lat     = golbatVelocity.x;
    const fwd     = golbatVelocity.z;
    const spd     = golbatVelocity.length();

    // Bank (roll) into turns
    inner.rotation.z = THREE.MathUtils.lerp(inner.rotation.z, -lat * 0.08, 0.12);
    // Pitch nose-down when accelerating forward
    inner.rotation.x = THREE.MathUtils.lerp(inner.rotation.x, fwd * 0.04, 0.1);

    // Procedural wing flap for meshes found by name
    const wings = golbat.userData.wings ?? [];
    const flapAngle = Math.sin(wingTime * 8) * 0.4;
    wings.forEach((w, i) => {
        w.rotation.z = i % 2 === 0 ? flapAngle : -flapAngle;
    });
}
