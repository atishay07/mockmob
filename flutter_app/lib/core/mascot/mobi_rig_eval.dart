import 'dart:math' as math;
import 'dart:typed_data';

import 'mobi_rig.dart';
import 'mobi_rig_data.dart';

/// The rig table ([mobiRigSpec]) compiled once into closures, so a frame evaluates without
/// parsing anything. The rules are the ones written at the top of `mobi_rig_data.dart`; the
/// website evaluates the JSON export of the same table by the same rules.
class MobiBook {
  MobiBook._(this.spec) {
    final curves = spec['curves']! as Map<String, Object?>;
    for (final e in curves.entries) {
      final v = e.value;
      _curves[e.key] = v == null ? const MobiCubic.linear() : MobiCubic.fromList(v as List<Object?>);
    }
    final arms = spec['arms']! as Map<String, Object?>;
    for (final e in arms.entries) {
      _arms[e.key] = armOf(e.value);
    }
    final acts = spec['acts']! as Map<String, Object?>;
    for (final e in acts.entries) {
      _programs['act:${e.key}'] = MobiProgram._compile(this, e.value! as Map<String, Object?>);
    }
    final overlays = spec['overlays']! as Map<String, Object?>;
    for (final e in overlays.entries) {
      _programs['overlay:${e.key}'] = MobiProgram._compile(this, e.value! as Map<String, Object?>);
    }
  }

  /// The table, as data.
  final Map<String, Object?> spec;

  final Map<String, MobiCubic> _curves = {};
  final Map<String, MobiArm> _arms = {};
  final Map<String, MobiProgram> _programs = {};

  /// The one compiled book.
  static final MobiBook instance = MobiBook._(normalize(mobiRigSpec)! as Map<String, Object?>);

  /// [v] with every map typed `Map<String, Object?>` and every list `List<Object?>` (a const
  /// literal's empty `{}` is otherwise a `Map<dynamic, dynamic>`).
  static Object? normalize(Object? v) {
    if (v is Map) return <String, Object?>{for (final e in v.entries) e.key as String: normalize(e.value)};
    if (v is List) return <Object?>[for (final x in v) normalize(x)];
    return v;
  }

  /// The curve named [name].
  MobiCubic curve(String name) => _curves[name] ?? (throw ArgumentError('Mobi rig: no curve "$name"'));

  /// The named arm [name].
  MobiArm namedArm(String name) => _arms[name] ?? (throw ArgumentError('Mobi rig: no arm "$name"'));

  /// The program of act [name], or null when the act has no motion of its own.
  MobiProgram? act(String name) => _programs['act:$name'];

  /// The program of overlay [name].
  MobiProgram overlay(String name) => _programs['overlay:$name'] ?? (throw ArgumentError('Mobi rig: no overlay "$name"'));

  /// The act spec of [name].
  Map<String, Object?> actSpec(String name) => (spec['acts']! as Map<String, Object?>)[name]! as Map<String, Object?>;

  /// A section of the table.
  Map<String, Object?> section(String name) => spec[name]! as Map<String, Object?>;

  // ---- Values ------------------------------------------------------------------------------

  static double _d(Object? v, [double fallback = 0]) => v == null ? fallback : (v as num).toDouble();

  static const Map<String, double> _armDefaults = {'angle': 0, 'bend': 0.25, 'twist': 0, 'front': 0, 'point': 0, 'reach': 1};

  /// An arm from a name or a map (missing fields take the arm defaults).
  MobiArm armOf(Object? v) {
    if (v is String) return namedArm(v);
    final m = (v as Map<String, Object?>?) ?? const {};
    double f(String k) => _d(m[k], _armDefaults[k]!);
    return MobiArm(angle: f('angle'), bend: f('bend'), twist: f('twist'), front: f('front'), point: f('point'), reach: f('reach'));
  }

  static MobiEye eyeOf(Object? v) {
    final m = (v as Map<String, Object?>?) ?? const {};
    return MobiEye(open: _d(m['open'], 1), happy: _d(m['happy']), lid: _d(m['lid']), smile: _d(m['smile']), slant: _d(m['slant']));
  }

  static MobiBoot bootOf(Object? v) {
    final m = (v as Map<String, Object?>?) ?? const {};
    return MobiBoot(dx: _d(m['dx']), dy: _d(m['dy']), rot: _d(m['rot']));
  }

