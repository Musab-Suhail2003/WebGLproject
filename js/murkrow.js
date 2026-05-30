import * as THREE from 'three';
import { scene } from './scene.js';

export const murkrow = new THREE.Group();

const crowBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshToonMaterial({ color: 0x1E90FF })
);
crowBody.castShadow = true;
murkrow.add(crowBody);

// The stolen lighter
const lighter = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.4),
    new THREE.MeshToonMaterial({ color: 0xFFD700 })
);
lighter.position.set(0.3, 0.3, 0.6);
murkrow.add(lighter);

murkrow.position.set(0, 4, 10);
scene.add(murkrow);
