import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

export interface SkyColors {
  top: string;
  horizon: string;
  bottom: string;
}

/** Gradient sky dome with a soft sun disc. Follows the camera. */
export function createSky(colors: SkyColors, sunDir: Vector3): Mesh {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      top: { value: new Color(colors.top) },
      horizon: { value: new Color(colors.horizon) },
      bottom: { value: new Color(colors.bottom) },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new Color('#fff2d0') },
      stars: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
      uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars;
      float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55))
                           : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.4));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.22);
        if (stars > 0.0 && h > 0.0) {
          float r = h31(floor(d * 420.0));
          col += vec3(0.85, 0.9, 1.0) * step(0.9988, r) * (0.4 + 0.6 * fract(r * 913.0)) * stars * smoothstep(0.0, 0.2, h);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(500, 32, 16), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}
