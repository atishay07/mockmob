// Mobi's rig as data (v2, 15 Oct 2026): every act, stance, mood, overlay, idle timing and spring
// in one table, so the app and the website play the same Mobi from the same numbers. The app
// compiles this table once (mobi_rig_eval.dart) and evaluates it every frame; the website reads
// the JSON export of the same table (`data/mobi_rig.v2.json`, written by
// test/unit/mascot/mobi_rig_spec_test.dart) and must evaluate it with the same rules, below.
//
// Units: design units in a 140 by 168 box (soles on y 162), radians, seconds. Up is negative y.
//
// ---- Expressions --------------------------------------------------------------------------
// A number, or a list whose first item names the operation. `t` is seconds into the act (or the
// overlay). Any numeric argument may itself be an expression.
//   ['ease', a, b, curve?]      0 for t <= a, 1 for t >= b, else curve((t - a) / (b - a));
//                               curve defaults to easeInOutCubic
//   ['win', a, b, c, d, cIn?, cOut?]  ease(a, b, cIn) * (1 - ease(c, d, cOut))
//   ['bump', a, b]              0 outside (a, b), else sin(pi * (t - a) / (b - a))
//   ['hop', a, b, h]            0 outside (a, b), else -h * 4p(1 - p), p = (t - a) / (b - a)
//   ['span', a, b]              -1 outside [a, b], else (t - a) / (b - a)
//   ['osc', hz, t0]             sin(2 pi hz (t - t0))
//   ['curve', name, e]          curve(e), e clamped to 0..1 (0 and 1 map to themselves)
//   ['pow', e, p]               sign(e) * |e|^p
//   ['abs', e]  ['pos', e] (max(0, e))  ['sign', e] (-1, 0 or 1)  ['step', e, edge] (e < edge ? -1 : 1)
//   ['dip', e]                  sin(pi * clamp(e, 0, 1))
//   ['+', e...]  ['*', e...]  ['k', c, e] (c * e)  ['1-', e] (1 - e)  ['min', e...]  ['max', e...]
//   ['clamp', e, lo, hi]
//   ['ref', name]               a `let` value, or a parameter: t, w (strength), len (trip
//                               length), side (-1 or 1)
//   ['base', field]             the base rig's scalar field (x, y, tilt, squash, lookX, ...)
//
// Curves are Flutter's Cubic curves: x(m) = 3a(1-m)^2 m + 3c(1-m)m^2 + m^3, found by bisection
// on m in [0, 1] (start at 0.5, stop when |x - t| < 0.001), then y(m) with b and d. t of exactly
// 0 or 1 returns t. 'linear' is the identity.
//
// ---- Channels ------------------------------------------------------------------------------
// An act (or overlay) is `let` (named expressions, in order) and channels on the base rig. A
// channel is an expression (added to the base value) or a map applied in this order:
//   to + w: v += (to - v) * w;  mul: v *= mul;  add: v += add;  max: v = max(v, max);  set: v = set
// Scalar channels: x, y, tilt, squash, lookX, lookY, antenna, burst, zzz, sheet, glow, glint,
// sparkle, bubble. Eyes: `eyes` (both), then `eyeL` / `eyeR`, each a map of open, happy, lid,
// smile, slant. Arms: `arms` (both), then `armL` / `armR`: `to` (a named arm or an arm map;
// missing fields take the arm defaults) lerped by `w` for every field not in `keep`, then field
// channels (angle, bend, twist, front, point, reach) on the lerped arm. `when`: 'free' (the arm is
// behind the body and not pointing) or 'pointing' (point >= 0.5) skips the arm otherwise. Boots:
// `boots` (both), then `bootL` / `bootR`, channels dx, dy, rot. Every channel reads the base
// rig's value, so the order of channels never matters.
//
// The rig's effect fields (burst, zzz, glint, sparkle, bubble) are progress 0 to 1, or -1 for
// none; between two rigs they switch at the halfway point instead of blending.
library;

