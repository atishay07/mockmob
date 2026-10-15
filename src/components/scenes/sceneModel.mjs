// The painted scenes' rules, shared by SceneImage, SceneLife and SceneVignette and by their test. Plain
// functions over the anchors file (data/scene-anchors.json, the same bytes as the app's
// shared/scene-anchors.json, written by flutter_app/tool/build_scenes.py), so the website draws Mobi,
// the lamp and the motes where the app does.
//
// The files: public/art/scenes/<base>-<width>.v2.{avif,webp}, built by tools/build-scene-files.mjs from
// the app's full-size masters. Rooms and bands are 1536 x 1024 (3:2) at 768, 1280 and 1536 px wide; the
// two tall onboarding rooms are 1080 and 1296 px wide (their natives are 1122 and 1024 px, so nothing
// larger is made).

export const SCENE_VERSION = 'v2';
export const SCENE_DIR = '/art/scenes';
export const WIDE_WIDTHS = [768, 1280, 1536];
export const TALL_WIDTHS = [1080, 1296];

/** The app's StateScene values, in its order. */
export const STATE_SCENES = ['allClear', 'offline', 'nothingYet', 'saved', 'noResults', 'unreachable'];

/**
 * The rooms an empty state may name itself (StateScene.forEmpty). Offline and unreachable belong to
 * the offline and error kinds. allClear is only for "everything marked, nothing to repair", never for
 * "nothing yet".
 */
export const EMPTY_SCENES = ['allClear', 'nothingYet', 'saved', 'noResults'];

const STEM = { allClear: 'allclear', offline: 'offline', nothingYet: 'nothing', saved: 'saved', noResults: 'noresults', unreachable: 'unreachable' };

/** The app's lamp (MmColors.lamp, about 2700 K): environment light only. */
export const LAMP_RGB = '242, 169, 59';

/** The tallest a quiet-state room is drawn, as in the app's StateView: 248 px, 150 px when compact. */
export const VIGNETTE_MAX_HEIGHT = 248;
export const VIGNETTE_COMPACT_HEIGHT = 150;

/**
 * The file set for a scene. `kind` is a STATE_SCENES value, 'milestone', 'welcome' or 'planSeal';
 * `night` picks the Night painting (the tall rooms exist only at Night). Null for anything else.
 */
export function sceneArt(kind, { night = true } = {}) {
  const theme = night ? 'night' : 'day';
  if (STEM[kind]) return { kind, base: `scene-empty-${STEM[kind]}-${theme}`, width: 1536, height: 1024, widths: WIDE_WIDTHS };
  if (kind === 'milestone') return { kind, base: `scene-milestone-check-${theme}`, width: 1536, height: 1024, widths: WIDE_WIDTHS };
  if (kind === 'welcome') return { kind, base: 'scene-welcome-hero-night', width: 1296, height: 1620, widths: TALL_WIDTHS };
  if (kind === 'planSeal') return { kind, base: 'scene-plan-seal-night', width: 1296, height: 1944, widths: TALL_WIDTHS };
  return null;
}

export function sceneSrc(art, width, format) {
  return `${SCENE_DIR}/${art.base}-${width}.${SCENE_VERSION}.${format}`;
}

export function sceneSrcSet(art, format) {
  return art.widths.map((w) => `${sceneSrc(art, w, format)} ${w}w`).join(', ');
}

/** Every published file, for the test and for anyone checking the folder. */
export function allSceneFiles() {
  const arts = [];
  for (const kind of [...STATE_SCENES, 'milestone']) arts.push(sceneArt(kind, { night: true }), sceneArt(kind, { night: false }));
  arts.push(sceneArt('welcome'), sceneArt('planSeal'));
  return arts.flatMap((art) => art.widths.flatMap((w) => ['avif', 'webp'].map((format) => ({ art, width: w, format, src: sceneSrc(art, w, format) }))));
}

/**
 * Which room a state shows (the app's StateView.shownScene):
 *   offline  the unplugged desk, always
 *   error    the loose cable and the repair tin ("can't reach us") when the caller asks for a room
 *            (`scene` set); the unplugged desk instead when the browser says it is offline
 *   empty    only a room it names (EMPTY_SCENES); no room otherwise
 */
