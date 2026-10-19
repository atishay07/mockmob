// Paper bits and glints (BRAND-MOTION-KIT 6 "Particles", spec 5.6): 4 to 8 dp paper rectangles with
// a fold line that flutter, spin and fall with gravity and 12% drag, plus four-point glints. One
// ticker for the whole layer, a hard cap of 60 alive (30 on Lite, none in reduced motion), a fixed
// seed per burst so frame strips repeat, and a per-burst floor: a bit that reaches it stops there, so
// no particle ever crosses the text below.
//
// Usage: keep a [PaperParticlesController], put [PaperParticles] in the stack, call `burst(...)`.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'mob_fx.dart';

class PaperBurst {
  const PaperBurst({
    required this.origin,
    this.count = 10,
    this.speed = 260,
    this.angle = -math.pi / 2,
    this.spread = math.pi * 0.9,
    this.minLife = const Duration(milliseconds: 600),
    this.maxLife = const Duration(milliseconds: 1400),
    this.floorY,
    this.colours = const [Color(0xFFF4F0E6), Color(0xFFF2A93B)],
    this.glints = 0,
    this.glintRadius = 40,
    this.seed = 1,
  });

  /// In the layer's coordinates.
  final Offset origin;
  final int count;

  /// Launch speed in dp per second (each bit takes 50 to 100% of it).
  final double speed;

  /// Centre direction (radians; -pi/2 is straight up) and the cone around it.
  final double angle;
  final double spread;
  final Duration minLife;
  final Duration maxLife;

  /// Bits stop when they reach this y (a floor above the text under the burst).
  final double? floorY;
  final List<Color> colours;

  /// Four-point glints placed on a ring of [glintRadius] around the origin.
  final int glints;
  final double glintRadius;
  final int seed;
}

class PaperParticlesController extends ChangeNotifier {
  final List<PaperBurst> _pending = [];

  void burst(PaperBurst b) {
    _pending.add(b);
    notifyListeners();
  }

  /// Ends every bit at once (a Skip).
  void clear() {
    _pending.clear();
    _clear = true;
    notifyListeners();
  }

  bool _clear = false;
}

class PaperParticles extends StatefulWidget {
  const PaperParticles({super.key, required this.controller});

  final PaperParticlesController controller;

  @override
  State<PaperParticles> createState() => _PaperParticlesState();
}

class _Bit {
  _Bit(this.p, this.v, this.size, this.colour, this.rot, this.spin, this.life, this.floorY, this.flutter);
  Offset p;
  Offset v;
  final double size;
  final Color colour;
  double rot;
  final double spin;
  final double life;
  double age = 0;
  final double? floorY;
  final double flutter;
  bool landed = false;
}

class _Glint {
  _Glint(this.p, this.delay, this.size);
  final Offset p;
  final double delay;
  final double size;
  double age = 0;
}