/// Mobi's rig as data. JSON-safe: maps with string keys, lists, numbers, strings, booleans, null.
const Map<String, Object?> mobiRigSpec = {
  'version': 2,
  'units': 'design units in a 140 by 168 box (soles on y 162, up is negative), radians, seconds',

  // ---- Curves (Flutter Cubic control points a, b, c, d) ------------------------------------
  'curves': {
    'linear': null,
    'easeIn': [0.42, 0.0, 1.0, 1.0],
    'easeOut': [0.0, 0.0, 0.58, 1.0],
    'easeInOut': [0.42, 0.0, 0.58, 1.0],
    'easeInCubic': [0.55, 0.055, 0.675, 0.19],
    'easeOutCubic': [0.215, 0.61, 0.355, 1.0],
    'easeInOutCubic': [0.645, 0.045, 0.355, 1.0],
    'easeInOutSine': [0.445, 0.05, 0.55, 0.95],
    'easeOutBack': [0.175, 0.885, 0.32, 1.275],
  },

  // ---- Defaults ----------------------------------------------------------------------------
  'defaults': {
    'eye': {'open': 1, 'happy': 0, 'lid': 0, 'smile': 0, 'slant': 0},
    'arm': {'angle': 0, 'bend': 0.25, 'twist': 0, 'front': 0, 'point': 0, 'reach': 1},
    'boot': {'dx': 0, 'dy': 0, 'rot': 0},
    'rig': {
      'x': 0, 'y': 0, 'tilt': 0, 'squash': 0, 'lookX': 0, 'lookY': 0, 'antenna': 0, //
      'burst': -1, 'zzz': -1, 'sheet': 0, 'glow': 0, 'glint': -1, 'sparkle': -1, 'bubble': -1,
      'eyeL': {}, 'eyeR': {},
      'armL': {'angle': 0.3, 'bend': 0.3},
      'armR': {'angle': 0.28, 'bend': 0.3},
      'bootL': {}, 'bootR': {},
    },
  },

  // ---- Named arms ----------------------------------------------------------------------------
  'arms': {
    // Mittens on hips, elbows out.
    'hip': {'angle': 0.5, 'bend': -0.7, 'reach': 0.95},
    'akimbo': {'angle': 0.16, 'bend': 1.75, 'reach': 0.86, 'twist': 0.7},
    // The free arm while the other points.
    'pointHip': {'angle': 0.3, 'bend': -0.6, 'reach': 0.88},
    // Fists up at the chest.
    'fist': {'angle': -0.72, 'bend': 1.2, 'front': 1, 'reach': 0.9, 'twist': -0.45},
    // Mitten to chin.
    'chin': {'angle': -1.3, 'bend': 1.3, 'front': 1, 'reach': 1.04, 'twist': -0.55},
    // Arms raised for a cheer.
    'up': {'angle': 2.45, 'bend': -0.9, 'reach': 1.5, 'twist': 0.1},
    'waveL': {'angle': 2.7, 'bend': -1.2, 'reach': 1.38},
    'waveR': {'angle': 2.7, 'bend': -1.2, 'reach': 1.34},
    'shrug': {'angle': 0.72, 'bend': -0.55, 'reach': 0.96, 'twist': -1.3},
    'stretch': {'angle': 2.1, 'bend': -0.5, 'reach': 1.28, 'twist': 0.2},
    'pumpUp': {'angle': 2.85, 'bend': -0.9, 'reach': 1.08, 'twist': 0.15},
    'flungWake': {'angle': 1.2, 'bend': -0.6, 'reach': 1.15, 'twist': -0.6},
    'flungStartle': {'angle': 1.05, 'bend': -0.5, 'reach': 1.1, 'twist': -0.6},
    'tucked': {'angle': -0.4, 'bend': 1.1, 'front': 1, 'reach': 0.86, 'twist': -0.4},
    // A mitten laid on the chest (sympathy).
    'heart': {'angle': -0.95, 'bend': 1.15, 'front': 1, 'reach': 0.84, 'twist': -0.5},
    // One finger straight up (an idea).
    'fingerUp': {'angle': 2.7, 'bend': -0.3, 'point': 1, 'reach': 1.16},
  },

  // ---- Stances (how Mobi stands between acts) -----------------------------------------------
  // `point` is aimed at run time: the pointing arm takes `pointing` with angle = the aim, the
  // other arm `free`; x is `x.right` or `x.left`; tilt = tilt * side; lookX = lookX * side;
  // lookY = clamp(cos(aim) * lookYFromAim, -1, 1). The default aim is 1.5 rad to the right.
  'stances': {
    'stand': {},
    'point': {
      'aimed': true,
      'pointing': {'bend': 0.06, 'point': 1, 'reach': 0.86},
      'free': 'pointHip',
      'x': {'right': -11, 'left': 7.5},
      'tilt': 0.035,
      'lookX': 0.75,
      'lookYFromAim': 0.9,
      'defaultAim': 1.5,
    },
    'think': {
      'armL': 'chin',
      'armR': {'angle': 0.55, 'bend': -0.75, 'reach': 0.95},
      'eyeR': {'open': 0.42},
      'lookX': 0.45, 'lookY': -0.7, 'tilt': -0.04, 'glow': 0.3,
    },
    'sleepy': {
      'eyeL': {'open': 0.3}, 'eyeR': {'open': 0.3},
      'armL': {'angle': 0.14, 'bend': 0.12}, 'armR': {'angle': 0.12, 'bend': 0.12},
      'tilt': -0.035, 'squash': -0.015, 'y': 1, 'lookY': 0.35, 'antenna': 0.32,
    },
    'rest': {
      'y': 12, 'squash': -0.02,
      'armL': {'angle': 0.55, 'bend': 0.1, 'reach': 0.95}, 'armR': {'angle': 0.55, 'bend': 0.1, 'reach': 0.95},
      'bootL': {'dx': -9, 'dy': -1, 'rot': 0.28}, 'bootR': {'dx': 9, 'dy': -1, 'rot': 0.28},
      'eyeL': {'open': 0.82}, 'eyeR': {'open': 0.82}, 'lookY': 0.15,
    },
    'read': {
      'sheet': 1,
      'armL': {'angle': -0.82, 'bend': 0.5, 'front': 1, 'reach': 0.9},
      'armR': {'angle': -0.82, 'bend': 0.5, 'front': 1, 'reach': 0.95},
      'lookY': 0.75, 'lookX': -0.1, 'tilt': 0.02,
    },
    'loading': {
      'armL': 'chin', 'armR': 'hip',
      'eyeL': {'lid': 0.18}, 'eyeR': {'lid': 0.18},
      'lookY': -0.45, 'tilt': -0.02, 'glow': 0.45,
    },
    'sleep': {
      'y': 13, 'squash': -0.035, 'tilt': -0.075,
      'eyeL': {'open': 0.04}, 'eyeR': {'open': 0.04},
      'armL': {'angle': 0.32, 'bend': 0.05, 'reach': 0.95}, 'armR': {'angle': 0.4, 'bend': 0.05, 'reach': 0.95},
      'bootL': {'dx': -7.5, 'dy': 1.5, 'rot': 0.26}, 'bootR': {'dx': 7, 'dy': 1.5, 'rot': 0.2},
      'lookY': 0.5, 'antenna': 0.5,
    },
    'listen': {
      'tilt': -0.12, 'x': 5, 'y': 0.5,
      'eyeL': {'open': 1.1, 'smile': 0.2}, 'eyeR': {'open': 1.1, 'smile': 0.2},
      'armL': {'angle': 2.3, 'bend': 0.2, 'reach': 0.94, 'front': 1, 'twist': -0.75},
      'armR': {'angle': 0.2, 'bend': 0.3, 'reach': 0.98},
      'lookX': -0.35, 'lookY': 0.15,
    },
  },

  // How long, and with what curve, Mobi moves into a stance. An arm that sweeps more than
  // `elbow.from` rad on the way bends at the elbow: its reach dips by up to `elbow.depth`
  // (reached at a sweep of from + ramp) at the middle of the blend, sin(pi * progress).
  'stanceBlends': {
    'stand': [0.45, 'easeInOutCubic'],
    'point': [0.42, 'easeOutBack'],
    'think': [0.5, 'easeOutCubic'],
    'sleepy': [0.45, 'easeInOutCubic'],
    'rest': [0.7, 'easeOutBack'],
    'read': [0.45, 'easeInOutCubic'],
    'loading': [0.5, 'easeOutCubic'],
    'sleep': [1.2, 'easeInOutCubic'],
    'listen': [0.5, 'easeOutCubic'],
  },
  'elbow': {'from': 1.2, 'ramp': 0.8, 'depth': 0.4},

  // ---- Moods (a face under every act) ------------------------------------------------------
  // At strength w: eye open *= 1 + open * w; lid = max(lid, lid * w); smile = max(smile, smile *
  // w); slant += slant * w. `add` fields are added times w. Calm changes nothing. A mood blends
  // over `blend` seconds (easeInOutCubic) by lerping the rig with the old mood toward the rig
  // with the new one.
  'moodBlend': 0.3,
  'moods': {
    'calm': {},
    'happy': {'eyes': {'smile': 0.38}, 'add': {'antenna': -0.05}},
    'proud': {'eyes': {'smile': 0.3}, 'add': {'lookY': -0.18, 'squash': 0.012, 'y': -0.6, 'glow': 0.18}},
    'curious': {'eyeL': {'open': 0.06}, 'eyeR': {'open': 0.14}, 'add': {'lookY': -0.14, 'tilt': 0.03, 'antenna': -0.14}},
    'sleepy': {'eyes': {'lid': 0.34}, 'add': {'lookY': 0.12, 'antenna': 0.16}},
    'concerned': {'eyes': {'slant': 0.42, 'smile': 0.16}, 'add': {'lookY': 0.08, 'tilt': -0.02, 'y': 0.4}},
    // 15 Oct v2: a flat, lowered upper lid (a hair of inward slant keeps it level, not drowsy),
    // eyes steady and a touch down at the work, the bulb faintly on, the antenna forward.
    'focused': {'eyes': {'lid': 0.26, 'slant': -0.06}, 'add': {'lookY': 0.1, 'tilt': 0.012, 'glow': 0.14, 'antenna': -0.07}},
  },

  // ---- Acts ----------------------------------------------------------------------------------
  // seconds: how long it plays (talk runs as long as its line; walk as long as its trip).
  // stance: what it leaves Mobi in, or null to return to the stance it was played from.
  // held: it changes the stance until the next act. still: under reduced motion its key pose
  // shows (without travel) for its length. reaction: it answers a moment and gives way.
  // key: the still frame for previews and reduced motion: `at` seconds into the act (or the
  // overlay `overlay` at `at`), then `set` (whole boots or arms may be set), or no `at` for the
  // stance itself plus `set`.
  'acts': {
    'idle': {'seconds': 0.5, 'stance': 'stand', 'held': true},
    'appear': {
      'seconds': 0.75, 'stance': 'stand',
      'let': {
        'e': ['ease', 0, 0.55, 'easeOutBack'],
        'land': ['bump', 0.38, 0.62],
        'on': ['+', 0.04, ['k', 0.96, ['curve', 'easeOutBack', ['ease', 0.14, 0.36, 'linear']]]],
      },
      'y': ['+', ['k', 10, ['1-', ['ref', 'e']]], ['k', 1.2, ['ref', 'land']]],
      'squash': ['+', ['k', -0.07, ['1-', ['ease', 0, 0.4]]], ['k', 0.05, ['bump', 0.12, 0.4]], ['k', -0.05, ['ref', 'land']]],
      'eyes': {'open': {'mul': ['ref', 'on']}},
      'glint': {'set': ['span', 0.3, 0.75]},
    },
    'hello': {
      'seconds': 1.85, 'stance': 'stand', 'still': true,
      'let': {
        'antic': ['bump', 0, 0.2],
        'w': ['*', ['ease', 0.08, 0.56, 'easeInOutSine'], ['1-', ['ease', 1.3, 1.85, 'easeInOutSine']]],
        'osc': ['*', ['osc', 2.4, 0.34], ['win', 0.34, 0.52, 1.12, 1.32]],
        'happy': ['win', 0.16, 0.36, 1.34, 1.7],
        'rise': ['pos', ['ref', 'w']],
      },
      'armL': {
        'to': 'waveL', 'w': ['ref', 'w'], 'keep': ['reach'],
        'reach': {'to': 1.38, 'w': ['pow', ['ref', 'w'], 2.6], 'add': ['k', -0.3, ['dip', ['ref', 'w']]]},
        'angle': ['k', 0.13, ['ref', 'osc']],
        'twist': ['k', 0.6, ['ref', 'osc']],
      },
      'x': ['k', 6, ['min', 1, ['k', 1.4, ['ref', 'rise']]]],
      'tilt': ['+', ['k', 0.06, ['ref', 'rise']], ['k', -0.03, ['ref', 'antic']], ['k', 0.018, ['ref', 'osc']]],
      'y': ['+', ['k', 1.4, ['ref', 'antic']], ['k', -1.6, ['bump', 0.16, 0.56]]],
      'squash': ['+', ['k', -0.035, ['ref', 'antic']], ['k', 0.02, ['bump', 0.18, 0.5]]],
      'eyes': {'happy': {'set': ['ref', 'happy']}},
      'lookX': {'to': 0, 'w': ['ref', 'rise']},
      'lookY': {'to': 0, 'w': ['ref', 'rise']},
      'bootR': {'rot': ['k', -0.05, ['ref', 'rise']]},
      'glint': {'set': ['span', 0.22, 0.72]},
      'key': {'at': 0.62, 'set': {'tilt': 0.05, 'y': 0, 'squash': 0, 'glint': -1}},
    },
    'talk': {'seconds': 1.6, 'stance': null, 'overlay': 'talk', 'key': {'overlay': 'talk', 'at': 0.3, 'w': 1}},
    'cheer': {
      'seconds': 1.2, 'stance': 'stand', 'still': true,
      'let': {
        'antic': ['win', 0, 0.14, 0.14, 0.22, 'easeOut'],
        'air': ['hop', 0.2, 0.64, 20],
        'land': ['bump', 0.62, 0.84],
        'up': ['win', 0.1, 0.3, 0.85, 1.2, 'easeOutBack'],
        'happy': ['win', 0.06, 0.2, 1.0, 1.2],
        'wig': ['*', 0.12, ['osc', 3, 0], ['ref', 'up'], ['ref', 'up']],
        'tuck': ['bump', 0.22, 0.62],
      },
      'arms': {'to': 'up', 'w': ['ref', 'up']},
      'armL': {'angle': ['ref', 'wig']},
      'armR': {'angle': ['k', -1, ['ref', 'wig']]},
      'y': ['+', ['k', 3.5, ['ref', 'antic']], ['ref', 'air'], ['k', 2.5, ['ref', 'land']]],
      'squash': ['+', ['k', -0.09, ['ref', 'antic']], ['k', 0.07, ['bump', 0.18, 0.42]], ['k', -0.08, ['ref', 'land']]],
      'eyes': {'happy': {'set': ['ref', 'happy']}},
      'lookX': {'to': 0, 'w': ['ref', 'up']},
      'lookY': {'to': 0, 'w': ['ref', 'up'], 'add': ['k', -0.2, ['ref', 'up']]},
      'glow': ['k', 0.8, ['bump', 0.15, 0.9]],
      'bootL': {
        'dx': ['+', ['k', 2, ['ref', 'tuck']], ['k', -1.8, ['ref', 'land']]],
        'dy': ['k', 0.92, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'bootR': {
        'dx': ['+', ['k', -2, ['ref', 'tuck']], ['k', 1.8, ['ref', 'land']]],
        'dy': ['k', 0.92, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'key': {'at': 0.4, 'set': {'y': -8, 'bootL': {'dy': -7}, 'bootR': {'dy': -7}}},
    },
    'celebrate': {
      'seconds': 2.0, 'stance': 'stand', 'still': true,
      'let': {
        'antic': ['win', 0, 0.16, 0.16, 0.24, 'easeOut'],
        'air': ['+', ['hop', 0.22, 0.86, 34], ['hop', 1.0, 1.28, 8]],
        'land': ['+', ['bump', 0.84, 1.02], ['k', 0.6, ['bump', 1.26, 1.42]]],
        'up': ['win', 0.12, 0.32, 1.5, 1.95, 'easeOutBack'],
        'happy': ['win', 0.06, 0.2, 1.75, 2.0],
        'wig': ['*', 0.18, ['osc', 3.5, 0], ['ref', 'up'], ['ref', 'up']],
        'tuck': ['+', ['bump', 0.24, 0.84], ['bump', 1.0, 1.28]],
      },
      'arms': {'to': 'up', 'w': ['ref', 'up']},
      'armL': {'angle': ['ref', 'wig']},
      'armR': {'angle': ['k', -1, ['ref', 'wig']]},
      'y': ['+', ['k', 4, ['ref', 'antic']], ['ref', 'air'], ['k', 3, ['ref', 'land']]],
      'squash': ['+', ['k', -0.1, ['ref', 'antic']], ['k', 0.09, ['bump', 0.2, 0.46]], ['k', -0.09, ['ref', 'land']]],
      'tilt': ['*', 0.07, ['osc', 1.5, 0], ['bump', 0.3, 1.0]],
      'eyes': {'happy': {'set': ['ref', 'happy']}},
      'lookX': {'to': 0, 'w': ['ref', 'up']},
      'lookY': {'to': 0, 'w': ['ref', 'up'], 'add': ['k', -0.3, ['ref', 'up']]},
      'burst': {'set': ['span', 0.26, 1.7]},
      'glow': ['bump', 0.2, 1.6],
      'glint': {'set': ['span', 0.4, 0.9]},
      'bootL': {
        'dx': ['+', ['k', 2, ['ref', 'tuck']], ['k', -1.8, ['ref', 'land']]],
        'dy': ['k', 0.9, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'bootR': {
        'dx': ['+', ['k', -2, ['ref', 'tuck']], ['k', 1.8, ['ref', 'land']]],
        'dy': ['k', 0.9, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'key': {'at': 0.55, 'set': {'glint': -1}},
    },
    'think': {
      'seconds': 0.8, 'stance': 'think', 'held': true,
      'tilt': ['k', -0.05, ['bump', 0.1, 0.8]],
    },
    'point': {
      'seconds': 0.6, 'stance': 'point', 'held': true,
      'tilt': ['*', 0.06, ['bump', 0.05, 0.55], ['sign', ['base', 'lookX']]],
    },
    'sleepy': {
      'seconds': 2.2, 'stance': 'sleepy', 'held': true,
      'let': {
        's': ['win', 0.05, 0.42, 0.5, 1.25],
        'shut': ['win', 0.26, 0.5, 1.35, 1.8],
      },
      'arms': {'to': 'stretch', 'w': ['k', 0.85, ['ref', 's']]},
      'squash': ['k', 0.06, ['ref', 's']],
      'y': ['k', -2.2, ['ref', 's']],
      'tilt': ['k', -0.04, ['ref', 's']],
      'eyes': {'open': {'mul': ['1-', ['k', 0.9, ['ref', 'shut']]]}},
      'boots': {'rot': ['k', -0.1, ['ref', 's']]},
    },
    'oops': {
      'seconds': 1.3, 'stance': 'stand',
      'let': {
        's': ['win', 0, 0.26, 0.95, 1.3, 'easeOutBack'],
        'droop': ['win', 0.15, 0.35, 0.8, 1.15],
      },
      'arms': {'to': 'shrug', 'w': ['ref', 's']},
      'squash': ['k', -0.035, ['ref', 's']],
      'y': ['k', 1.2, ['ref', 's']],
      'tilt': ['*', 0.04, ['ref', 's'], ['osc', 1.4, 0]],
      'eyes': {'open': {'mul': ['1-', ['k', 0.3, ['ref', 'droop']]]}},
      'lookX': ['k', -0.45, ['ref', 's']],
      'lookY': ['k', 0.75, ['ref', 'droop']],
      'key': {'at': 0.5},
    },
    'rest': {
      'seconds': 0.9, 'stance': 'rest', 'held': true,
      'squash': ['k', -0.05, ['bump', 0.45, 0.85]],
    },
    'read': {'seconds': 0.7, 'stance': 'read', 'held': true},
    'correct': {
      'seconds': 1.15, 'stance': 'stand', 'reaction': true,
      'let': {
        'crouch': ['bump', 0, 0.16],
        'air': ['hop', 0.12, 0.44, 12],
        'land': ['bump', 0.42, 0.6],
        'nod': ['bump', 0.6, 0.84],
        'pump': ['win', 0.08, 0.34, 0.72, 1.05, 'easeOutBack'],
        'happy': ['win', 0.06, 0.18, 0.88, 1.12],
        'tuck': ['bump', 0.14, 0.42],
      },
      'armR': {'to': 'pumpUp', 'w': ['ref', 'pump'], 'reach': ['k', -0.65, ['dip', ['ref', 'pump']]]},
      'y': ['+', ['k', 2.4, ['ref', 'crouch']], ['ref', 'air'], ['k', 1.8, ['ref', 'land']], ['k', 1.5, ['ref', 'nod']]],
      'squash': ['+', ['k', -0.07, ['ref', 'crouch']], ['k', 0.06, ['bump', 0.12, 0.3]], ['k', -0.06, ['ref', 'land']], ['k', -0.02, ['ref', 'nod']]],
      'tilt': ['k', 0.04, ['ref', 'pump']],
      'eyes': {'happy': {'max': ['ref', 'happy']}},
      'lookX': {'to': 0, 'w': ['ref', 'happy']},
      'lookY': {'to': 0, 'w': ['ref', 'happy'], 'add': ['k', 0.35, ['ref', 'nod']]},
      'glow': ['k', 0.9, ['bump', 0.08, 0.8]],
      'bubble': {'set': ['span', 0.12, 1.1]},
      'bootL': {
        'dx': ['+', ['k', 2, ['ref', 'tuck']], ['k', -1.8, ['ref', 'land']]],
        'dy': ['k', 0.9, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'bootR': {
        'dx': ['+', ['k', -2, ['ref', 'tuck']], ['k', 1.8, ['ref', 'land']]],
        'dy': ['k', 0.9, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'key': {'at': 0.3, 'set': {'y': -6, 'bubble': 0.5}},
    },
    'encourage': {
      'seconds': 1.45, 'stance': 'stand', 'reaction': true,
      'let': {
        'inhale': ['bump', 0, 0.3],
        'lean': ['win', 0.12, 0.42, 1.1, 1.45, 'easeOutBack'],
        'raise': ['win', 0.14, 0.4, 1.0, 1.4, 'easeOutBack'],
        'pump': ['+', ['bump', 0.46, 0.64], ['k', 0.7, ['bump', 0.64, 0.82]]],
        'nods': ['+', ['bump', 0.5, 0.68], ['k', 0.7, ['bump', 0.68, 0.86]]],
        'warm': ['win', 0.1, 0.3, 1.15, 1.45],
      },
      'arms': {
        'to': 'fist', 'w': ['ref', 'raise'],
        'angle': ['k', -0.14, ['ref', 'pump']],
        'bend': ['k', 0.12, ['ref', 'pump']],
        'reach': ['k', -0.05, ['ref', 'pump']],
      },
      'squash': ['+', ['k', 0.03, ['ref', 'inhale']], ['k', -0.025, ['ref', 'nods']]],
      'y': ['+', ['k', -1.2, ['ref', 'inhale']], ['ref', 'lean'], ['k', 1.6, ['ref', 'nods']]],
      'tilt': ['k', 0.03, ['ref', 'lean']],
      'eyes': {
        'smile': {'max': ['k', 0.62, ['ref', 'warm']]},
        'open': {'mul': ['+', 1, ['k', 0.06, ['ref', 'warm']]]},
      },
      'lookX': {'to': 0, 'w': ['ref', 'warm']},
      'lookY': {'to': 0, 'w': ['ref', 'warm'], 'add': ['+', ['k', 0.1, ['ref', 'warm']], ['k', 0.22, ['ref', 'nods']]]},
      'glow': ['k', 0.4, ['bump', 0.3, 1.2]],
      'key': {'at': 0.62},
    },
    'loading': {
      'seconds': 0.6, 'stance': 'loading', 'held': true,
      'glow': ['k', 0.5, ['bump', 0, 0.6]],
      'y': ['k', -1.2, ['bump', 0.05, 0.4]],
      'key': {'overlay': 'loading', 'at': 0.2125, 'w': 1},
    },
    'sleep': {
      'seconds': 1.7, 'stance': 'sleep', 'held': true,
      'let': {'yawn': ['bump', 0, 0.8], 'dip': ['bump', 0.9, 1.5]},
      'arms': {'to': 'up', 'w': ['k', 0.45, ['ref', 'yawn']]},
      'squash': ['+', ['k', 0.04, ['ref', 'yawn']], ['k', -0.03, ['ref', 'dip']]],
      'tilt': ['k', -0.04, ['ref', 'dip']],
      'y': ['k', 1.5, ['ref', 'dip']],
      'key': {'set': {'zzz': 0.45}},
    },
    'nudge': {
      'seconds': 1.05, 'stance': 'point', 'held': true,
      'let': {
        'side': ['step', ['base', 'lookX'], 0],
        'pull': ['bump', 0.28, 0.4],
        'jab': ['+', ['bump', 0.38, 0.56], ['k', 0.8, ['bump', 0.6, 0.78]]],
        'smile': ['win', 0.3, 0.45, 0.85, 1.05],
      },
      'arms': {
        'when': 'pointing',
        'reach': ['+', ['k', -0.06, ['ref', 'pull']], ['k', 0.05, ['ref', 'jab']]],
        'bend': ['k', -0.1, ['ref', 'jab']],
      },
      'tilt': ['*', ['ref', 'side'], ['+', ['k', 0.045, ['ref', 'jab']], ['k', -0.02, ['ref', 'pull']]]],
      'x': ['*', -0.6, ['ref', 'side'], ['ref', 'jab']],
      'eyes': {'smile': {'max': ['k', 0.75, ['ref', 'smile']]}},
      'key': {'at': 0.47},
    },
    'proud': {
      'seconds': 2.2, 'stance': 'stand', 'still': true,
      'let': {
        'dip': ['bump', 0, 0.22],
        'tall': ['win', 0.16, 0.5, 1.75, 2.2, 'easeOutBack'],
        'hips': ['win', 0.12, 0.42, 1.7, 2.15, 'easeOutBack'],
        'sway': ['*', ['osc', 0.8, 0.5], ['win', 0.5, 0.8, 1.5, 1.8]],
      },
      'y': ['+', ['k', 2.2, ['ref', 'dip']], ['k', -2.4, ['ref', 'tall']]],
      'squash': ['+', ['k', -0.06, ['ref', 'dip']], ['k', 0.05, ['ref', 'tall']]],
      'tilt': ['+', ['k', -0.02, ['ref', 'tall']], ['k', 0.022, ['ref', 'sway']]],
      'arms': {'to': 'akimbo', 'w': ['ref', 'hips']},
      'eyes': {'happy': {'max': ['win', 0.3, 0.5, 1.7, 2.1]}},
      'lookX': {'to': 0, 'w': ['ref', 'tall'], 'add': ['k', 0.12, ['ref', 'tall']]},
      'lookY': {'to': 0, 'w': ['ref', 'tall'], 'add': ['k', -0.5, ['ref', 'tall']]},
      'bootL': {'rot': ['k', 0.08, ['ref', 'tall']], 'dx': ['k', -1.5, ['ref', 'tall']]},
      'bootR': {'rot': ['k', 0.08, ['ref', 'tall']], 'dx': ['k', 1.5, ['ref', 'tall']]},
      'glow': ['k', 0.7, ['bump', 0.3, 1.9]],
      'sparkle': {'set': ['span', 0.36, 1.86]},
      'glint': {'set': ['span', 0.42, 0.95]},
      'key': {'at': 1.0, 'set': {'glint': -1}},
    },
    'listen': {
      'seconds': 0.55, 'stance': 'listen', 'held': true,
      'y': ['k', 1.6, ['bump', 0.1, 0.5]],
      'lookY': ['k', 0.25, ['bump', 0.1, 0.5]],
      'tilt': ['k', -0.03, ['bump', 0.05, 0.5]],
    },
    'wake': {
      'seconds': 1.2, 'stance': 'stand', 'reaction': true,
      'let': {
        'startle': ['win', 0, 0.07, 0.42, 0.7, 'easeOut'],
        'air': ['hop', 0.05, 0.34, 9],
        'land': ['bump', 0.32, 0.5],
        'fling': ['win', 0.02, 0.12, 0.36, 0.66, 'easeOut', 'easeOutBack'],
        'round': ['+', ['bump', 0.5, 0.74], ['k', -1, ['bump', 0.74, 0.98]]],
        'happy': ['win', 0.98, 1.06, 1.1, 1.2],
        'tuck': ['bump', 0.06, 0.34],
      },
      'eyes': {
        'open': {'to': 1.24, 'w': ['ref', 'startle'], 'max': ['ease', 0, 0.08]},
        'happy': {'max': ['ref', 'happy']},
        'lid': {'mul': ['1-', ['ref', 'startle']]},
      },
      'arms': {'to': 'flungWake', 'w': ['ref', 'fling']},
      'y': ['+', ['ref', 'air'], ['k', 2.2, ['ref', 'land']]],
      'squash': ['+', ['k', 0.08, ['bump', 0.02, 0.18]], ['k', -0.07, ['ref', 'land']]],
      'tilt': ['+', ['k', -0.04, ['bump', 0.02, 0.22]], ['k', 0.015, ['ref', 'round']]],
      'lookX': ['k', 0.62, ['ref', 'round']],
      'lookY': {'to': 0, 'w': ['ref', 'startle'], 'add': ['k', -0.12, ['ref', 'startle']]},
      'glow': ['k', 0.85, ['bump', 0, 0.5]],
      'bootL': {
        'dx': ['+', ['k', 2, ['ref', 'tuck']], ['k', -1.8, ['ref', 'land']]],
        'dy': ['k', 0.85, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'bootR': {
        'dx': ['+', ['k', -2, ['ref', 'tuck']], ['k', 1.8, ['ref', 'land']]],
        'dy': ['k', 0.85, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'key': {'at': 0.2, 'set': {'y': -5}},
    },
    'nod': {
      'seconds': 0.8, 'stance': null, 'reaction': true,
      'let': {
        'nods': ['+', ['bump', 0.04, 0.34], ['k', 0.6, ['bump', 0.34, 0.62]]],
        'warm': ['win', 0, 0.16, 0.55, 0.8],
      },
      'y': ['k', 2.4, ['ref', 'nods']],
      'squash': ['k', -0.03, ['ref', 'nods']],
      'tilt': ['k', 0.012, ['ref', 'nods']],
      'lookY': {'to': 0, 'w': ['ref', 'warm'], 'add': ['k', 0.38, ['ref', 'nods']]},
      'lookX': {'to': 0, 'w': ['ref', 'warm']},
      'eyes': {'smile': {'max': ['k', 0.7, ['ref', 'warm']]}},
      'antenna': ['k', -0.08, ['ref', 'nods']],
      'key': {'at': 0.19},
    },
    'tilt': {
      'seconds': 1.1, 'stance': null, 'reaction': true,
      'let': {
        'side': ['step', ['base', 'lookX'], -0.1],
        'lean': ['win', 0, 0.32, 0.78, 1.1, 'easeOutBack'],
        'wide': ['win', 0.04, 0.2, 0.8, 1.05],
      },
      'tilt': ['*', 0.15, ['ref', 'side'], ['ref', 'lean']],
      'x': ['*', 2.5, ['ref', 'side'], ['ref', 'lean']],
      'y': ['k', -0.8, ['ref', 'lean']],
      'eyeL': {'open': {'mul': ['+', 1, ['k', 0.1, ['ref', 'wide']]]}, 'lid': {'mul': ['1-', ['ref', 'wide']]}},
      'eyeR': {'open': {'mul': ['+', 1, ['k', 0.16, ['ref', 'wide']]]}, 'lid': {'mul': ['1-', ['ref', 'wide']]}},
      'lookX': ['*', 0.25, ['ref', 'side'], ['ref', 'lean']],
      'lookY': ['k', -0.3, ['ref', 'lean']],
      'antenna': ['*', -0.12, ['ref', 'side'], ['ref', 'lean']],
      'arms': {'angle': ['k', 0.08, ['ref', 'lean']]},
      'key': {'at': 0.55},
    },
    'wave': {
      'seconds': 1.5, 'stance': 'stand', 'reaction': true,
      'let': {
        'w': ['*', ['ease', 0, 0.32, 'easeOutCubic'], ['1-', ['ease', 1.12, 1.5, 'easeInOutSine']]],
        'osc': ['*', ['osc', 2.6, 0.26], ['win', 0.26, 0.4, 0.98, 1.16]],
        'bow': ['bump', 0.95, 1.4],
        'warm': ['win', 0.1, 0.3, 1.2, 1.5],
      },
      'armR': {
        'to': 'waveR', 'w': ['ref', 'w'], 'keep': ['reach'],
        'reach': {'to': 1.34, 'w': ['pow', ['ref', 'w'], 2.6], 'add': ['k', -0.3, ['dip', ['ref', 'w']]]},
        'angle': ['k', -0.14, ['ref', 'osc']],
        'twist': ['k', -0.6, ['ref', 'osc']],
      },
      'x': ['k', -6, ['min', 1, ['k', 1.4, ['ref', 'w']]]],
      'tilt': ['+', ['k', -0.06, ['ref', 'w']], ['k', -0.018, ['ref', 'osc']]],
      'y': ['k', 2.2, ['ref', 'bow']],
      'squash': ['k', -0.02, ['ref', 'bow']],
      'lookX': {'to': 0, 'w': ['ref', 'w']},
      'lookY': {'to': 0, 'w': ['ref', 'w'], 'add': ['k', 0.3, ['ref', 'bow']]},
      'eyes': {'smile': {'max': ['k', 0.75, ['ref', 'warm']]}},
      'key': {'at': 0.5},
    },
    'startle': {
      'seconds': 0.95, 'stance': null, 'reaction': true,
      'let': {
        'jolt': ['win', 0, 0.06, 0.2, 0.38, 'easeOut'],
        'air': ['hop', 0.02, 0.26, 7],
        'land': ['bump', 0.24, 0.38],
        'fling': ['win', 0, 0.08, 0.24, 0.5, 'easeOut', 'easeOutBack'],
        'giggle': ['*', ['osc', 4.2, 0.34], ['win', 0.34, 0.42, 0.72, 0.92]],
        'happy': ['win', 0.3, 0.4, 0.76, 0.95],
        'tuck': ['bump', 0.02, 0.26],
      },
      'eyes': {
        'open': {'to': 1.26, 'w': ['ref', 'jolt']},
        'lid': {'mul': ['1-', ['ref', 'jolt']]},
        'happy': {'max': ['ref', 'happy']},
      },
      'arms': {'to': 'flungStartle', 'w': ['ref', 'fling']},
      'y': ['+', ['ref', 'air'], ['k', 1.8, ['ref', 'land']]],
      'squash': ['+', ['k', 0.07, ['bump', 0, 0.16]], ['k', -0.06, ['ref', 'land']], ['k', -0.015, ['abs', ['ref', 'giggle']]]],
      'tilt': ['k', 0.05, ['ref', 'giggle']],
      'x': ['k', 1.2, ['ref', 'giggle']],
      'lookY': {'to': 0, 'w': ['ref', 'jolt'], 'add': ['k', -0.2, ['ref', 'jolt']]},
      'glow': ['k', 0.7, ['bump', 0, 0.4]],
      'bootL': {
        'dx': ['+', ['k', 2, ['ref', 'tuck']], ['k', -1.8, ['ref', 'land']]],
        'dy': ['k', 0.85, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'bootR': {
        'dx': ['+', ['k', -2, ['ref', 'tuck']], ['k', 1.8, ['ref', 'land']]],
        'dy': ['k', 0.85, ['ref', 'air']],
        'rot': ['+', ['k', -0.18, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'key': {'at': 0.1},
    },
    'brace': {
      'seconds': 0.9, 'stance': null, 'reaction': true,
      'let': {
        'dip': ['win', 0, 0.22, 0.66, 0.9, 'easeOutCubic'],
        'shiver': ['*', ['osc', 7, 0], ['bump', 0.24, 0.66]],
      },
      'y': ['k', 3.2, ['ref', 'dip']],
      'squash': ['k', -0.06, ['ref', 'dip']],
      'tilt': ['k', 0.006, ['ref', 'shiver']],
      'arms': {'to': 'tucked', 'w': ['ref', 'dip']},
      'eyes': {'open': {'mul': ['+', 1, ['k', 0.18, ['ref', 'dip']]]}, 'lid': {'mul': ['1-', ['ref', 'dip']]}},
      'lookX': {'to': 0, 'w': ['ref', 'dip']},
      'lookY': {'to': 0, 'w': ['ref', 'dip'], 'add': ['k', -0.15, ['ref', 'dip']]},
      'antenna': ['k', 0.05, ['ref', 'shiver']],
      'glow': ['k', 0.25, ['ref', 'dip']],
      'key': {'at': 0.45},
    },
    'relief': {
      'seconds': 1.4, 'stance': null, 'reaction': true,
      'let': {
        'inhale': ['bump', 0, 0.42],
        'sag': ['win', 0.36, 0.62, 0.95, 1.4, 'easeOutCubic'],
        'soft': ['win', 0.38, 0.58, 0.86, 1.1],
        'warm': ['win', 0.86, 1.04, 1.2, 1.4],
      },
      'y': ['+', ['k', -1.6, ['ref', 'inhale']], ['k', 2.4, ['ref', 'sag']]],
      'squash': ['+', ['k', 0.04, ['ref', 'inhale']], ['k', -0.05, ['ref', 'sag']]],
      'tilt': ['k', -0.02, ['ref', 'sag']],
      'arms': {
        'angle': ['+', ['k', -0.12, ['ref', 'sag']], ['k', 0.12, ['ref', 'inhale']]],
        'bend': ['k', -0.1, ['ref', 'sag']],
      },
      'eyes': {'open': {'mul': ['1-', ['k', 0.82, ['ref', 'soft']]]}, 'smile': {'max': ['k', 0.8, ['ref', 'warm']]}},
      'lookY': ['+', ['k', -0.3, ['ref', 'inhale']], ['k', 0.3, ['ref', 'sag']]],
      'antenna': ['k', 0.22, ['ref', 'sag']],
      'key': {'at': 0.95},
    },
    'walk': {'seconds': 1.0, 'stance': 'stand', 'reaction': true, 'overlay': 'walk', 'key': {'overlay': 'walk', 'at': 0.18, 'len': 10}},

    // ---- v2 (15 Oct 2026, the quality pass) -------------------------------------------------

    // A small happy hop on the spot: a crouch, a stretch up with the mittens swinging, a tucked
    // flight, a squash on landing and a little rebound. Smaller than cheer. Gated as a
    // celebration (a nod under Quiet, nothing under Off).
    'hop': {
      'seconds': 0.8, 'stance': null, 'reaction': true,
      'let': {
        'crouch': ['bump', 0, 0.17],
        'air': ['hop', 0.14, 0.5, 15],
        'land': ['bump', 0.48, 0.64],
        'rebound': ['bump', 0.64, 0.8],
        'swing': ['bump', 0.1, 0.52],
        'tuck': ['bump', 0.16, 0.48],
        'happy': ['win', 0.12, 0.22, 0.6, 0.78],
      },
      'y': ['+', ['k', 3, ['ref', 'crouch']], ['ref', 'air'], ['k', 2.2, ['ref', 'land']], ['k', -0.7, ['ref', 'rebound']]],
      'squash': ['+', ['k', -0.08, ['ref', 'crouch']], ['k', 0.075, ['bump', 0.12, 0.3]], ['k', -0.075, ['ref', 'land']], ['k', 0.02, ['ref', 'rebound']]],
      // The mittens swing up and in at the elbow (never out wide), then drop a little on landing.
      'arms': {
        'angle': ['+', ['k', 0.32, ['ref', 'swing']], ['k', -0.1, ['ref', 'land']]],
        'bend': ['k', 0.45, ['ref', 'swing']],
        'reach': ['k', -0.14, ['ref', 'swing']],
      },
      'eyes': {'happy': {'max': ['ref', 'happy']}},
      'lookX': {'to': 0, 'w': ['ref', 'happy']},
      'lookY': {'to': 0, 'w': ['ref', 'happy'], 'add': ['k', -0.15, ['ref', 'swing']]},
      'glow': ['k', 0.45, ['bump', 0.14, 0.7]],
      'bootL': {
        'dx': ['+', ['k', 1.6, ['ref', 'tuck']], ['k', -1.6, ['ref', 'land']]],
        'dy': ['k', 0.9, ['ref', 'air']],
        'rot': ['+', ['k', -0.2, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'bootR': {
        'dx': ['+', ['k', -1.6, ['ref', 'tuck']], ['k', 1.6, ['ref', 'land']]],
        'dy': ['k', 0.9, ['ref', 'air']],
        'rot': ['+', ['k', -0.2, ['ref', 'tuck']], ['k', 0.06, ['ref', 'land']]],
      },
      'key': {'at': 0.3, 'set': {'y': -5, 'bootL': {'dy': -4}, 'bootR': {'dy': -4}}},
    },

    // Curious: a double take (the eyes dart away and back), then a lean in toward what caught
    // his eye with the far eye opening wider, the antenna perking toward it and the bulb
    // flickering on. Returns to the stance it was played from.
    'curious': {
      'seconds': 1.4, 'stance': null, 'reaction': true,
      'let': {
        'side': ['step', ['base', 'lookX'], -0.1],
        'dart': ['+', ['k', -0.55, ['bump', 0.04, 0.24]], ['k', 0.4, ['bump', 0.24, 0.44]]],
        'lean': ['win', 0.42, 0.68, 1.08, 1.4, 'easeOutBack'],
        'dip': ['bump', 0.3, 0.46],
      },
      'tilt': ['+', ['*', 0.11, ['ref', 'side'], ['ref', 'lean']], ['k', -0.02, ['ref', 'dip']]],
      'x': ['*', 3, ['ref', 'side'], ['ref', 'lean']],
      'y': ['+', ['k', 1.4, ['ref', 'dip']], ['k', -1.2, ['ref', 'lean']]],
      'squash': ['+', ['k', -0.03, ['ref', 'dip']], ['k', 0.025, ['ref', 'lean']]],
      'eyeL': {'open': {'mul': ['+', 1, ['k', 0.06, ['ref', 'lean']]]}, 'lid': {'mul': ['1-', ['ref', 'lean']]}},
      'eyeR': {'open': {'mul': ['+', 1, ['k', 0.24, ['ref', 'lean']]]}, 'lid': {'mul': ['1-', ['ref', 'lean']]}},
      'lookX': ['+', ['*', ['ref', 'dart'], ['1-', ['ref', 'lean']]], ['*', 0.3, ['ref', 'side'], ['ref', 'lean']]],
      'lookY': ['k', -0.3, ['ref', 'lean']],
      'antenna': ['*', -0.26, ['ref', 'side'], ['ref', 'lean']],
      'arms': {'angle': ['k', 0.1, ['ref', 'lean']], 'bend': ['k', -0.1, ['ref', 'lean']]},
      'glow': ['k', 0.32, ['bump', 0.5, 1.25]],
      'key': {'at': 0.9},
    },

    // Focused: a breath in, then he settles: lids level and lowered, eyes steady and centred a
    // touch down, fists drawn in, the bulb on. Pair with the focused mood to hold the face.
    // Returns to the stance it was played from.
    'focus': {
      'seconds': 1.1, 'stance': null, 'reaction': true,
      'let': {
        'inhale': ['bump', 0, 0.3],
        'lock': ['win', 0.18, 0.42, 0.78, 1.1, 'easeOutCubic'],
        'nod': ['bump', 0.42, 0.62],
      },
      'squash': ['+', ['k', 0.028, ['ref', 'inhale']], ['k', -0.02, ['ref', 'lock']], ['k', -0.015, ['ref', 'nod']]],
      'y': ['+', ['k', -1, ['ref', 'inhale']], ['k', 0.9, ['ref', 'lock']], ['k', 1.2, ['ref', 'nod']]],
      'tilt': ['k', 0.02, ['ref', 'lock']],
      'arms': {'to': 'fist', 'w': ['k', 0.6, ['ref', 'lock']]},
      'eyes': {
        'lid': {'max': ['k', 0.3, ['ref', 'lock']]},
        'slant': ['k', -0.07, ['ref', 'lock']],
      },
      'lookX': {'to': 0, 'w': ['ref', 'lock']},
      'lookY': {'to': 0.12, 'w': ['ref', 'lock']},
      'glow': ['k', 0.4, ['ref', 'lock']],
      'antenna': ['k', -0.1, ['ref', 'lock']],
      'key': {'at': 0.62},
    },

    // Sympathy after a miss: the eyes soften (a gentle slope with a warm lower lid), the head
    // tilts kindly, a mitten comes to the chest with two small pats, one slow nod. Never sad,
    // never at the student. Returns to the stance it was played from.
    'sympathy': {
      'seconds': 1.8, 'stance': null, 'reaction': true,
      'let': {
        'soft': ['win', 0.06, 0.36, 1.35, 1.8],
        'hand': ['win', 0.14, 0.44, 1.2, 1.7, 'easeOutBack'],
        'pats': ['+', ['bump', 0.56, 0.72], ['k', 0.8, ['bump', 0.76, 0.92]]],
        'nod': ['bump', 0.95, 1.3],
      },
      'tilt': ['+', ['k', -0.08, ['ref', 'soft']], ['k', 0.01, ['ref', 'nod']]],
      'x': ['k', -1.5, ['ref', 'soft']],
      'y': ['+', ['k', 1.1, ['ref', 'soft']], ['k', 1.6, ['ref', 'nod']]],
      'squash': ['+', ['k', -0.015, ['ref', 'soft']], ['k', -0.02, ['ref', 'nod']]],
      'armL': {'to': 'heart', 'w': ['ref', 'hand'], 'angle': ['k', 0.1, ['ref', 'pats']], 'reach': ['k', -0.04, ['ref', 'pats']]},
      'armR': {'angle': ['k', -0.06, ['ref', 'soft']]},
      'eyes': {
        'slant': ['k', 0.58, ['ref', 'soft']],
        'smile': {'max': ['k', 0.2, ['ref', 'soft']]},
      },
      'lookX': {'to': 0, 'w': ['ref', 'soft']},
      'lookY': {'to': 0.06, 'w': ['ref', 'soft'], 'add': ['k', 0.25, ['ref', 'nod']]},
      'antenna': ['k', 0.16, ['ref', 'soft']],
      'key': {'at': 0.9},
    },

    // An idea: a small dip as he works it out, then the bulb flashes, the eyes pop wide, one
    // finger shoots up with a little hop, and the eyes turn happy. Ends standing.
    'idea': {
      'seconds': 1.35, 'stance': 'stand', 'reaction': true,
      'let': {
        'antic': ['bump', 0, 0.2],
        'air': ['hop', 0.2, 0.46, 7],
        'land': ['bump', 0.44, 0.6],
        'finger': ['win', 0.16, 0.34, 0.98, 1.35, 'easeOutBack'],
        'pop': ['win', 0.18, 0.26, 0.42, 0.56, 'easeOut'],
        'happy': ['win', 0.52, 0.64, 1.05, 1.3],
        'flash': ['win', 0.18, 0.24, 0.85, 1.3, 'easeOut'],
        'up': ['win', 0.2, 0.3, 0.7, 0.9],
      },
      // The arm sweeps up short and stretches only once it is overhead (as the waves do), so the
      // finger never swings out past the paint box.
      'armR': {
        'to': 'fingerUp', 'w': ['ref', 'finger'], 'keep': ['reach'],
        'reach': {'to': 1.16, 'w': ['pow', ['ref', 'finger'], 2.6], 'add': ['k', -0.3, ['dip', ['ref', 'finger']]]},
      },
      'armL': {'angle': ['k', 0.18, ['ref', 'antic']]},
      'x': ['k', -6, ['ref', 'finger']],
      'tilt': ['+', ['k', -0.03, ['ref', 'finger']], ['k', -0.03, ['ref', 'antic']]],
      'y': ['+', ['k', 2.2, ['ref', 'antic']], ['ref', 'air'], ['k', 1.6, ['ref', 'land']]],
      'squash': ['+', ['k', -0.05, ['ref', 'antic']], ['k', 0.06, ['bump', 0.18, 0.36]], ['k', -0.05, ['ref', 'land']]],
      'eyes': {
        'open': {'to': 1.24, 'w': ['ref', 'pop'], 'mul': ['1-', ['k', 0.35, ['ref', 'antic']]]},
        'happy': {'max': ['ref', 'happy']},
      },
      'lookX': {'to': 0.2, 'w': ['ref', 'up']},
      'lookY': {'to': -0.8, 'w': ['ref', 'up']},
      'glow': ['ref', 'flash'],
      'glint': {'set': ['span', 0.22, 0.72]},
      'boots': {'dy': ['k', 0.85, ['ref', 'air']]},
      'key': {'at': 0.62},
    },
  },

  // ---- Overlays (played on top of acts, or by the idle) ------------------------------------
  'overlays': {
    // Talking at strength w (fades in and out with the line). The free arm gestures.
    'talk': {
      'let': {
        'beat': ['abs', ['osc', 1.7, 0]],
        'syll': ['osc', 0.85, -0.11234466571192613],
        'g': ['pow', ['pos', ['osc', 0.62, 0.10268060844638409]], 2],
      },
      'y': ['*', -1.5, ['ref', 'beat'], ['ref', 'w']],
      'squash': ['*', 0.016, ['ref', 'beat'], ['ref', 'w']],
      'tilt': ['*', 0.025, ['ref', 'syll'], ['ref', 'w']],
      'eyes': {'open': {'mul': ['1-', ['*', 0.1, ['ref', 'beat'], ['ref', 'w']]]}},
      'armR': {
        'when': 'free',
        'angle': ['*', 0.75, ['ref', 'g'], ['ref', 'w']],
        'bend': ['*', -0.4, ['ref', 'g'], ['ref', 'w']],
        'twist': ['*', -0.4, ['ref', 'g'], ['ref', 'w']],
      },
    },
    // Walking a trip of len seconds: a bob each step, boots lifting in turn, mittens swinging
    // against them. Eases in and out, so it starts and ends standing. One step is 0.36 s.
    'walk': {
      'let': {
        'w': ['*', ['ease', 0, 0.18], ['1-', ['ease', ['max', 0.2, ['+', ['ref', 'len'], -0.2]], ['max', 0.21, ['ref', 'len']]]]],
        'step': ['osc', 1.3888888888888888, 0],
        'bob': ['abs', ['ref', 'step']],
        'liftL': ['*', ['pos', ['ref', 'step']], ['ref', 'w']],
        'liftR': ['*', ['pos', ['k', -1, ['ref', 'step']]], ['ref', 'w']],
      },
      'y': ['*', -2.6, ['ref', 'bob'], ['ref', 'w']],
      'squash': ['+', ['*', 0.02, ['ref', 'bob'], ['ref', 'w']], ['*', -0.015, ['1-', ['ref', 'bob']], ['ref', 'w']]],
      'tilt': ['*', 0.03, ['ref', 'step'], ['ref', 'w']],
      'bootL': {'dy': ['k', -4, ['ref', 'liftL']], 'rot': ['k', 0.22, ['ref', 'liftL']]},
      'bootR': {'dy': ['k', -4, ['ref', 'liftR']], 'rot': ['k', 0.22, ['ref', 'liftR']]},
      'armL': {'angle': ['*', 0.32, ['ref', 'step'], ['ref', 'w']]},
      'armR': {'angle': ['*', -0.32, ['ref', 'step'], ['ref', 'w']]},
      'antenna': ['*', -0.1, ['ref', 'step'], ['ref', 'w']],
    },
    // The loading scan, t seconds into the stance at strength w.
    'loading': {
      'let': {
        'scan': ['osc', 0.5882352941176471, 0],
        'pulse': ['+', 0.5, ['k', 0.5, ['osc', 1.1764705882352942, 0]]],
      },
      'lookX': ['*', 0.62, ['ref', 'scan'], ['ref', 'w']],
      'lookY': ['*', 0.12, ['1-', ['abs', ['ref', 'scan']]], ['ref', 'w']],
      'glow': ['*', 0.45, ['ref', 'pulse'], ['ref', 'w']],
      'tilt': ['*', 0.018, ['osc', 0.29411764705882354, 0], ['ref', 'w']],
      'y': ['*', -0.8, ['abs', ['ref', 'scan']], ['ref', 'w']],
    },
    // One listening nod (0.7 s).
    'listenNod': {
      'y': ['+', ['k', 1.6, ['bump', 0, 0.32]], ['k', 0.9, ['bump', 0.32, 0.6]]],
      'lookY': ['+', ['k', 0.24, ['bump', 0, 0.32]], ['k', 0.12, ['bump', 0.32, 0.6]]],
      'tilt': ['k', -0.015, ['bump', 0, 0.6]],
    },
    // A tap on Mobi (0.45 s) from side -1 to 1: squashes away, blinks happily, springs back.
    'boop': {
      'let': {'hit': ['bump', 0, 0.18], 'back': ['bump', 0.14, 0.42], 'happy': ['bump', 0.02, 0.4]},
      'squash': ['+', ['k', -0.085, ['ref', 'hit']], ['k', 0.04, ['ref', 'back']]],
      'y': ['+', ['k', 2, ['ref', 'hit']], ['k', -0.8, ['ref', 'back']]],
      'tilt': ['*', ['ref', 'side'], ['+', ['k', -0.05, ['ref', 'hit']], ['k', 0.02, ['ref', 'back']]]],
      'eyes': {'happy': {'max': ['ref', 'happy']}},
    },
    // Idle fidgets (1.3 s each), standing at ease.
    'fidgetSmile': {
      'let': {
        'w': ['win', 0, 0.22, 1.0, 1.3, 'easeOut'],
        'nod': ['+', ['bump', 0.2, 0.6], ['k', 0.55, ['bump', 0.6, 0.95]]],
      },
      'lookX': {'to': 0, 'w': ['ref', 'w']},
      'lookY': {'to': 0, 'w': ['ref', 'w'], 'add': ['k', 0.3, ['ref', 'nod']]},
      'eyes': {'smile': {'max': ['k', 0.8, ['ref', 'w']]}},
      'y': ['k', 2.8, ['ref', 'nod']],
      'squash': ['k', -0.03, ['ref', 'nod']],
      'tilt': ['k', 0.04, ['bump', 0.1, 1.2]],
    },
    'fidgetShift': {
      'let': {
        'shift': ['win', 0, 0.4, 0.85, 1.3],
        'tap': ['+', ['bump', 0.38, 0.62], ['k', 0.8, ['bump', 0.62, 0.84]]],
      },
      'x': ['k', 3, ['ref', 'shift']],
      'tilt': ['k', 0.06, ['ref', 'shift']],
      'squash': ['k', -0.02, ['ref', 'shift']],
      'bootL': {'rot': ['k', 0.5, ['ref', 'tap']], 'dy': ['k', -4.2, ['ref', 'tap']], 'dx': ['k', 1.5, ['ref', 'tap']]},
      'lookX': ['k', -0.4, ['ref', 'shift']],
      'lookY': ['k', 0.25, ['ref', 'shift']],
    },
    'fidgetFlick': {
      'let': {'dip': ['bump', 0, 0.16]},
      'y': ['+', ['k', 1.8, ['ref', 'dip']], ['k', -1, ['bump', 0.16, 0.4]]],
      'squash': ['+', ['k', -0.03, ['ref', 'dip']], ['k', 0.015, ['bump', 0.16, 0.4]]],
      'antenna': ['+', ['k', 0.6, ['bump', 0.06, 0.38]], ['k', -0.42, ['bump', 0.38, 0.72]], ['k', 0.2, ['bump', 0.72, 1.0]]],
      'glow': ['k', 0.7, ['bump', 0.1, 0.9]],
      'lookX': ['k', 0.45, ['bump', 0.12, 1.1]],
      'lookY': ['k', -0.85, ['bump', 0.12, 1.1]],
    },
    // Micro-fidgets (0.8 s each) between the longer ones.
    'microGlance': {
      'let': {'w': ['win', 0, 0.1, 0.55, 0.7, 'easeOut', 'easeOut']},
      'lookX': {'to': 0.6, 'w': ['ref', 'w']},
      'lookY': {'to': -0.1, 'w': ['ref', 'w']},
      'tilt': ['k', 0.012, ['ref', 'w']],
    },
    'microAntenna': {
      'antenna': ['+', ['k', 0.3, ['bump', 0, 0.22]], ['k', -0.16, ['bump', 0.22, 0.46]], ['k', 0.06, ['bump', 0.46, 0.66]]],
      'glow': ['k', 0.35, ['bump', 0.04, 0.5]],
    },
  },

  // ---- The idle (timings; random draws are uniform u in [0, 1)) ---------------------------
  'idle': {
    'loadingScanSeconds': 12,
    'fidgetSeconds': 1.3,
    'fidgetKinds': ['fidgetSmile', 'fidgetShift', 'fidgetFlick'],
    'microSeconds': 0.8,
    'microKinds': ['microGlance', 'microAntenna'],
    'stepSeconds': 0.36,
    'boopSeconds': 0.45,
    'listenNodSeconds': 0.7,
    'carrySeconds': 0.16,
    // Breath: a raised-cosine swell of length `seconds` (by stance), then a rest.
    'breath': {
      'firstWait': [1.2, 0.8],
      'seconds': {'sleep': [4.8, 0.6], 'sleepy': [4.2, 0], 'rest': [3.8, 0], 'other': [3.0, 0.6]},
      'deep': {'sleep': 2.1, 'sleepy': 1.6, 'other': 1.0},
      'rest': {'sleepy': [0.3, 0.5], 'sleep': [0.3, 0.5], 'other': [0.5, 1.4]},
      'swell': {'squash': 0.014, 'y': -0.9, 'armAngle': 0.035, 'antennaAsleep': -0.08},
    },
    // Blink: closes in 55 ms (easeIn), stays shut 30 ms, opens in 115 ms (easeOut); a double
    // blink 6 ms apart one time in five. The right eye trails the left by 12 ms. Never asleep.
    'blink': {
      'firstWait': [1.6, 2.0],
      'close': 0.055, 'shut': 0.03, 'open': 0.115, 'gapBetweenDouble': 0.06,
      'doubleChance': 0.2,
      'shutTo': 0.06,
      'trail': 0.012,
      'gap': {'base': 2.4, 'squaredSpread': 2.2, 'longStareChance': 0.15, 'longStare': 2.5},
      'withGazeShiftOver': 0.75,
    },
    // Glances: eyes flick to a point (`in` s, easeOut), hold, flick back (`out` s, easeOut);
    // sometimes the weight leans with them (easeInOutCubic over leanIn, leanOut).
    'glance': {
      'in': 0.12, 'out': 0.14, 'leanIn': 0.45, 'leanOut': 0.5,
      'firstWait': [4.5, 4.0],
      'hold': [0.7, 0.9],
      'x': [0.45, 0.45], 'y': [-0.45, 0.8],
      'leanChance': 0.45, 'lean': 0.022,
      'blinkChance': 0.4,
      'gap': [4, 5],
    },
    // Micro-saccades (v2): small fixational darts of the eyes standing at ease, so a still
    // Mobi's gaze is never frozen. Offsets are added to where he looks.
    'saccade': {
      'firstWait': [0.9, 0.8],
      'gap': [0.7, 1.5],
      'x': 0.1, 'y': 0.06,
      'homeChance': 0.35,
    },
    'listenNodGap': [2.6, 2.2],
    'listenFirstWait': [2.4, 1.6],
    'fidgetFirstWait': [9, 6],
    'fidgetGap': [12, 10],
    'fidgetRetry': 1.5,
    'microFirstWait': [6, 3],
    'microGap': [6, 3],
  },

  // ---- Springs (secondary motion, integrated at 1/120 s steps) -----------------------------
  'springs': {
    // The antenna is a weight on a whip, driven by the body's acceleration.
    'antenna': {'k': 190, 'c': 5.2, 'fromAx': -0.0016, 'fromAy': 0.00075, 'fromTilt': -0.05, 'torqueClamp': 400, 'clamp': 0.75},
    // The eyes glide to where they look.
    'eyes': {'k': 520, 'c': 34, 'leanToTarget': 0.03},
    // v2: follow-through on the arms: each arm's angle overshoots and settles after a swing,
    // and the mitten flops (twist) a little behind it.
    'arms': {'k': 210, 'c': 12, 'gain': 0.3, 'twistGain': 0.9, 'accelClamp': 120, 'clamp': 0.22, 'twistClamp': 0.4},
    // v2: the paper body jiggles after a landing (driven by the body's vertical acceleration).
    'jiggle': {'k': 420, 'c': 13, 'gain': 0.006, 'accelClamp': 2500, 'clamp': 0.045},
  },

  // ---- Paint (v2): what the painter derives from the rig ------------------------------------
  'paint': {
    // Lids follow the gaze down (as real lids do): lid = max(lid, k * clamp(lookY - from, 0, 1)).
    'lidFollow': {'from': 0.45, 'k': 0.22},
    // Small sizes: below `fullAt` px per design unit the eyes grow (up to `eyeGrow`) and their
    // strokes thicken (up to `strokeGrow`) until `maxAt`, so every face reads at 32 dp.
    'legibility': {'fullAt': 0.42, 'maxAt': 0.2, 'eyeGrow': 0.34, 'strokeGrow': 0.6, 'travelShrink': 0.22},
  },
};
