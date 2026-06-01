import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './scene.js';

// ── Tuning ────────────────────────────────────────────────────────────────────
const OBSTACLE_COUNT = 130;
const RECYCLE_DIST   = 80;
const SPAWN_NEAR     = 20;
const SPAWN_FAR      = 55;
const SPREAD         = 50;
const GROUND_HALF    = 300;
const CLOUD_COUNT    = 20;
const ROCK_SCALE     = 1.0;   // tweak if rock.glb is wrong size
const CLOUD_SCALE    = 1.0;   // tweak if cloud.glb is wrong size

// ── Infinite ground ───────────────────────────────────────────────────────────
const GRASS_REPEAT = 80;
const grassTex = new THREE.TextureLoader().load('./textures/grass_diff_1k.jpg');
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(GRASS_REPEAT, GRASS_REPEAT);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2),
    new THREE.MeshToonMaterial({ map: grassTex, color: 0x7ecb52 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

export function updateGround(playerPos) {
    ground.position.x = playerPos.x;
    ground.position.z = playerPos.z;
    // Counter-offset the texture so it stays anchored to world space
    grassTex.offset.x =  (playerPos.x * GRASS_REPEAT) / (GROUND_HALF * 2);
    grassTex.offset.y = -(playerPos.z * GRASS_REPEAT) / (GROUND_HALF * 2);
}

// ── Procedural geometry (fallbacks) ──────────────────────────────────────────
const geo = {
    treeTrunk: new THREE.CylinderGeometry(0.25, 0.35, 1, 7),
    treeTop:   new THREE.ConeGeometry(1.2, 3, 7),
    boulder:   new THREE.DodecahedronGeometry(1.4, 0),
    mountain:  new THREE.ConeGeometry(1, 1, 8),
};
const mat = {
    trunk:    new THREE.MeshToonMaterial({ color: 0x5C3317 }),
    treeTop:  new THREE.MeshToonMaterial({ color: 0x2d6a2d }),
    boulder:  new THREE.MeshToonMaterial({ color: 0x7a6652 }),
    mountain: new THREE.MeshToonMaterial({ color: 0x8a7a6a }),
    snowcap:  new THREE.MeshToonMaterial({ color: 0xf0eeee }),
};

// ── Obstacle factories ────────────────────────────────────────────────────────
function makeTree() {
    const g = new THREE.Group();
    const h = 2 + Math.random() * 2;
    const trunk = new THREE.Mesh(geo.treeTrunk, mat.trunk);
    trunk.scale.y = h;
    trunk.position.y = h * 0.5;
    g.add(trunk);
    const top = new THREE.Mesh(geo.treeTop, mat.treeTop);
    top.position.y = h + 1.2;
    g.add(top);
    g.userData.type            = 'tree';
    g.userData.collisionRadius = 0.8;
    g.userData.collisionHeight = h + 3;
    g.userData.trunkHeight     = h;   // needed to position GLB foliage
    g.userData.proceduralTop   = top; // swapped out when tree.glb loads
    return g;
}

function makeBoulder() {
    const g     = new THREE.Group();
    const scale = 0.8 + Math.random() * 1.4;
    const mesh  = new THREE.Mesh(geo.boulder, mat.boulder);
    mesh.scale.set(scale, scale * 0.7, scale);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.position.y = scale * 0.7 * 0.5;
    g.add(mesh);
    g.userData.type            = 'boulder';
    g.userData.boulderScale    = scale;       // kept so GLB loader can match size
    g.userData.proceduralMesh  = mesh;        // reference so GLB loader can remove it
    g.userData.collisionRadius = scale * 0.75;
    g.userData.collisionHeight = scale * 0.7;
    return g;
}

function makeMountain() {
    const g      = new THREE.Group();
    const radius = 4 + Math.random() * 6;
    const height = 8 + Math.random() * 10;
    const body   = new THREE.Mesh(geo.mountain, mat.mountain);
    body.scale.set(radius, height, radius);
    body.position.y = height * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    if (height > 12) {
        const capH = height * 0.25;
        const capR = radius * 0.28;
        const cap  = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 8), mat.snowcap);
        cap.scale.set(capR, capH, capR);
        cap.position.y = height - capH * 0.3;
        g.add(cap);
    }
    g.userData.type            = 'mountain';
    g.userData.collisionRadius = radius;
    g.userData.collisionHeight = height;
    g.userData.isMountain      = true;
    return g;
}

// ── Obstacle pool (created immediately with procedural meshes) ────────────────
export const obstacles = [];

for (let i = 0; i < OBSTACLE_COUNT; i++) {
    const r   = Math.random();
    const obs = r < 0.35 ? makeTree() : r < 0.65 ? makeBoulder() : makeMountain();
    const angle = Math.random() * Math.PI * 2;
    const dist  = 20 + Math.random() * 120;
    obs.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    scene.add(obs);
    obstacles.push(obs);
}

// ── Cloud pool (passthrough — not in obstacles) ───────────────────────────────
export const clouds = [];

function makeProceduralCloud() {
    const g   = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
    [
        { x: 0,    y: 0,    z: 0,    s: 1.0 },
        { x: 1.2,  y: -0.2, z: 0.2,  s: 0.7 },
        { x: -1.0, y: -0.1, z: -0.1, s: 0.75 },
        { x: 0.4,  y: 0.4,  z: 0.3,  s: 0.55 },
    ].forEach(({ x, y, z, s }) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 7), mat);
        puff.position.set(x, y, z);
        g.add(puff);
    });
    return g;
}