  /// A rig from a stance-style map: scalars, eyes, arms and boots, each falling back to the rig
  /// defaults (the arms to the standing arms).
  MobiRig rigOf(Map<String, Object?> m) {
    const d = MobiRig();
    return MobiRig(
      x: _d(m['x']),
      y: _d(m['y']),
      tilt: _d(m['tilt']),
      squash: _d(m['squash']),
      lookX: _d(m['lookX']),
      lookY: _d(m['lookY']),
      antenna: _d(m['antenna']),
      burst: _d(m['burst'], -1),
      zzz: _d(m['zzz'], -1),
      sheet: _d(m['sheet']),
      glow: _d(m['glow']),
      glint: _d(m['glint'], -1),
      sparkle: _d(m['sparkle'], -1),
      bubble: _d(m['bubble'], -1),
      eyeL: eyeOf(m['eyeL']),
      eyeR: eyeOf(m['eyeR']),
      armL: m.containsKey('armL') ? armOf(m['armL']) : d.armL,
      armR: m.containsKey('armR') ? armOf(m['armR']) : d.armR,
      bootL: bootOf(m['bootL']),
      bootR: bootOf(m['bootR']),
    );
  }

  /// [r] with the fields of a `set` map replaced (scalars, or whole eyes, arms and boots).
  MobiRig setOver(MobiRig r, Map<String, Object?> m) {
    double s(String k, double v) => m.containsKey(k) ? _d(m[k]) : v;
    return MobiRig(
      x: s('x', r.x),
      y: s('y', r.y),
      tilt: s('tilt', r.tilt),
      squash: s('squash', r.squash),
      lookX: s('lookX', r.lookX),
      lookY: s('lookY', r.lookY),
      antenna: s('antenna', r.antenna),
      burst: s('burst', r.burst),
      zzz: s('zzz', r.zzz),
      sheet: s('sheet', r.sheet),
      glow: s('glow', r.glow),
      glint: s('glint', r.glint),
      sparkle: s('sparkle', r.sparkle),
      bubble: s('bubble', r.bubble),
      eyeL: m.containsKey('eyeL') ? eyeOf(m['eyeL']) : r.eyeL,
      eyeR: m.containsKey('eyeR') ? eyeOf(m['eyeR']) : r.eyeR,
      armL: m.containsKey('armL') ? armOf(m['armL']) : r.armL,
      armR: m.containsKey('armR') ? armOf(m['armR']) : r.armR,
      bootL: m.containsKey('bootL') ? bootOf(m['bootL']) : r.bootL,
      bootR: m.containsKey('bootR') ? bootOf(m['bootR']) : r.bootR,
    );
  }
}

/// Flutter's cubic curve, evaluated the same way (bisection to 0.001), so the website can match
/// it number for number.
class MobiCubic {
  const MobiCubic(this.a, this.b, this.c, this.d) : linear = false;
  const MobiCubic.linear()
      : a = 0,
        b = 0,
        c = 1,
        d = 1,
        linear = true;

  factory MobiCubic.fromList(List<Object?> v) =>
      MobiCubic((v[0]! as num).toDouble(), (v[1]! as num).toDouble(), (v[2]! as num).toDouble(), (v[3]! as num).toDouble());

  final double a, b, c, d;
  final bool linear;

  static double _cubic(double a, double b, double m) => 3 * a * (1 - m) * (1 - m) * m + 3 * b * (1 - m) * m * m + m * m * m;

  double transform(double t) {
    if (t == 0 || t == 1 || linear) return t;
    var start = 0.0;
    var end = 1.0;
    while (true) {
      final mid = (start + end) / 2;
      final estimate = _cubic(a, c, mid);
      if ((t - estimate).abs() < 0.001) return _cubic(b, d, mid);
      if (estimate < t) {
        start = mid;
      } else {
        end = mid;
      }
    }
  }
}

/// What a program reads while it runs: the time, the base rig, the parameters and its `let`s.
class _Env {
  double t = 0;
  MobiRig base = const MobiRig();
  double w = 1;
  double len = 1;
  double side = 0;
  Float64List vars = Float64List(0);
}

typedef _Fn = double Function(_Env e);

/// One channel: to + w, mul, add, max, set (in that order).
class _Chan {
  _Chan({this.to, this.w, this.mul, this.add, this.max, this.set});

  final _Fn? to, w, mul, add, max, set;

  double apply(double v, _Env e) {
    final s = set;
    if (s != null) {
      // A set wins, but the earlier steps never matter to it.
      return s(e);
    }
    final toF = to;
    if (toF != null) v += (toF(e) - v) * w!(e);
    final m = mul;
    if (m != null) v *= m(e);
    final a = add;
    if (a != null) v += a(e);
    final mx = max;
    if (mx != null) v = math.max(v, mx(e));
    return v;
  }
}

