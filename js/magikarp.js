import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './scene.js';

const MAGIKARP_SCALE = 0.1; // tweak if too big/small

export const magikarp = new THREE.Group();
magikarp.visible = false;
scene.add(magikarp);

export function loadMagikarp() {
    return new Promise(resolve => {
        new GLTFLoader().load(
            './models/magikarp.glb',
            gltf => {
                const model = gltf.scene;
                model.scale.setScalar(MAGIKARP_SCALE);
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
                magikarp.add(model);
                console.log('magikarp.glb loaded');
                resolve();
            },
            undefined,
            err => {
                console.warn('magikarp.glb failed, using fallback', err);
                // Fallback: orange fish-shaped mesh
                const body = new THREE.Mesh(
                    new THREE.SphereGeometry(0.4, 8, 8),
                    new THREE.MeshToonMaterial({ color: 0xff6600 })
                );
                body.scale.set(1.4, 0.8, 0.8);
                magikarp.add(body);
                resolve();
            }
        );
    });
}