export function sceneForState(kind, scene, { online = true } = {}) {
  if (kind === 'offline') return 'offline';
  if (kind === 'error') {
    if (!scene) return null;
    return scene === 'offline' || !online ? 'offline' : 'unreachable';
  }
  if (kind === 'empty') return EMPTY_SCENES.includes(scene) ? scene : null;
  return null;
}

/**
 * Where Mobi stands in a 3:2 room, as fractions of the room's box (SceneVignette in the app): his
 * height is mobiShare (0.42) of the room's height, his box is 1.6 times his height wide, and his feet
 * are at the measured anchor. `mobiOfWidth` is his height as a share of the room's width, for CSS
 * container units.
 */
export function vignetteLayout(anchors, scene, { night = true } = {}) {
  const v = anchors.vignette;
  const room = v.scenes[scene];
  if (!room) return null;
  const foot = room[night ? 'night' : 'day'];
  const aspect = v.file.height / v.file.width;
  const mobiOfHeight = v.mobiShare;
  const boxOfWidth = 1.6 * mobiOfHeight * aspect;
  return {
    aspect,
    foot: { x: foot.footX, y: foot.footY },
    mobi: { left: foot.footX - boxOfWidth / 2, top: foot.footY - mobiOfHeight, width: boxOfWidth, height: mobiOfHeight },
    mobiOfWidth: mobiOfHeight * aspect,
  };
}

/**
 * The living parts of a room (the app's SceneLife), as fractions of the room's box. Both themes: the
 * floor pool breathes. Night only: the lamp glow breathes, the motes rise through the cone and the
 * stars twinkle. Every number is the app's painter arithmetic, so each run is the same.
 *   timing   one breath (s), the number of breaths, and the fade at each end (ms)
 *   pool     centre, width (of the room's width), peak alpha; it is squashed to 0.3 of its width
 *   glow     the bulb, its radius as a share of the room's width, alpha 0.06 + 0.07 x breath
 *   motes    each rises from the cone's foot to just under the shade over one breath, starting at
 *            phase i / count; x0 and x1 are its start and end across, alpha its peak (it fades in and
 *            out along a sine), size its diameter as a share of the room's width (the app's px at 380
 *            wide), sway its phase on the small 1.5-per-breath side to side
 *   stars    each pulses as sin^3 over half a breath (4 s), staggered 0.31 of a pulse
 */
export function lifeLayers(anchors, scene, { night = true } = {}) {
  const room = anchors.vignette.scenes[scene];
  if (!room) return null;
  const spec = room.life;
  const L = anchors.vignette.life;
  const aspect = anchors.vignette.file.height / anchors.vignette.file.width;
  const timing = { breathSeconds: L.breathSeconds, cycles: L.cycles, fadeEndsMs: L.fadeEndsMs };
  const pool = { x: spec.ellipseX, y: spec.ellipseY, width: spec.ellipseW, squash: 0.3, alpha: night ? L.poolAlphaNight : L.poolAlphaDay };
  if (!night) return { timing, pool, glow: null, motes: [], stars: [] };

  const glow = { x: spec.lampX, y: spec.lampY, radius: L.glowRadiusOfWidth, alphaLow: 0.06, alphaHigh: 0.13 };
  const top = spec.lampY + 0.04;
  const foot = spec.coneFootY;
  // spread(y) = ((y - top) / (foot - top)) x 0.11 w + 0.02 w: 0.13 w at the cone's foot, 0.02 w at the shade.
  const motes = Array.from({ length: L.motes }, (_, i) => {
    const r = ((i * 37) % 17) / 16;
    const lean = (r * 2 - 1) * 0.8;
    const radiusPx = 0.7 + 0.9 * (((i * 5) % 4) / 3);
    return {
      phase: i / L.motes,
      x0: spec.lampX + lean * 0.13,
      x1: spec.lampX + lean * 0.02,
      y0: foot,
      y1: top,
      alpha: 0.22 + 0.4 * (((i * 11) % 7) / 6),
      size: (2 * radiusPx) / 380,
      sway: (i * 0.37) % 1,
      swayOfWidth: 0.004,
    };
  });
  const stars = spec.stars.map(([x, y], i) => ({ x, y, phase: (i * 0.31) % 1, periodSeconds: L.breathSeconds / 2 }));
  return { timing, pool, glow, motes, stars, aspect };
}