class _EyeOps {
  _EyeOps(this.open, this.happy, this.lid, this.smile, this.slant);
  final _Chan? open, happy, lid, smile, slant;

  MobiEye apply(MobiEye x, _Env e) => MobiEye(
        open: open?.apply(x.open, e) ?? x.open,
        happy: happy?.apply(x.happy, e) ?? x.happy,
        lid: lid?.apply(x.lid, e) ?? x.lid,
        smile: smile?.apply(x.smile, e) ?? x.smile,
        slant: slant?.apply(x.slant, e) ?? x.slant,
      );
}

class _ArmOps {
  _ArmOps({required this.to, required this.w, required this.keep, required this.when, required this.ch});
  final MobiArm? to;
  final _Fn? w;
  final Set<String> keep;
  final String? when;
  final Map<String, _Chan> ch;

  MobiArm apply(MobiArm a, _Env e) {
    if (when == 'free' && !(a.front < 0.5 && a.point < 0.5)) return a;
    if (when == 'pointing' && a.point < 0.5) return a;
    var r = a;
    final target = to;
    if (target != null) {
      final k = w!(e);
      double l(String f, double from, double into) => keep.contains(f) ? from : from + (into - from) * k;
      r = MobiArm(
        angle: l('angle', a.angle, target.angle),
        bend: l('bend', a.bend, target.bend),
        twist: l('twist', a.twist, target.twist),
        front: l('front', a.front, target.front),
        point: l('point', a.point, target.point),
        reach: l('reach', a.reach, target.reach),
      );
    }
    if (ch.isEmpty) return r;
    return MobiArm(
      angle: ch['angle']?.apply(r.angle, e) ?? r.angle,
      bend: ch['bend']?.apply(r.bend, e) ?? r.bend,
      twist: ch['twist']?.apply(r.twist, e) ?? r.twist,
      front: ch['front']?.apply(r.front, e) ?? r.front,
      point: ch['point']?.apply(r.point, e) ?? r.point,
      reach: ch['reach']?.apply(r.reach, e) ?? r.reach,
    );
  }
}

class _BootOps {
  _BootOps(this.dx, this.dy, this.rot);
  final _Chan? dx, dy, rot;

  MobiBoot apply(MobiBoot b, _Env e) =>
      MobiBoot(dx: dx?.apply(b.dx, e) ?? b.dx, dy: dy?.apply(b.dy, e) ?? b.dy, rot: rot?.apply(b.rot, e) ?? b.rot);
}

/// One compiled act or overlay.
class MobiProgram {
  MobiProgram._(this._env, this._lets, this._scalars, this._eyes, this._eyeL, this._eyeR, this._arms, this._armL, this._armR, this._boots,
      this._bootL, this._bootR);

  static const List<String> scalarFields = [
    'x', 'y', 'tilt', 'squash', 'lookX', 'lookY', 'antenna', //
    'burst', 'zzz', 'sheet', 'glow', 'glint', 'sparkle', 'bubble',
  ];

  final _Env _env;
  final List<_Fn> _lets;
  final List<_Chan?> _scalars;
  final _EyeOps? _eyes, _eyeL, _eyeR;
  final _ArmOps? _arms, _armL, _armR;
  final _BootOps? _boots, _bootL, _bootR;

  /// Whether the program moves anything at all.
  bool get isEmpty =>
      _scalars.every((c) => c == null) &&
      _eyes == null &&
      _eyeL == null &&
      _eyeR == null &&
      _arms == null &&
      _armL == null &&
      _armR == null &&
      _boots == null &&
      _bootL == null &&
      _bootR == null;

