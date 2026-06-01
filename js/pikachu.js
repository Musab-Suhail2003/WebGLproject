import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './scene.js';

// Standing Pikachu
export const pikachu = new THREE.Group();
pikachu.visible = false;
scene.add(pikachu);

// Riding Pikachu
export const pikachuRiding = new THREE.Group();
pikachuRiding.visible = false;
scene.add(pikachuRiding);

// Convert to MeshToonMaterial, preserving diffuse map and color.
// Pass a tint color to multiply on top (MeshToonMaterial multiplies color × map).
function patchMaterials(root, tint = null) {
    root.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const old = child.material;
        child.material = new THREE.MeshToonMaterial({
            map:   old.map   ?? null,
            color: tint ?? old.color ?? new THREE.Color(0xffcc00),
        });
        old.dispose();
    });
}

// Keep original GLB colors — just strip PBR gloss
function stripGloss(root) {
    root.traverse(child => {
        if (!child.isMesh || !child.material) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.material.roughness       = 1.0;
        child.material.metalness       = 0.0;
        child.material.envMapIntensity = 0;
    });
}

export function loadpikachu() {
    const loader = new GLTFLoader();

    const loadStanding = new Promise(resolve => {
        loader.load('./models/pikachu.glb', gltf => {
            const model = gltf.scene;
            model.scale.setScalar(0.5);
            // Rotate 90° on X to stand upright (model is lying flat)
            model.rotation.x = Math.PI / 2;
            patchMaterials(model);
            pikachu.add(model);
            resolve();
        }, undefined, err => {
            console.warn('pikachu.glb failed', err);
            pikachu.add(new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.5, 0.3),
                new THREE.MeshToonMaterial({ color: 0xffcc00 })
            ));
            resolve();
        });
    });

    const loadRiding = new Promise(resolve => {
        loader.load('./models/pikachu-flying-on-charizard.glb', gltf => {
            const model = gltf.scene;
            model.scale.setScalar(0.005);
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            pikachuRiding.add(model);
            resolve();
        }, undefined, err => {
            console.warn('pikachu-flying-on-charizard.glb failed', err);
            pikachuRiding.add(new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.5, 0.3),
                new THREE.MeshToonMaterial({ color: 0xffcc00 })
            ));
            resolve();
        });
    });

    return Promise.all([loadStanding, loadRiding]);
}