class _PaperParticlesState extends State<PaperParticles> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  final List<_Bit> _bits = [];
  final List<_Glint> _glints = [];
  Duration _last = Duration.zero;
  final ValueNotifier<int> _frame = ValueNotifier<int>(0);

  @override
  void initState() {
    super.initState();
    // Created here, not lazily: a lazy ticker made in dispose looks up an inactive tree.
    _ticker = createTicker(_tick);
    widget.controller.addListener(_take);
  }

  @override
  void didUpdateWidget(PaperParticles old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_take);
      widget.controller.addListener(_take);
    }
  }

  void _take() {
    final c = widget.controller;
    if (c._clear) {
      c._clear = false;
      _bits.clear();
      _glints.clear();
      _frame.value++;
    }
    if (c._pending.isEmpty) return;
    final cap = MobFx.particles(context, 60);
    for (final b in c._pending) {
      final rng = math.Random(b.seed);
      final n = math.min(MobFx.particles(context, b.count), math.max(0, cap - _bits.length));
      for (var i = 0; i < n; i++) {
        final a = b.angle + (rng.nextDouble() - 0.5) * b.spread;
        final s = b.speed * (0.5 + rng.nextDouble() * 0.5);
        final life = b.minLife.inMilliseconds + rng.nextDouble() * (b.maxLife.inMilliseconds - b.minLife.inMilliseconds);
        _bits.add(_Bit(
          b.origin + Offset((rng.nextDouble() - 0.5) * 8, (rng.nextDouble() - 0.5) * 6),
          Offset(math.cos(a) * s, math.sin(a) * s),
          4 + rng.nextDouble() * 4,
          b.colours[rng.nextInt(b.colours.length)],
          rng.nextDouble() * math.pi,
          (rng.nextDouble() - 0.5) * 12,
          life / 1000,
          b.floorY,
          rng.nextDouble() * math.pi * 2,
        ));
      }
      if (!MobFx.reduced(context)) {
        final g = MobFx.lite(context) ? (b.glints / 2).ceil() : b.glints;
        for (var i = 0; i < g; i++) {
          final a = i / math.max(1, g) * math.pi * 2 + rng.nextDouble() * 0.6;
          _glints.add(_Glint(b.origin + Offset(math.cos(a), math.sin(a)) * b.glintRadius * (0.7 + rng.nextDouble() * 0.5), i * 0.06, 6 + rng.nextDouble() * 6));
        }
      }
    }
    c._pending.clear();
    if ((_bits.isNotEmpty || _glints.isNotEmpty) && !_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    }
  }

  void _tick(Duration elapsed) {
    final dt = ((elapsed - _last).inMicroseconds / 1e6).clamp(0.0, 1 / 20);
    _last = elapsed;
    const g = 900.0;
    final drag = math.pow(0.88, dt).toDouble();
    for (final b in _bits) {
      b.age += dt;
      if (b.landed) continue;
      b.v = Offset(b.v.dx * drag + math.sin(b.age * 9 + b.flutter) * 30 * dt, b.v.dy * drag + g * dt);
      b.p += b.v * dt;
      b.rot += b.spin * dt;
      final f = b.floorY;
      if (f != null && b.p.dy >= f) {
        b.p = Offset(b.p.dx, f);
        b.landed = true;
      }
    }
    _bits.removeWhere((b) => b.age >= b.life);
    for (final gl in _glints) {
      gl.age += dt;
    }
    _glints.removeWhere((gl) => gl.age >= gl.delay + 0.42);
    _frame.value++;
    if (_bits.isEmpty && _glints.isEmpty) _ticker.stop();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_take);
    _ticker.dispose();
    _frame.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(painter: _ParticlePainter(_bits, _glints, _frame), size: Size.infinite),
      ),
    );
  }
}

class _ParticlePainter extends CustomPainter {
  _ParticlePainter(this.bits, this.glints, Listenable repaint) : super(repaint: repaint);

  final List<_Bit> bits;
  final List<_Glint> glints;

  @override
  void paint(Canvas canvas, Size size) {
    final fill = Paint();
    final fold = Paint()
      ..color = const Color(0x33000000)
      ..strokeWidth = 0.8;
    for (final b in bits) {
      final t = b.age / b.life;
      final alpha = t < 0.7 ? 1.0 : (1 - (t - 0.7) / 0.3).clamp(0.0, 1.0);
      fill.color = b.colour.withValues(alpha: b.colour.a * alpha);
      canvas.save();
      canvas.translate(b.p.dx, b.p.dy);
      canvas.rotate(b.rot);
      // A paper bit seen at an angle: the width breathes as it flutters.
      final w = b.size * (0.55 + 0.45 * math.cos(b.age * 7 + b.flutter).abs());
      final r = Rect.fromCenter(center: Offset.zero, width: w, height: b.size * 0.7);
      canvas.drawRect(r, fill);
      fold.color = Color.fromARGB((0x33 * alpha).round(), 0, 0, 0);
      canvas.drawLine(r.topCenter, r.bottomCenter, fold);
      canvas.restore();
    }
    for (final g in glints) {
      final t = ((g.age - g.delay) / 0.42).clamp(0.0, 1.0);
      if (t <= 0 || t >= 1) continue;
      final k = math.sin(t * math.pi);
      drawGlint(canvas, g.p, g.size * k, const Color(0xFFFFF4D6).withValues(alpha: 0.95 * k));
    }
  }

  @override
  bool shouldRepaint(_ParticlePainter old) => true;
}

/// A four-point glint (the app's EmblemSparkle shape), centred on [c].
void drawGlint(Canvas canvas, Offset c, double r, Color colour) {
  if (r <= 0) return;
  final p = Path()
    ..moveTo(c.dx, c.dy - r)
    ..quadraticBezierTo(c.dx + r * 0.12, c.dy - r * 0.12, c.dx + r, c.dy)
    ..quadraticBezierTo(c.dx + r * 0.12, c.dy + r * 0.12, c.dx, c.dy + r)
    ..quadraticBezierTo(c.dx - r * 0.12, c.dy + r * 0.12, c.dx - r, c.dy)
    ..quadraticBezierTo(c.dx - r * 0.12, c.dy - r * 0.12, c.dx, c.dy - r)
    ..close();
  canvas.drawPath(p, Paint()..color = colour);
}
