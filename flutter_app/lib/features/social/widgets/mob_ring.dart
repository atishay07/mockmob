import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../data/mob_models.dart';
import '../logic/mob_ring.dart';

/// The 8 avatar token colours (P3: an initial on a colour, no photos, no emoji). Each pair is
/// Night then Day, both holding 4.5:1 with the initial's ink.
abstract final class MobColours {
  static const List<(Color, Color)> _pairs = [
    (Color(0xFF6E8BFF), Color(0xFF3550C8)),
    (Color(0xFF3FC6A8), Color(0xFF0E7C66)),
    (Color(0xFFF2A93B), Color(0xFF9A5B00)),
    (Color(0xFFFF7A8A), Color(0xFFB4243A)),
    (Color(0xFFB98CFF), Color(0xFF6A3BC4)),
    (Color(0xFF56B8F0), Color(0xFF0B6A9E)),
    (Color(0xFFE58E5A), Color(0xFFA14A12)),
    (Color(0xFF9FBF4A), Color(0xFF55741A)),
  ];

  static int get count => _pairs.length;

  static Color of(BuildContext context, int i) {
    final p = _pairs[i.clamp(0, _pairs.length - 1)];
    return context.mmColors.isNight ? p.$1 : p.$2;
  }

  /// The initial's ink on [of]: dark on the light Night tones, white on the deep Day tones.
  static Color inkOn(BuildContext context) => context.mmColors.isNight ? const Color(0xFF0B0B0F) : Colors.white;
}

/// An initial on its token colour. Decorative beside a visible name.
class InitialDisc extends StatelessWidget {
  const InitialDisc({super.key, required this.member, this.size = 32});

  final MobMember member;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: MobColours.of(context, member.colour), shape: BoxShape.circle),
        child: Text(
          member.initial,
          style: context.mmType.label.copyWith(color: MobColours.inkOn(context), fontSize: size * 0.44, height: 1, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// The Mob ring: one segment a seat, filled in join order as members sit. Fresh segments ink in
/// once, 220 ms each with a 60 ms step on `Motion.out`; a completed ring settles once on
/// `Springs.settle` (1, 1.03, 1). Reduced motion paints the end state with the same text.
class MobRing extends StatefulWidget {
  const MobRing({super.key, required this.plan, this.size = 160, this.stroke, this.center, this.onInked, this.semanticsLabel});

  final RingPlan plan;
  final double size;
  final double? stroke;
  final Widget? center;

  /// Called once the fresh segments have inked (or at once when there are none), so the caller can
  /// remember them as seen.
  final VoidCallback? onInked;
  final String? semanticsLabel;

  @override
  State<MobRing> createState() => _MobRingState();
}

class _MobRingState extends State<MobRing> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this);
  late final AnimationController _settle = AnimationController.unbounded(vsync: this, value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      _play();
    }
  }

  @override
  void didUpdateWidget(MobRing old) {
    super.didUpdateWidget(old);
    if (old.plan.sat != widget.plan.sat || old.plan.freshCount != widget.plan.freshCount) _play();
  }

  void _play() {
    final fresh = widget.plan.freshCount;
    if (fresh == 0 || Motion.reduced(context)) {
      _ink.value = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onInked?.call());
      return;
    }
    _ink
      ..duration = ringInkTotal(fresh)
      ..value = 0;
    _ink.animateTo(1, curve: Curves.linear).whenComplete(() {
      if (!mounted) return;
      widget.onInked?.call();
      if (widget.plan.complete) {
        // 1, then 1.03, then 1: a small kick on the settle spring.
        _settle.animateWith(SpringSimulation(Springs.settle, 1, 1, 0.9));
      }
    });
  }

  @override
  void dispose() {
    _ink.dispose();
    _settle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final stroke = widget.stroke ?? (widget.size * 0.09).clamp(6.0, 14.0);
    return Semantics(
      label: widget.semanticsLabel,
      image: widget.semanticsLabel != null,
      child: AnimatedBuilder(
        animation: Listenable.merge([_ink, _settle]),
        builder: (context, child) => Transform.scale(
          scale: _settle.value.clamp(0.97, 1.05),
          child: CustomPaint(
            size: Size.square(widget.size),
            painter: _RingPainter(
              plan: widget.plan,
              progress: _ink.value,
              track: colors.line,
              fill: colors.volt,
              edge: colors.voltEdge,
              stroke: stroke,
            ),
            child: child,
          ),
        ),
        child: SizedBox.square(dimension: widget.size, child: Center(child: widget.center)),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.plan, required this.progress, required this.track, required this.fill, required this.edge, required this.stroke});

  final RingPlan plan;
  final double progress;
  final Color track;
  final Color fill;
  final Color edge;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final n = plan.size;
    if (n == 0) return;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: (size.shortestSide - stroke) / 2);
    // A gap of about one stroke width between seats, so each seat reads as one person.
    final gap = n == 1 ? 0.0 : (stroke * 1.4) / rect.width * 2;
    final sweep = (2 * math.pi - gap * n) / n;
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = n == 1 ? StrokeCap.butt : StrokeCap.round
      ..color = track;
    final ink = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = n == 1 ? StrokeCap.butt : StrokeCap.round
      ..color = fill;
    var freshIndex = 0;
    final fresh = plan.freshCount;
    for (var i = 0; i < n; i++) {
      final start = -math.pi / 2 + gap / 2 + i * (sweep + gap);
      canvas.drawArc(rect, start, sweep, false, base);
      final s = plan.segments[i];
      double t;
      if (s == RingSegment.filled) {
        t = 1;
      } else if (s == RingSegment.fresh) {
        final (a, b) = ringInkInterval(freshIndex++, fresh);
        t = b <= a ? 1 : Motion.out.transform(((progress - a) / (b - a)).clamp(0.0, 1.0));
      } else {
        t = 0;
      }
      if (t > 0) canvas.drawArc(rect, start, sweep * t, false, ink);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress || old.plan != plan || old.track != track || old.fill != fill || old.stroke != stroke;
}
