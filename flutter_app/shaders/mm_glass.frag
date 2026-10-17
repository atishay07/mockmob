// MockMob Glass (GLASS-1017 section 5.3): one backdrop filter for the navigation layer only.
//
// Used as ImageFilter.compose(outer: ImageFilter.shader(this), inner: ImageFilter.blur(4)) inside
// a BackdropFilter clipped to the surface. Per pixel:
//   1. d = the distance inside the rounded rect, n = its outward normal.
//   2. Rim (d < band): the sample is pulled in along -n by bend * (1 - d / band)^2, so content
//      visibly bends as it crosses the edge.
//   3. Core: 13 bilinear taps (centre and two rings of six) over the pre-blurred input, or none
//      when uCore is 0 (sheets: the inner filter is already their blur).
//      Rim and core are feathered across band * 0.55 to band.
//   4. Saturation lift (uSat).
//   5. Luminosity clamp in linear light, hue kept: Night scales down to uLumMax, Day lifts
//      toward white to uLumMin. This is what keeps labels at 4.5:1 over any content.
// The tint, rims and labels are drawn on top by the Dart painters.
//
// Coordinates. The engine sets uSize (the input texture's size) and uTexture (the input).
// uRect is the surface in the same pixel space. Whether a backdrop filter's input is the whole
// backdrop or only the filtered bounds is engine-defined (acceptance check A4), so the shader
// accepts either: when uSize is within uSlack of the surface's own size the input is local and
// the rect is centred in it. A pixel the rect does not contain gets the clamp only (no bend,
// no core), so a wrong mapping degrades to plain glass instead of garbage.
#include <flutter/runtime_effect.glsl>

uniform vec2 uSize;
uniform vec4 uRect;      // left, top, right, bottom (px)
uniform float uRadius;   // corner radius (px)
uniform float uBand;     // rim band (px)
uniform float uBend;     // bend at the edge (px)
uniform float uCore;     // core blur radius (px)
uniform float uLumMax;   // 1 = off
uniform float uLumMin;   // 0 = off
uniform float uSat;      // saturation lift
uniform float uSlack;    // how far uSize may exceed the rect and still be read as local (px)
uniform float uGrid;     // debug grid spacing (px), 0 = off

uniform sampler2D uTexture;

out vec4 fragColor;

vec4 tap(vec2 px) {
  vec2 uv = clamp(px, vec2(0.5), uSize - vec2(0.5)) / uSize;
#ifdef IMPELLER_TARGET_OPENGLES
  uv.y = 1.0 - uv.y;
#endif
  return texture(uTexture, uv);
}

vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 toSrgb(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }

void main() {
  vec2 frag = FlutterFragCoord().xy;

  // The surface's rect in this pass's pixel space.
  vec4 rect = uRect;
  vec2 own = uRect.zw - uRect.xy;
  vec2 extra = uSize - own;
  if (extra.x >= -1.0 && extra.y >= -1.0 && extra.x <= uSlack && extra.y <= uSlack) {
    rect = vec4(extra * 0.5, extra * 0.5 + own);
  }

  vec2 centre = (rect.xy + rect.zw) * 0.5;
  vec2 half_ = (rect.zw - rect.xy) * 0.5;
  float r = min(uRadius, min(half_.x, half_.y));
  vec2 p = frag - centre;
  vec2 q = abs(p) - half_ + vec2(r);
  float sdf = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
  float d = -sdf; // distance inside the edge

  vec4 base = tap(frag);
  vec3 colour = base.rgb;
  float alpha = base.a;

  if (d >= 0.0) {
    // Outward normal of the rounded rect.
    vec2 s = vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
    vec2 n;
    if (q.x > 0.0 && q.y > 0.0) {
      n = normalize(q) * s;
    } else if (q.x > q.y) {
      n = vec2(s.x, 0.0);
    } else {
      n = vec2(0.0, s.y);
    }

    // Rim: pull the sample inward, strongest at the edge.
    float k = clamp(1.0 - d / max(uBand, 1.0), 0.0, 1.0);
    vec4 rim = tap(frag - n * uBend * k * k);

    // Core: centre plus two rings of six. A sheet passes uCore 0: its inner filter is already
    // the sigma 30 blur, so the core is the input itself (no taps).
    // The loop's condition is the index against a constant only: SkSL (the GLES path) rejects
    // any other loop condition, and impellerc then drops the program for that backend.
    vec4 core = base;
    if (uCore > 0.0) {
      core = base * 0.2;
      float r1 = uCore * 0.5;
      float r2 = uCore;
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0471976; // 60 degrees
        vec2 dir = vec2(cos(a), sin(a));
        vec2 dir2 = vec2(cos(a + 0.5235988), sin(a + 0.5235988)); // offset by 30 degrees
        core += tap(frag + dir * r1) * 0.08;
        core += tap(frag + dir2 * r2) * 0.0533333;
      }
    }

    float w = smoothstep(uBand * 0.55, uBand, d); // 0 in the rim, 1 in the core
    vec4 mixed = mix(rim, core, w);
    colour = mixed.rgb;
    alpha = mixed.a;
  }

  // Work on straight colour.
  if (alpha > 0.0001) colour /= alpha;

  // Saturation.
  float l = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  colour = mix(vec3(l), colour, uSat);

  // Luminosity clamp in linear light; the hue survives.
  vec3 lin = toLinear(colour);
  float lum = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  if (lum > uLumMax) {
    lin *= uLumMax / max(lum, 0.0001);
  }
  if (lum < uLumMin) {
    float lift = (uLumMin - lum) / max(1.0 - lum, 0.0001);
    lin = lin + (vec3(1.0) - lin) * lift;
  }
  colour = toSrgb(lin);

  // Debug grid (acceptance check A4): magenta lines every uGrid px in this pass's space.
  if (uGrid > 0.0) {
    vec2 g = mod(frag, vec2(uGrid));
    if (g.x < 1.5 || g.y < 1.5) {
      colour = vec3(1.0, 0.0, 1.0);
      alpha = 1.0;
    }
  }

  fragColor = vec4(colour * alpha, alpha);
}
