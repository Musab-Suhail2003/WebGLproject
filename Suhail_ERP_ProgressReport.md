# Charizard's Chase: A WebGL Mini-Game
**CSE352 Computer Graphics — Spring 2026 — Progress Report**

**Name:** Musab Suhail
**ERP:** *(fill in your ERP number)*
**Project Direction:** Mini Game

---

## Summary of Progress

The core game loop is fully functional. The player controls Charizard through a 3D
obstacle field, chasing Golbat who weaves dynamically ahead using sinusoidal motion.
The codebase has been refactored from a single monolithic HTML file into six ES modules
(`scene.js`, `world.js`, `charizard.js`, `golbat.js`, `controls.js`, `game.js`) to
improve maintainability. Charizard now uses a rigged GLB model with a live flying
animation driven by `THREE.AnimationMixer`, and Golbat is similarly loaded from a
GLB asset. All three advanced techniques — toon shading, bloom, and shadow mapping —
are active in the current build.

---

## Baseline Techniques Status

| Technique | Status | Notes |
|---|---|---|
| Phong Lighting Model | **Completed** | `DirectionalLight` (sun) + `AmbientLight` + `PointLight` (fire glow) active in `scene.js`. Three.js computes per-fragment Phong internally for all materials. |
| Texture Mapping | **In Progress** | Grass diffuse texture (`grass_diff_1k.jpg`) acquired from Polyhaven. Asset is on disk; application to the ground `PlaneGeometry` is pending. |
| Multiple Light Types | **Completed** | Three distinct light types used: `DirectionalLight` for sun/shadows, `AmbientLight` for fill, `PointLight` attached to Charizard's tail flame. |
| GLSL Shader Setup | **In Progress** | Three.js built-in shader programs handle Phong + toon + bloom. Custom GLSL for at least one pass (e.g. outline or toon ramp) is planned for the final submission. |
| Transformations & Normals | **Completed** | Full YXZ Euler rotation for flight (yaw/pitch/roll), shadow normals computed correctly via `PCFSoftShadowMap`. Model and normal matrices applied to all scene objects. |
| Camera System | **Completed** | Third-person chase camera lerps to an offset behind Charizard's orientation quaternion each frame; look-at target is ahead of the player. |

---

## Advanced Techniques Status

### Toon Shading — 3/5 | **Completed**

`MeshToonMaterial` is applied to all scene geometry (ground, obstacles, placeholder
characters). The material produces hard lighting steps characteristic of cel shading.
All loaded GLB materials are post-processed to `roughness = 1`, `metalness = 0`,
`envMapIntensity = 0` to maintain the flat, matte aesthetic consistently across
procedural and imported geometry.

*Challenge:* The imported Charizard GLB defaulted to a physically-based material that
appeared glossy and inconsistent with the toon look. This was resolved by traversing
all `isMesh` children after loading and overwriting the PBR parameters.

### Bloom — 4/5 | **Completed**

Post-processing bloom is implemented via Three.js `EffectComposer` with
`UnrealBloomPass` (strength 0.8, radius 0.4, threshold 0.85). The tail flame mesh
uses an emissive material (`emissive: 0xff2200`) so it glows visibly. The fire
`PointLight` is repositioned each frame to stay just ahead of Charizard, casting a
dynamic orange glow onto nearby geometry.

*Challenge:* Bloom interacted poorly with toon materials at high strength values,
washing out the hard shading steps. Lowering bloom strength to 0.8 and raising the
threshold balanced the glow effect without degrading toon contrast.

### Shadow Mapping — 4/5 | **Completed**

`renderer.shadowMap.enabled = true` with `PCFSoftShadowMap` is active. The
`DirectionalLight` renders a 1024×1024 shadow map from a fixed sun position; its
shadow camera frustum is manually sized (±40 units) to cover the visible play area.
Charizard, Golbat, and all obstacle meshes have `castShadow = true`; the ground has
`receiveShadow = true`.