function spawnCloud(i, playerPos = new THREE.Vector3()) {
    const angle = (i / CLOUD_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const dist  = 20 + Math.random() * 80;
    return {
        x: playerPos.x + Math.cos(angle) * dist,
        y: 6 + Math.random() * 6,
        z: playerPos.z + Math.sin(angle) * dist,
    };
}

// ── Async asset loader — upgrades procedural meshes with GLBs ─────────────────
export function loadWorldAssets() {
    const loader = new GLTFLoader();

    const loadRock = new Promise(resolve => {
        loader.load('./models/rock.glb', gltf => {
            const template = gltf.scene;
            template.traverse(child => {
                if (child.isMesh) {
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.roughness = 1;
                        child.material.metalness = 0;
                        child.material.envMapIntensity = 0;
                    }
                }
            });

            // Replace each boulder's procedural mesh with a GLB clone
            obstacles.forEach(obs => {
                if (obs.userData.type !== 'boulder') return;
                if (obs.userData.proceduralMesh) obs.remove(obs.userData.proceduralMesh);
                const clone = template.clone();
                clone.scale.setScalar(ROCK_SCALE * obs.userData.boulderScale);
                obs.add(clone);
            });

            resolve();
        }, undefined, err => {
            console.warn('rock.glb failed, keeping procedural boulders', err);
            resolve();
        });
    });

    const loadCloud = new Promise(resolve => {
        loader.load('./models/cloud.glb', gltf => {
            const template = gltf.scene;
            template.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.roughness = 1;
                    child.material.metalness = 0;
                    child.material.envMapIntensity = 0;
                }
            });

            for (let i = 0; i < CLOUD_COUNT; i++) {
                const g     = new THREE.Group();
                const model = template.clone();
                model.scale.setScalar(CLOUD_SCALE * (0.5 + Math.random()));
                model.rotation.y = Math.random() * Math.PI * 2;
                g.add(model);
                const { x, y, z } = spawnCloud(i);
                g.position.set(x, y, z);
                g.userData.driftDir   = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                g.userData.driftSpeed = 0.4 + Math.random() * 0.8;
                scene.add(g);
                clouds.push(g);
            }

            resolve();
        }, undefined, err => {
            console.warn('cloud.glb failed, using procedural clouds', err);
            for (let i = 0; i < CLOUD_COUNT; i++) {
                const g = makeProceduralCloud();
                const { x, y, z } = spawnCloud(i);
                g.position.set(x, y, z);
                g.userData.driftDir   = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                g.userData.driftSpeed = 0.4 + Math.random() * 0.8;
                scene.add(g);
                clouds.push(g);
            }
            resolve();
        });
    });

    const loadTree = new Promise(resolve => {
        loader.load('./models/tree.glb', gltf => {
            const template = gltf.scene;
            template.traverse(child => {
                if (child.isMesh) {
                    child.receiveShadow = true;
                    const old = child.material;
                    child.material = new THREE.MeshToonMaterial({
                        map:   old.map   ?? null,
                        color: old.color ?? new THREE.Color(0x2d6a2d),
                    });
                    old.dispose();
                }
            });

            obstacles.forEach(obs => {
                if (obs.userData.type !== 'tree') return;
                // Remove procedural cone top
                if (obs.userData.proceduralTop) {
                    obs.remove(obs.userData.proceduralTop);
                    obs.userData.proceduralTop = null;
                }
                // Place GLB foliage at the top of the trunk
                const clone = template.clone();
                const h = obs.userData.trunkHeight;
                clone.position.y = h;
                clone.scale.setScalar(3.0 + Math.random() * 0.4);
                clone.rotation.y = Math.random() * Math.PI * 2;
                obs.add(clone);
            });

            resolve();
        }, undefined, err => {
            console.warn('tree.glb failed, keeping procedural tops', err);
            resolve();
        });
    });

    return Promise.all([loadRock, loadCloud, loadTree]);
}

// ── Per-frame updates ─────────────────────────────────────────────────────────
const RECYCLE_DIST_SQ   = RECYCLE_DIST * RECYCLE_DIST;
const CLOUD_RECYCLE_SQ  = 120 * 120;
const _perpScratch      = new THREE.Vector3();
const _newPosScratch    = new THREE.Vector3();

export function updateClouds(playerPos, dt) {
    clouds.forEach((cloud, i) => {
        cloud.position.addScaledVector(cloud.userData.driftDir, cloud.userData.driftSpeed * dt);
        if (playerPos.distanceToSquared(cloud.position) > CLOUD_RECYCLE_SQ) {
            const { x, y, z } = spawnCloud(i, playerPos);
            cloud.position.set(x, y, z);
        }
    });
}

export function recycleObstacles(playerPos, forward) {
    _perpScratch.set(-forward.z, 0, forward.x).normalize();
    obstacles.forEach(obs => {
        const dx = obs.position.x - playerPos.x;
        const dz = obs.position.z - playerPos.z;
        if (dx * dx + dz * dz > RECYCLE_DIST_SQ) {
            const ahead = SPAWN_NEAR + Math.random() * (SPAWN_FAR - SPAWN_NEAR);
            const side  = (Math.random() - 0.5) * SPREAD * 2;
            _newPosScratch.copy(playerPos)
                .addScaledVector(forward, ahead)
                .addScaledVector(_perpScratch, side);
            _newPosScratch.y = 0;
            obs.position.copy(_newPosScratch);
        }
    });
}
