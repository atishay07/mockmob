import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/models/study.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../models/learn_catalog.dart';

/// Where a lesson stands, as the ring at the end of its row draws it. The row's status word says
/// the same in text; the ring is the picture of it, never the only signal.
enum LessonRingKind {
  /// Not started: an empty ring.
  fresh,

  /// Started: an arc, as far round as the server's step over its total (a dot in the ring when
  /// the server did not say how far).
  partial,

  /// Done for now: an inked tick.
  done,

  /// Cards are due again: a marked ring that pulses once.
  due,
}

/// What the ring draws for one lesson.
class LessonRingState {
  const LessonRingState(this.kind, {this.fraction});

  factory LessonRingState.of(LearnUnit unit) {
    switch (unit.status) {
      case StudyUnitStatus.newUnit:
      case StudyUnitStatus.unknown:
        return const LessonRingState(LessonRingKind.fresh);
      case StudyUnitStatus.inProgress:
      case StudyUnitStatus.lockIn:
        final step = unit.step, steps = unit.steps;
        final f = step != null && steps != null && steps > 0 ? (step / steps).clamp(0.0, 1.0) : null;
        return LessonRingState(LessonRingKind.partial, fraction: f);
      case StudyUnitStatus.due:
        return const LessonRingState(LessonRingKind.due);
      case StudyUnitStatus.learned:
        return const LessonRingState(LessonRingKind.done);
    }
  }

  final LessonRingKind kind;

  /// How far round a [LessonRingKind.partial] arc goes, or null when it is not known.
  final double? fraction;

  /// The three things the painter blends: the arc (0 to 1), the tick (0 to 1) and the centre
  /// mark (0 to 1).
  (double, double, double) get parts => switch (kind) {
        LessonRingKind.fresh => (0, 0, 0),
        LessonRingKind.partial => fraction == null ? (0, 0, 1) : (fraction!, 0, 0),
        LessonRingKind.done => (1, 1, 0),
        LessonRingKind.due => (0, 0, 1),
      };

  @override
  bool operator ==(Object other) => other is LessonRingState && other.kind == kind && other.fraction == fraction;

  @override
  int get hashCode => Object.hash(kind, fraction);
}

/// The 28 dp state ring at the end of a lesson row. When the lesson's state changes while the
/// row is on screen (after a run, when the catalog is read again) the ring animates from the old
/// state to the new one over 480 ms: the arc grows, the tick inks. A lesson that becomes due
/// pulses once. Reduced motion shows the new state at once.
class LessonStateRing extends StatefulWidget {
  const LessonStateRing({super.key, required this.state, this.size = 28});

  final LessonRingState state;
  final double size;

  @override
  State<LessonStateRing> createState() => _LessonStateRingState();
}

class _LessonStateRingState extends State<LessonStateRing> with TickerProviderStateMixin {
  late final AnimationController _blend = AnimationController(vsync: this, duration: const Duration(milliseconds: 480), value: 1);
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 600), value: 1);
  late (double, double, double) _from = widget.state.parts;
  late (double, double, double) _to = widget.state.parts;
  bool _started = false;

  (double, double, double) get _now {
    final t = Motion.out.transform(_blend.value);
    return (
      _from.$1 + (_to.$1 - _from.$1) * t,
      _from.$2 + (_to.$2 - _from.$2) * t,
      _from.$3 + (_to.$3 - _from.$3) * t,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // A due lesson pulses once when it first shows.
    if (widget.state.kind == LessonRingKind.due && !Motion.reduced(context)) _pulse.forward(from: 0);
  }

  @override
  void didUpdateWidget(LessonStateRing old) {
    super.didUpdateWidget(old);
    if (old.state == widget.state) return;
    final target = widget.state.parts;
    if (Motion.reduced(context)) {
      _from = _to = target;
      _blend.value = 1;
      return;
    }
    // From wherever the ring is now, so a change in the middle of one does not jump.
    _from = _now;
    _to = target;
    _blend.forward(from: 0);
    if (widget.state.kind == LessonRingKind.due) _pulse.forward(from: 0);
  }

  @override
  void dispose() {
    _blend.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: Listenable.merge([_blend, _pulse]),
          builder: (context, _) {
            final (arc, tick, mark) = _now;
            return CustomPaint(
              size: Size.square(widget.size),
              painter: LessonRingPainter(colors: colors, arc: arc, tick: tick, mark: mark, pulse: _pulse.value),
            );
          },
        ),
      ),
    );
  }
}

/// Draws the ring. Public so tests can read what a frame was asked to draw.
class LessonRingPainter extends CustomPainter {
  LessonRingPainter({required this.colors, required this.arc, required this.tick, required this.mark, this.pulse = 1});

  final MmColors colors;
  final double arc;
  final double tick;
  final double mark;

  /// A pulse that has run this far, 0 to 1 (1 is finished).
  final double pulse;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 2;
    final line = colors.isNight ? colors.volt : colors.accentText;
    canvas.save();
    if (pulse < 1) {
      final s = 1 + 0.18 * math.sin(math.pi * pulse);
      canvas.translate(c.dx, c.dy);
      canvas.scale(s);
      canvas.translate(-c.dx, -c.dy);
    }
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = Color.lerp(colors.lineStrong, colors.ink, mark * 0.6)!;
    canvas.drawCircle(c, r, ring);
    if (arc > 0.001 && tick < 1) {
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: r),
        -math.pi / 2,
        2 * math.pi * arc,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..color = line,
      );
    }
    if (mark > 0.001) {
      canvas.drawCircle(c, r * 0.34 * mark, Paint()..color = colors.ink2.withValues(alpha: mark));
    }
    if (tick > 0.001) {
      // The tick inks: the disc grows from the middle, then the check draws itself.
      canvas.drawCircle(c, r * Curves.easeOut.transform(tick.clamp(0.0, 1.0)), Paint()..color = colors.volt);
      if (!colors.isNight) {
        canvas.drawCircle(
          c,
          r,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = colors.accentText.withValues(alpha: 0.55 * tick),
        );
      }
      final p = ((tick - 0.35) / 0.65).clamp(0.0, 1.0);
      if (p > 0) {
        final a = Offset(c.dx - r * 0.38, c.dy + r * 0.02);
        final b = Offset(c.dx - r * 0.1, c.dy + r * 0.32);
        final d = Offset(c.dx + r * 0.42, c.dy - r * 0.3);
        final path = Path()..moveTo(a.dx, a.dy);
        if (p < 0.4) {
          final t = p / 0.4;
          path.lineTo(a.dx + (b.dx - a.dx) * t, a.dy + (b.dy - a.dy) * t);
        } else {
          final t = (p - 0.4) / 0.6;
          path
            ..lineTo(b.dx, b.dy)
            ..lineTo(b.dx + (d.dx - b.dx) * t, b.dy + (d.dy - b.dy) * t);
        }
        canvas.drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..color = colors.voltInk,
        );
      }
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(LessonRingPainter old) =>
      old.arc != arc || old.tick != tick || old.mark != mark || old.pulse != pulse || old.colors != colors;
}
