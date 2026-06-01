import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './scene.js';

// Tweak these independently for each model
const MODEL_SCALE    = 0.5;   // flying animation
const STANDING_SCALE = 0.5;   // standing ground model (charizard.glb)
// If the standing model's origin isn't at its feet, nudge it here
const STANDING_Y_OFFSET = 0;

// Flying model — used during gameplay (hidden until intro ends)
export const charizard = new THREE.Group();
charizard.visible = false;
scene.add(charizard);

// Standing model — used only during the intro cutscene
export const standingCharizard = new THREE.Group();
standingCharizard.visible = false;
scene.add(standingCharizard);

// Tail flame — glows with bloom.
// After load we try to parent it to the tail bone so it follows the animation.
// If no tail bone is found it falls back to a bounding-box estimate.
export const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 2, 2),
    new THREE.MeshToonMaterial({ color: 0xff5500, emissive: 0xff2200 })
);
charizard.add(flame); // may be re-parented inside loadCharizard()

// AnimationMixer — null until the GLB is loaded; tick it in game.js via updateAnimation()
let mixer = null;

export function updateAnimation(dt) {
    if (mixer) mixer.update(dt);
}

// Adjust these to move the flame — x=left/right, y=up/down, z=forward/back
const FLAME_OFFSET = new THREE.Vector3(0, -0.1, -0.3);

// Loads the flying-animation GLB and starts the first animation clip on loop.
// Falls back to a placeholder cube+wings if the file can't be loaded.
export function loadCharizard() {
    return new Promise(resolve => {
        const loader = new GLTFLoader();
        loader.load(
            './models/charizard-flying-animation/source/Charzard Flying.glb',
            gltf => {
                const model = gltf.scene;
                model.scale.setScalar(MODEL_SCALE);
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        const old = child.material;
                        child.material = new THREE.MeshToonMaterial({
                            map:   old.map   ?? null,
                            color: old.color ?? new THREE.Color(0xff8c00),
                        });
                        old.dispose();
                    }
                });
                charizard.add(model);
                flame.position.copy(FLAME_OFFSET);

                if (gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    mixer.clipAction(gltf.animations[0]).play();
                    console.log(`Playing animation: "${gltf.animations[0].name}"`);
                }

                console.log('Charizard flying animation loaded');
                resolve();
            },
            undefined,
            err => {
                console.warn('Flying animation GLB failed to load, using placeholder', err);
                const placeholder = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1.2, 1.8),
                    new THREE.MeshToonMaterial({ color: 0xff8c00 })
                );
                placeholder.castShadow = true;
                charizard.add(placeholder);

                const wingGeo = new THREE.PlaneGeometry(1.5, 0.8);
                const wingMat = new THREE.MeshToonMaterial({ color: 0xff4500, side: THREE.DoubleSide });

                const leftWing = new THREE.Mesh(wingGeo, wingMat);
                leftWing.position.set(-0.9, 0.2, 0);
                leftWing.rotation.y = Math.PI / 2;
                leftWing.rotation.z = -0.3;
                charizard.add(leftWing);

                const rightWing = new THREE.Mesh(wingGeo, wingMat);
                rightWing.position.set(0.9, 0.2, 0);
                rightWing.rotation.y = -Math.PI / 2;
                rightWing.rotation.z = 0.3;
                charizard.add(rightWing);

                resolve();
            }
        );
    });
}

// The model's long axis faces +Z, so forward is +Z in local space
const _fwdScratch = new THREE.Vector3();
export function getCharizardForward() {
    return _fwdScratch.set(0, 0, 1).applyQuaternion(charizard.quaternion);
}

// Loads the static standing model used in the intro cutscene
export function loadStandingCharizard() {
    return new Promise(resolve => {
        const loader = new GLTFLoader();
        loader.load(
            './models/charizard.glb',
            gltf => {
                const model = gltf.scene;
                model.scale.setScalar(STANDING_SCALE);
                model.position.y = STANDING_Y_OFFSET;
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        const old = child.material;
                        child.material = new THREE.MeshToonMaterial({
                            map:   old.map   ?? null,
                            color: old.color ?? new THREE.Color(0xff8c00),
                        });
                        old.dispose();
                    }
                });
                standingCharizard.add(model);
                console.log('Standing Charizard loaded');
                resolve();
            },
            undefined,
            err => {
                console.warn('charizard.glb (standing) failed, using box fallback', err);
                const m = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 2, 1),
                    new THREE.MeshToonMaterial({ color: 0xff8c00 })
                );
                m.position.y = 1;
                standingCharizard.add(m);
                resolve();
            }
        );
    });
}