*Challenge:* Shadow acne appeared on the ground at shallow sun angles. This was
mitigated by Three.js's built-in bias in `PCFSoftShadowMap`; further manual bias
tuning (`shadow.bias`) may be needed for the final submission.

---

## Screenshots / Renders

*(Take 2–4 in-browser screenshots before submitting and insert them here with captions.)*

Suggested shots:
1. **Overhead view** — shows ground plane, obstacles, and shadow map coverage.
2. **Chase view** — Charizard flying toward Golbat with bloom glow visible on the tail flame.
3. **Close-up on Charizard** — demonstrates toon shading on the GLB model.
4. **Collision/end screen** — shows the crash message or win condition text overlay.

---

## Challenges Encountered

1. **Forward vector orientation:** Charizard initially flew sideways because the +Z
   local axis was not aligned with the model's facing direction. This was fixed by
   establishing +Z as the canonical forward vector and deriving movement from
   `quaternion.applyVector(0,0,1)`.

2. **GLB skeleton access:** Attaching the tail flame to the animated tail bone proved
   difficult because the GLB's bones are stored inside `SkinnedMesh.skeleton.bones`
   rather than as named `Object3D` scene-graph nodes, making standard `traverse +
   isBone` checks ineffective. A positional offset constant is used as an interim
   solution; bone attachment is planned once the exact node name is confirmed.

3. **Toon + PBR material conflict:** Loaded GLB models use PBR materials by default,
   which clashed with the toon aesthetic. Post-load material patching (roughness,
   metalness, envMapIntensity) resolves this but means original artist materials are
   overridden, which may need revisiting for the Golbat model specifically.

4. **WebGL mipmap warnings:** Non-power-of-two texture dimensions in loaded GLBs
   trigger `generateMipmap: lazy initialization` warnings. These do not affect
   rendering but will be addressed by ensuring textures are power-of-two before the
   final submission.

---

## Remaining Work

*(In priority order)*

- [ ] Apply `grass_diff_1k.jpg` texture to the ground plane with UV repeat tiling
- [ ] Load `kiara_1_dawn_1k.hdr` HDRI and set it as the scene environment/background
- [ ] Attach tail flame to the Charizard model's tail bone (currently positional offset)
- [ ] Replace procedural rock/tree geometry with the `rock.glb` and `tree.glb` assets
- [ ] Write at least one custom GLSL shader pass (toon outline or custom ramp shader)
- [ ] Add Pikachu easter-egg model as a hidden collectible (proposed in original plan)
- [ ] Fine-tune shadow bias to eliminate any remaining acne at runtime
- [ ] Performance pass: LOD or frustum culling for distant obstacles

---

## Scope Adjustments

| Change | Justification |
|---|---|
| **Murkrow → Golbat** | A suitable low-poly Murkrow GLB with proper rigging was not available. Golbat serves the same narrative role (thief/chase target) and a quality rigged GLB was sourced. |
| **Codebase refactor** | The original single-file `chase.html` was split into six ES modules for maintainability. No techniques were added or removed; this is an engineering change only. |

**Advanced technique effort scores remain unchanged:** Toon Shading 3/5 + Bloom 4/5 +
Shadow Mapping 4/5 = **11/10** ✓ (satisfies ≥ 6/10 and at least one technique ≥ 3/5).

---

## External Assets Update

| Asset | Source | Credit |
|---|---|---|
| Charizard flying animation GLB | Sketchfab (free download) | *(add author name)* |
| `golbat.glb` | Sketchfab (free download) | *(add author name)* |
| `grass_diff_1k.jpg` | [Polyhaven](https://polyhaven.com/textures/grass) | Polyhaven (CC0) |
| `kiara_1_dawn_1k.hdr` | [Polyhaven](https://polyhaven.com/hdris) | Polyhaven (CC0) |
| `tree.glb`, `rock.glb`, `cloud.glb` | Quaternius Ultimate Platformer Pack (itch.io) | Quaternius (CC0) |

*All assets are CC0 or CC-BY licensed and will be fully credited in the final submission.*

---

*Filename when exporting to PDF:* `Suhail_ERP_ProgressReport.pdf`
