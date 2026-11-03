import type { MeshStandardMaterial } from 'three';

/**
 * Adds world-aligned micro voxels to a material: each 1/16 m cell of a surface is
 * nudged lighter or darker in the fragment shader, so big terrain voxels read as
 * finely textured without any extra geometry. It fades out once a cell is smaller
 * than a pixel, which keeps distant ground from shimmering.
 */
export function addGrain(mat: MeshStandardMaterial, amount = 0.09, cell = 0.0625): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;\nvarying vec3 vGrainNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGrainPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvGrainNormal = normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;\nvarying vec3 vGrainNormal;')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          // Step just inside the surface so a face never straddles two cells.
          vec3 grainCell = floor((vGrainPos - vGrainNormal * 0.004) / ${cell.toFixed(4)});
          float grainHash = fract(sin(dot(grainCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float grainFade = 1.0 - smoothstep(${(cell * 0.35).toFixed(4)}, ${(cell * 1.1).toFixed(4)}, length(fwidth(vGrainPos)));
          diffuseColor.rgb *= 1.0 + (grainHash - 0.5) * ${(amount * 2).toFixed(3)} * grainFade;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `grain-${amount}-${cell}`;
}