  /// [base] at [t] seconds in, with strength [w], trip length [len] and tap side [side].
  MobiRig run(double t, MobiRig base, {double w = 1, double len = 1, double side = 0}) {
    final e = _env
      ..t = t
      ..base = base
      ..w = w
      ..len = len
      ..side = side;
    for (var i = 0; i < _lets.length; i++) {
      e.vars[i] = _lets[i](e);
    }
    double s(int i, double v) => _scalars[i]?.apply(v, e) ?? v;
    var eyeL = base.eyeL;
    var eyeR = base.eyeR;
    final both = _eyes;
    if (both != null) {
      eyeL = both.apply(eyeL, e);
      eyeR = both.apply(eyeR, e);
    }
    eyeL = _eyeL?.apply(eyeL, e) ?? eyeL;
    eyeR = _eyeR?.apply(eyeR, e) ?? eyeR;
    var armL = base.armL;
    var armR = base.armR;
    final arms = _arms;
    if (arms != null) {
      armL = arms.apply(armL, e);
      armR = arms.apply(armR, e);
    }
    armL = _armL?.apply(armL, e) ?? armL;
    armR = _armR?.apply(armR, e) ?? armR;
    var bootL = base.bootL;
    var bootR = base.bootR;
    final boots = _boots;
    if (boots != null) {
      bootL = boots.apply(bootL, e);
      bootR = boots.apply(bootR, e);
    }
    bootL = _bootL?.apply(bootL, e) ?? bootL;
    bootR = _bootR?.apply(bootR, e) ?? bootR;
    return MobiRig(
      x: s(0, base.x),
      y: s(1, base.y),
      tilt: s(2, base.tilt),
      squash: s(3, base.squash),
      lookX: s(4, base.lookX),
      lookY: s(5, base.lookY),
      antenna: s(6, base.antenna),
      burst: s(7, base.burst),
      zzz: s(8, base.zzz),
      sheet: s(9, base.sheet),
      glow: s(10, base.glow),
      glint: s(11, base.glint),
      sparkle: s(12, base.sparkle),
      bubble: s(13, base.bubble),
      eyeL: eyeL,
      eyeR: eyeR,
      armL: armL,
      armR: armR,
      bootL: bootL,
      bootR: bootR,
    );
  }

  // ---- Compiling ---------------------------------------------------------------------------

  static MobiProgram _compile(MobiBook book, Map<String, Object?> spec) {
    final env = _Env();
    final names = <String, int>{};
    final lets = <_Fn>[];
    final c = _Compiler(book, env, names);
    final let = spec['let'] as Map<String, Object?>?;
    if (let != null) {
      for (final e in let.entries) {
        // A let may read the lets before it.
        lets.add(c.expr(e.value));
        names[e.key] = lets.length - 1;
      }
    }
    env.vars = Float64List(lets.length);
    final scalars = [for (final f in scalarFields) spec.containsKey(f) ? c.chan(spec[f]) : null];
    _EyeOps? eyes(String k) {
      final m = spec[k] as Map<String, Object?>?;
      if (m == null) return null;
      _Chan? f(String n) => m.containsKey(n) ? c.chan(m[n]) : null;
      return _EyeOps(f('open'), f('happy'), f('lid'), f('smile'), f('slant'));
    }

    _ArmOps? arms(String k) {
      final m = spec[k] as Map<String, Object?>?;
      if (m == null) return null;
      final ch = <String, _Chan>{};
      for (final f in const ['angle', 'bend', 'twist', 'front', 'point', 'reach']) {
        if (m.containsKey(f)) ch[f] = c.chan(m[f]);
      }
      return _ArmOps(
        to: m.containsKey('to') ? book.armOf(m['to']) : null,
        w: m.containsKey('w') ? c.expr(m['w']) : null,
        keep: {...((m['keep'] as List<Object?>?) ?? const []).cast<String>()},
        when: m['when'] as String?,
        ch: ch,
      );
    }

    _BootOps? boots(String k) {
      final m = spec[k] as Map<String, Object?>?;
      if (m == null) return null;
      _Chan? f(String n) => m.containsKey(n) ? c.chan(m[n]) : null;
      return _BootOps(f('dx'), f('dy'), f('rot'));
    }

    return MobiProgram._(env, lets, scalars, eyes('eyes'), eyes('eyeL'), eyes('eyeR'), arms('arms'), arms('armL'), arms('armR'), boots('boots'),
        boots('bootL'), boots('bootR'));
  }
}

class _Compiler {
  _Compiler(this.book, this.env, this.names);

  final MobiBook book;
  final _Env env;
  final Map<String, int> names;

  _Chan chan(Object? v) {
    if (v is! Map) return _Chan(add: expr(v));
    final m = v.cast<String, Object?>();
    if (m.containsKey('to') != m.containsKey('w')) throw ArgumentError('Mobi rig: a channel needs both "to" and "w"');
    _Fn? f(String k) => m.containsKey(k) ? expr(m[k]) : null;
    return _Chan(to: f('to'), w: f('w'), mul: f('mul'), add: f('add'), max: f('max'), set: f('set'));
  }

