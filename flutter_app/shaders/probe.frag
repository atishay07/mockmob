#include <flutter/runtime_effect.glsl>
uniform vec2 uSize;
uniform sampler2D uTexture;
out vec4 fragColor;
void main() {
  vec2 f = FlutterFragCoord().xy;
  vec2 uv = f / uSize;
#ifdef IMPELLER_TARGET_OPENGLES
  uv.y = 1.0 - uv.y;
#endif
  vec4 s = texture(uTexture, uv);
  // r,g: frag coord / 1024; b: uSize.x / 1024; a: 1. The sample's red goes to... nothing (kept).
  fragColor = vec4(f.x / 1024.0, f.y / 1024.0, uSize.x / 1024.0, 1.0);
}
