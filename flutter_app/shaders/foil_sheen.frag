// Foil sheen (MOB-BUILD-SPEC-V3 5.6 M7 and 5.7): one warm lamp band sweeping across the first-place
// plinth (and later the foil finish). Drawn as a paint shader over the plinth's rect, premultiplied,
// so the paper under it stays paper and only a lamp-lit band crosses it. Light only: no hue of its
// own beyond the lamp rim F2B865 and a warm white core. The Lite tier and reduced motion never load
// it (a gradient mask stands in, or nothing).
//
// Uniform order (FoilSheenProgram.apply writes them in this order):
//   uSize     the rect's size in px
//   uProgress 0 = the band waits left of the plinth, 1 = it has left on the right
//   uStrength 0..1 overall alpha (fades the band in and out at the ends of the sweep)
#include <flutter/runtime_effect.glsl>

uniform vec2 uSize;
uniform float uProgress;
uniform float uStrength;

out vec4 fragColor;

void main() {
  vec2 p = FlutterFragCoord().xy / uSize;
  // A diagonal coordinate: the band leans 20 degrees, like light across a folded sheet.
  float d = p.x + p.y * 0.36;
  float centre = -0.45 + uProgress * 1.9;
  float x = (d - centre) / 0.16;
  // A soft core with a wider, fainter halo.
  float core = exp(-x * x * 2.2);
  float halo = exp(-x * x * 0.35) * 0.35;
  // Foil grain: fine crossed ripples so the band reads as metal leaf, not a gradient.
  float grain = 0.86 + 0.14 * sin(p.x * 140.0 + p.y * 37.0) * sin(p.y * 90.0 - p.x * 23.0);
  float a = clamp((core + halo) * grain * uStrength, 0.0, 1.0) * 0.78;
  vec3 rim = vec3(0.949, 0.722, 0.396);   // F2B865
  vec3 white = vec3(1.0, 0.941, 0.784);   // FFF0C8
  vec3 col = mix(rim, white, core);
  fragColor = vec4(col * a, a);
}
