import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../motion/motion.dart';
import '../theme/light_fields.dart';

/// The one-shot light of a subject's object answering a touch: its subject light blooms behind it
/// and four small glints leave its rim and fade, in [EmblemSparkle.duration]. Each change of
/// [pulse] plays it once. It paints only around the object (behind it, and in a thin band past its
/// edge), never over text, and is gone at rest. Nothing under reduced motion.
class EmblemSparkle extends StatefulWidget {
  const EmblemSparkle({super.key, required this.pulse, required this.light, required this.brightness, required this.child});

  final ValueListenable<int> pulse;

  /// The subject's light field; null uses the lamp-neutral glow.
  final SubjectLight? light;
  final Brightness brightness;
  final Widget child;

  static const Duration duration = Duration(milliseconds: 560);

  @override
  State<EmblemSparkle> createState() => _EmblemSparkleState();
}

class _EmblemSparkleState extends State<EmblemSparkle> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: EmblemSparkle.duration, value: 1);

  @override
  void initState() {
    super.initState();
    widget.pulse.addListener(_play);
  }

  @override
  void didUpdateWidget(EmblemSparkle old) {
    super.didUpdateWidget(old);
    if (old.pulse != widget.pulse) {
      old.pulse.removeListener(_play);
      widget.pulse.addListener(_play);
    }
  }

  void _play() {
    if (!mounted || Motion.reduced(context)) return;
    _t.forward(from: 0);
  }

  @override
  void dispose() {
    widget.pulse.removeListener(_play);
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final night = widget.brightness == Brightness.dark;
    final base = widget.light?.of(widget.brightness) ?? (night ? const Color(0xFF3B2A10) : const Color(0xFFF6E8CF));
    // The field colours are deliberately quiet; the bloom lifts them toward the lamp so a touch reads.
    final glow = night ? Color.lerp(base, const Color(0xFFFFE7B8), 0.45)! : Color.lerp(base, const Color(0xFFFFFFFF), 0.2)!;
    final glint = night ? const Color(0xFFFFF4DA) : Color.lerp(base, const Color(0xFF6B4A12), 0.55)!;
    return CustomPaint(
      painter: _BloomPainter(t: _t, color: glow),
      foregroundPainter: _GlintPainter(t: _t, color: glint),
      child: widget.child,
    );
  }
}

class _BloomPainter extends CustomPainter {
  _BloomPainter({required this.t, required this.color}) : super(repaint: t);

  final Animation<double> t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final v = t.value;
    if (v <= 0 || v >= 1) return;
    // Up fast, down slow.
    final strength = v < 0.25 ? Motion.out.transform(v / 0.25) : 1 - Motion.glide.transform((v - 0.25) / 0.75);
    final r = size.shortestSide * (0.42 + 0.2 * Motion.out.transform(v));
    final c = size.center(Offset.zero);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          colors: [color.withValues(alpha: 0.55 * strength), color.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  @override
  bool shouldRepaint(_BloomPainter old) => old.t != t || old.color != color;
}

class _GlintPainter extends CustomPainter {
  _GlintPainter({required this.t, required this.color}) : super(repaint: t);

  final Animation<double> t;
  final Color color;

  /// Four glints at fixed angles (upper right first, where the lamp is), slightly staggered.
  static const List<double> _angles = [-0.95, -0.2, 2.35, 3.5];

  @override
  void paint(Canvas canvas, Size size) {
    final v = t.value;
    if (v <= 0 || v >= 1) return;
    final c = size.center(Offset.zero);
    final half = size.shortestSide / 2;
    for (var i = 0; i < _angles.length; i++) {
      final local = ((v - i * 0.06) / 0.76).clamp(0.0, 1.0);
      if (local <= 0 || local >= 1) continue;
      final e = Motion.out.transform(local);
      final dist = half * (0.78 + 0.32 * e);
      final p = c + Offset(math.cos(_angles[i]), math.sin(_angles[i])) * dist;
      final arm = half * 0.09 * math.sin(local * math.pi);
      final alpha = (1 - local) * (local < 0.2 ? local / 0.2 : 1);
      _star(canvas, p, arm, color.withValues(alpha: alpha.clamp(0.0, 1.0)));
    }
  }

  /// A four-point star: two thin crossed diamonds.
  static void _star(Canvas canvas, Offset p, double arm, Color color) {
    if (arm <= 0.2) return;
    final w = arm * 0.28;
    final path = Path()
      ..moveTo(p.dx, p.dy - arm)
      ..lineTo(p.dx + w, p.dy - w)
      ..lineTo(p.dx + arm, p.dy)
      ..lineTo(p.dx + w, p.dy + w)
      ..lineTo(p.dx, p.dy + arm)
      ..lineTo(p.dx - w, p.dy + w)
      ..lineTo(p.dx - arm, p.dy)
      ..lineTo(p.dx - w, p.dy - w)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_GlintPainter old) => old.t != t || old.color != color;
}