  static double _ease(double t, double a, double b, MobiCubic curve) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    return curve.transform((t - a) / (b - a));
  }

  _Fn expr(Object? node) {
    if (node is num) {
      final v = node.toDouble();
      return (_) => v;
    }
    if (node is! List || node.isEmpty || node.first is! String) throw ArgumentError('Mobi rig: bad expression $node');
    final op = node.first as String;
    final args = node.sublist(1);
    _Fn arg(int i) => expr(args[i]);
    MobiCubic curveArg(int i, [String fallback = 'easeInOutCubic']) => book.curve(i < args.length ? args[i]! as String : fallback);
    List<_Fn> all() => [for (final a in args) expr(a)];
    switch (op) {
      case 'ease':
        final a = arg(0), b = arg(1);
        final cv = curveArg(2);
        return (e) => _ease(e.t, a(e), b(e), cv);
      case 'win':
        final a = arg(0), b = arg(1), c = arg(2), d = arg(3);
        final cin = curveArg(4), cout = curveArg(5);
        return (e) => _ease(e.t, a(e), b(e), cin) * (1 - _ease(e.t, c(e), d(e), cout));
      case 'bump':
        final a = arg(0), b = arg(1);
        return (e) {
          final lo = a(e), hi = b(e);
          if (e.t <= lo || e.t >= hi) return 0;
          return math.sin(math.pi * (e.t - lo) / (hi - lo));
        };
      case 'hop':
        final a = arg(0), b = arg(1), h = arg(2);
        return (e) {
          final lo = a(e), hi = b(e);
          if (e.t <= lo || e.t >= hi) return 0;
          final p = (e.t - lo) / (hi - lo);
          return -h(e) * 4 * p * (1 - p);
        };
      case 'span':
        final a = arg(0), b = arg(1);
        return (e) {
          final lo = a(e), hi = b(e);
          return (e.t < lo || e.t > hi) ? -1 : (e.t - lo) / (hi - lo);
        };
      case 'osc':
        final hz = arg(0), t0 = arg(1);
        return (e) => math.sin(2 * math.pi * hz(e) * (e.t - t0(e)));
      case 'curve':
        final cv = book.curve(args[0]! as String);
        final x = arg(1);
        return (e) => cv.transform(x(e).clamp(0.0, 1.0));
      case 'pow':
        final x = arg(0), p = arg(1);
        return (e) {
          final v = x(e);
          if (v == 0) return 0;
          return v.sign * math.pow(v.abs(), p(e)).toDouble();
        };
      case 'abs':
        final x = arg(0);
        return (e) => x(e).abs();
      case 'pos':
        final x = arg(0);
        return (e) => math.max(0, x(e));
      case 'sign':
        final x = arg(0);
        return (e) => x(e).sign;
      case 'step':
        final x = arg(0), edge = arg(1);
        return (e) => x(e) < edge(e) ? -1 : 1;
      case 'dip':
        final x = arg(0);
        return (e) => math.sin(math.pi * x(e).clamp(0.0, 1.0));
      case '+':
        final fs = all();
        return (e) {
          var s = 0.0;
          for (final f in fs) {
            s += f(e);
          }
          return s;
        };
      case '*':
        final fs = all();
        return (e) {
          var s = 1.0;
          for (final f in fs) {
            s *= f(e);
          }
          return s;
        };
      case 'k':
        final k = arg(0), x = arg(1);
        return (e) => k(e) * x(e);
      case '1-':
        final x = arg(0);
        return (e) => 1 - x(e);
      case 'min':
        final fs = all();
        return (e) {
          var s = fs.first(e);
          for (var i = 1; i < fs.length; i++) {
            s = math.min(s, fs[i](e));
          }
          return s;
        };
      case 'max':
        final fs = all();
        return (e) {
          var s = fs.first(e);
          for (var i = 1; i < fs.length; i++) {
            s = math.max(s, fs[i](e));
          }
          return s;
        };
      case 'clamp':
        final x = arg(0), lo = arg(1), hi = arg(2);
        return (e) => x(e).clamp(lo(e), hi(e));
      case 'ref':
        final name = args[0]! as String;
        switch (name) {
          case 't':
            return (e) => e.t;
          case 'w':
            if (!names.containsKey('w')) return (e) => e.w;
          case 'len':
            return (e) => e.len;
          case 'side':
            if (!names.containsKey('side')) return (e) => e.side;
        }
        final slot = names[name];
        if (slot == null) throw ArgumentError('Mobi rig: "$name" is used before it is defined');
        return (e) => e.vars[slot];
      case 'base':
        final field = args[0]! as String;
        return switch (field) {
          'x' => (e) => e.base.x,
          'y' => (e) => e.base.y,
          'tilt' => (e) => e.base.tilt,
          'squash' => (e) => e.base.squash,
          'lookX' => (e) => e.base.lookX,
          'lookY' => (e) => e.base.lookY,
          'antenna' => (e) => e.base.antenna,
          'glow' => (e) => e.base.glow,
          _ => throw ArgumentError('Mobi rig: no base field "$field"'),
        };
    }
    throw ArgumentError('Mobi rig: unknown operation "$op"');
  }
}
