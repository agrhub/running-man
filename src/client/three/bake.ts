import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bakes a character's plain-coloured parts into one mesh per moving part.
 *
 * A chibi is built from about twenty small meshes (eyes, hair, sleeves, shoes…),
 * and every one is a draw call. Parts that hang from the same pivot never move
 * apart, so their geometry is merged into one mesh whose colours live in the
 * vertices. That halves the draw calls of a crowd at the start line, which is
 * where slower phones struggled most.
 *
 * Only leaf meshes with an untextured, non-glowing standard material are merged;
 * anything in `keep` (parts the animation moves on their own) is left alone.
 */
export const bakeParts = (
  root: THREE.Object3D,
  keep: ReadonlySet<THREE.Object3D> = new Set()
): void => {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => nodes.push(o));
  const dropped = new Set<THREE.Mesh>();
  for (const node of nodes) {
    const buckets = new Map<
      string,
      { mat: THREE.MeshStandardMaterial; meshes: THREE.Mesh[] }
    >();
    for (const child of node.children) {
      if (
        !(child instanceof THREE.Mesh) ||
        child instanceof THREE.InstancedMesh
      )
        continue;
      if (keep.has(child) || child.children.length > 0 || !child.visible)
        continue;
      const mat = child.material;
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (mat.map || mat.emissive.getHex() !== 0 || mat.vertexColors) continue;
      const key = [
        mat.transparent,
        mat.opacity,
        mat.depthWrite,
        mat.side,
        mat.roughness,
        mat.metalness,
        mat.flatShading,
        child.castShadow,
        child.renderOrder,
      ].join('|');
      const bucket = buckets.get(key) ?? { mat, meshes: [] };
      bucket.meshes.push(child);
      buckets.set(key, bucket);
    }
    for (const { mat, meshes } of buckets.values()) {
      if (meshes.length < 2) continue;
      const parts: THREE.BufferGeometry[] = [];
      for (const m of meshes) {
        m.updateMatrix();
        const src = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', src.getAttribute('position'));
        const normal = src.getAttribute('normal');
        if (normal) g.setAttribute('normal', normal);
        else g.computeVertexNormals();
        g.applyMatrix4(m.matrix);
        const color = (m.material as THREE.MeshStandardMaterial).color;
        const n = g.getAttribute('position').count;
        const colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(g);
        src.dispose();
      }
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!merged) continue;
      const baked = new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: mat.roughness,
          metalness: mat.metalness,
          transparent: mat.transparent,
          opacity: mat.opacity,
          depthWrite: mat.depthWrite,
          side: mat.side,
          flatShading: mat.flatShading,
        })
      );
      baked.castShadow = meshes[0]!.castShadow;
      baked.receiveShadow = meshes[0]!.receiveShadow;
      baked.renderOrder = meshes[0]!.renderOrder;
      for (const m of meshes) {
        node.remove(m);
        dropped.add(m);
      }
      node.add(baked);
    }
  }
  // Free what only the merged-away parts used (shared geometry and materials stay).
  const live = new Set<unknown>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      live.add(o.geometry);
      live.add(o.material);
    }
  });
  for (const m of dropped) {
    if (!live.has(m.geometry)) {
      live.add(m.geometry);
      m.geometry.dispose();
    }
    const mat = m.material as THREE.Material;
    if (!live.has(mat)) {
      live.add(mat);
      mat.dispose();
    }
  }
};
