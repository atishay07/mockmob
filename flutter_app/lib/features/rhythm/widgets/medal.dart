// The medal (you-rhythm spec 2.3): a brass coin drawn in code for one milestone step. Landed is
// brass with its numeral or glyph engraved in; next is a dashed ring (volt on Night, the dark volt
// on Daylight) with the same engraving in ink; later is a faint ring. A step that just landed plays
// once, and it is the one light event of that moment (MOTION.md 1.2, T3): the coin settles from
// 0.92 on `Springs.celebrate` while one light band crosses it (500 ms, the milestone ceiling),
// starting after [delay] so the token above it lands first. Painters on RepaintBoundaries,
// nothing loops, reduced motion draws it settled. The state is always also said in words by the
// row that holds the medal.
//
// Brass is a metal, so the coin is the same object on both themes by design: the rim, face and
// engraving colours below are physical, not theme colours. What does follow the theme is what
// sits around the coin: its contact shadow (black 24% on Night, warm ink 12% on Daylight) and the
// ring of a coin that is next (accent text colour, on both).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import 'rhythm_layout.dart' show contactShadowColor;

enum MedalStatus { landed, next, later }

class Medal extends StatefulWidget {
  const Medal({super.key, required this.status, this.icon, this.text, this.size = 44, this.animateLanding = false, this.delay = Duration.zero})
      : assert(icon != null || text != null);

  /// A coin without an engraving, for the small coins of a summary row.
  const Medal.plain({super.key, required this.status, this.size = 20})
      : icon = null,
        text = null,
        animateLanding = false,
        delay = Duration.zero;

  final MedalStatus status;

  /// A line glyph to engrave. Either this or [text].
  final IconData? icon;

  /// A numeral to engrave ("5", "25").
  final String? text;
  final double size;

  /// Plays the landing once (a step that landed since the last visit).
  final bool animateLanding;

  /// Waits this long before the landing plays: the object above it settles first.
  final Duration delay;

  @override
  State<Medal> createState() => _MedalState();
}

class _MedalState extends State<Medal> with SingleTickerProviderStateMixin {
  /// The band's pass, 0 to 1. The settle is a spring on an unbounded controller of the same
  /// ticker, so one ticker serves both.
  AnimationController? _band;
  AnimationController? _scale;
  Timer? _wait;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animateLanding || widget.status != MedalStatus.landed || Motion.reduced(context)) return;
    final band = _band = AnimationController(vsync: this, duration: Motion.milestone);
    final scale = _scale = AnimationController.unbounded(vsync: this, value: 0.92);
    void play() {
      if (!mounted) return;
      band.forward();
      scale.animateWith(Motion.spring(Springs.celebrate, 0.92, 1));
    }

    if (widget.delay <= Duration.zero) {
      play();
    } else {
      _wait = Timer(widget.delay, play);
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _band?.dispose();
    _scale?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = widget.size;
    final landed = widget.status == MedalStatus.landed;
    final Color engrave = switch (widget.status) {
      // Brass engraving: dark bronze, the same on both themes (the coin is the same metal).
      MedalStatus.landed => const Color(0xFF5A3D0B),
      MedalStatus.next => colors.ink,
      MedalStatus.later => colors.ink4,
    };
    // The lit lip under the engraving: pale gold, the same metal on both themes.
    final shadows = landed ? const [Shadow(color: Color(0xAAFBE9B7), offset: Offset(0.6, 0.9))] : null;
    final Widget mark = widget.icon == null && widget.text == null
        ? const SizedBox.shrink()
        : widget.icon != null
        ? _Engraved(icon: widget.icon!, size: s * 0.46, color: engrave, shadows: shadows, heavy: landed)
        : Text(
            widget.text!,
            textScaler: TextScaler.noScaling,
            style: type.figure.copyWith(fontSize: s * (widget.text!.length > 1 ? 0.40 : 0.48), height: 1, color: engrave, shadows: shadows),
          );

    final coin = SizedBox.square(
      dimension: s,
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _MedalPainter(colors: colors, status: widget.status, progress: _band),
          child: Center(child: mark),
        ),
      ),
    );
    final scale = _scale;
    if (scale == null) return ExcludeSemantics(child: coin);
    return ExcludeSemantics(
      child: AnimatedBuilder(
        animation: scale,
        builder: (context, child) => Transform.scale(scale: scale.value, child: child),
        child: coin,
      ),
    );
  }
}

/// A glyph engraved into the brass. A line icon is thin, so on a coin it reads faint next to a
/// numeral; a landed coin strikes it five times, a hair apart, so every earned step has the same
/// deep cut whatever it is engraved with.
class _Engraved extends StatelessWidget {
  const _Engraved({required this.icon, required this.size, required this.color, required this.shadows, required this.heavy});

  final IconData icon;
  final double size;
  final Color color;
  final List<Shadow>? shadows;
  final bool heavy;

  @override
  Widget build(BuildContext context) {
    final glyph = Icon(icon, size: size, color: color, shadows: shadows);
    if (!heavy) return glyph;
    const d = 0.45;
    return Stack(
      alignment: Alignment.center,
      children: [
        for (final o in const [Offset(-d, 0), Offset(d, 0), Offset(0, -d), Offset(0, d)])
          Transform.translate(offset: o, child: Icon(icon, size: size, color: color)),
        glyph,
      ],
    );
  }
}

class _MedalPainter extends CustomPainter {
  _MedalPainter({required this.colors, required this.status, required this.progress}) : super(repaint: progress);

  final MmColors colors;
  final MedalStatus status;
  final Animation<double>? progress;

  // Brass: the metal is the same on Night and Daylight (see the file header), so these are
  // physical colours, not theme roles.
  static const _rim = [Color(0xFFF6DE9B), Color(0xFFC99A3A), Color(0xFF7C5A1A), Color(0xFFE8C672), Color(0xFF9A7125), Color(0xFFF6DE9B)];
  static const _faceLit = Color(0xFFF0D590);
  static const _faceMid = Color(0xFFC79834);
  static const _faceDark = Color(0xFF8E6A22);
  static const _faceEdge = Color(0x996B4A12);
  static const _rimLight = Color(0xB3FFF6D6);

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    switch (status) {
      case MedalStatus.landed:
        _brass(canvas, c, r);
      case MedalStatus.next:
        // A stroke on the ground: volt on Night, the dark volt on Daylight (`accentText`).
        _dashed(canvas, c, r - 1.5, colors.accentText, 2.4);
      case MedalStatus.later:
        canvas.drawCircle(
          c,
          r - 1,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.4
            ..color = colors.lineStrong,
        );
    }
  }

  void _brass(Canvas canvas, Offset c, double r) {
    // A touch of contact shadow so the coin sits on the ground.
    canvas.drawCircle(
      c + Offset(0, r * 0.1),
      r * 0.96,
      Paint()
        ..color = contactShadowColor(colors, strength: 1.4)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.12),
    );
    final rimRect = Rect.fromCircle(center: c, radius: r);
    canvas.drawCircle(
      c,
      r,
      Paint()..shader = SweepGradient(colors: _rim, transform: const GradientRotation(-math.pi / 4)).createShader(rimRect),
    );
    final disc = r * 0.8;
    canvas.drawCircle(
      c,
      disc,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-0.35, -0.4),
          colors: [_faceLit, _faceMid, _faceDark],
          stops: [0, 0.55, 1],
        ).createShader(Rect.fromCircle(center: c, radius: disc)),
    );
    canvas.drawCircle(
      c,
      disc,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = _faceEdge,
    );
    // The lit arc on the upper left of the rim.
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r - 1.2),
      math.pi * 1.05,
      math.pi * 0.6,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round
        ..color = _rimLight,
    );
    final p = progress?.value ?? 1.0;
    if (p > 0 && p < 1) {
      // The one light event of a landing: a band of light across brass, which is bright on both
      // themes because it never leaves the coin.
      canvas.save();
      canvas.clipPath(Path()..addOval(Rect.fromCircle(center: c, radius: r)));
      canvas.translate(c.dx, c.dy);
      canvas.rotate(-0.6);
      final x = (p * 2.2 - 1.1) * r * 1.4;
      final band = Rect.fromLTWH(x - r * 0.22, -r * 2, r * 0.44, r * 4);
      canvas.drawRect(
        band,
        Paint()..shader = LinearGradient(colors: [Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: 0.6), Colors.white.withValues(alpha: 0)]).createShader(band),
      );
      canvas.restore();
    }
  }

  void _dashed(Canvas canvas, Offset c, double r, Color color, double stroke) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    const dashes = 22;
    const step = 2 * math.pi / dashes;
    final rect = Rect.fromCircle(center: c, radius: r);
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(rect, i * step, step * 0.58, false, paint);
    }
  }

  @override
  bool shouldRepaint(_MedalPainter old) => old.colors != colors || old.status != status || old.progress != progress;
}
