import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/bubbles/bubble_painter.dart';

/// The kinds of session a choice can start, each with its own drawn glyph and gesture.
enum ChoiceGlyphKind {
  /// Five bubbles, three inked: a paper in progress. The next one inks.
  resume,

  /// A lightning bolt: a quick set. It flashes and throws sparks.
  quick,

  /// An open book: one or more chapters. A page turns.
  chapter,

  /// Rings closing on a wrong bubble: practice that leans toward your misses.
  smart,

  /// A stopwatch: a full timed paper. The crown dips and the hand sweeps a turn.
  mock,

  /// The exam's own question palette: the exam-day screen. The cells fill one by one.
  nta,

  /// A wrong bubble that a volt ring closes around: the mistake about to be repaired.
  repair,

  /// A speech bubble whose dots hop in turn: ask about your record.
  ask,
}

/// How long one glyph gesture runs. Every gesture ends where it began, so a cut-short frame never
/// leaves a glyph half drawn.
const Duration choiceGlyphGesture = Duration(milliseconds: 640);

/// Drives a glyph's gesture: [play] runs it once (a press), and [playAfter] once after a delay
/// (the leading choice's entrance). Nothing runs under reduced motion. One player can drive
/// several glyphs (a tile's disc glyph and its large ghost move together).
class GlyphPlayer {
  GlyphPlayer(TickerProvider vsync) : _c = AnimationController(vsync: vsync, duration: choiceGlyphGesture);

  final AnimationController _c;
  Timer? _timer;

  /// The gesture's progress, eased. 0 and 1 are the same resting pose.
  late final Animation<double> progress = CurvedAnimation(parent: _c, curve: Curves.easeInOutCubic);

  void play(BuildContext context) {
    if (!context.mounted || Motion.reduced(context)) return;
    _c.forward(from: 0);
  }

  void playAfter(BuildContext context, Duration delay) {
    _timer?.cancel();
    _timer = Timer(delay, () {
      if (context.mounted) play(context);
    });
  }

  void dispose() {
    _timer?.cancel();
    _c.dispose();
  }
}

/// A code-drawn glyph on its disc, posed at [motion] (a [GlyphPlayer.progress]; still when
/// null). Decorative: the choice it sits in names itself.
class ChoiceGlyph extends StatelessWidget {
  const ChoiceGlyph({super.key, required this.kind, this.size = 44, this.lit = false, this.motion});

  final ChoiceGlyphKind kind;

  /// The disc's diameter. The glyph takes about 56% of it.
  final double size;

  /// The leading choice: a volt rim on the disc and the glyph's accent at rest.
  final bool lit;
  final Animation<double>? motion;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: ChoiceGlyphPainter(kind: kind, colors: colors, t: motion ?? kAlwaysDismissedAnimation, lit: lit),
          ),
        ),
      ),
    );
  }
}

/// The same glyph drawn large and faint in one colour, bleeding off a tile's corner: the tile's
/// own graphic, so no two tiles read alike. It moves with the tile's glyph.
class ChoiceGhost extends StatelessWidget {
  const ChoiceGhost({super.key, required this.kind, this.size = 120, this.motion, this.angle = -0.14, this.alpha});

  final ChoiceGlyphKind kind;
  final double size;
  final Animation<double>? motion;
  final double angle;

  /// Defaults to 7% ink on Night and 6% on Daylight.
  final double? alpha;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final a = alpha ?? (colors.isNight ? 0.07 : 0.06);
    return ExcludeSemantics(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: Transform.rotate(
            angle: angle,
            child: SizedBox.square(
              dimension: size,
              child: CustomPaint(
                painter: ChoiceGlyphPainter(
                  kind: kind,
                  colors: colors,
                  t: motion ?? kAlwaysDismissedAnimation,
                  mono: colors.ink.withValues(alpha: a),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Paints the disc and the glyph at gesture progress [t] (0 and 1 are the same resting pose).
class ChoiceGlyphPainter extends CustomPainter {
  ChoiceGlyphPainter({required this.kind, required this.colors, required this.t, this.lit = false, this.mono}) : super(repaint: t);

  final ChoiceGlyphKind kind;
  final MmColors colors;
  final Animation<double> t;
  final bool lit;

  /// Draws the glyph alone (no disc) in this one colour: the ghost behind a tile.
  final Color? mono;

  Color get _volt => mono ?? (colors.isNight ? colors.volt : colors.accentText);
  Color get _ink => mono ?? colors.ink;
  Color get _ink2 => mono ?? colors.ink2;

  /// A bubble: the shared answer-sheet bubble, or a plain ring or disc in the ghost's colour.
  void _bubble(Canvas canvas, Offset c, double r, BubbleState state, {double fill = 1, Offset origin = Offset.zero}) {
    final m = mono;
    if (m == null) {
      BubblePaint(colors).paint(canvas, c, r, state, fill: fill, origin: origin);
      return;
    }
    if (state == BubbleState.hollow) {
      canvas.drawCircle(c, r, _stroke(m, (r * 0.12).clamp(1.0, 2.0)));
    } else {
      canvas.drawCircle(c, r * (state == BubbleState.filled ? fill : 1), Paint()..color = m);
    }
  }

  /// 0 at both ends, 1 in the middle of the gesture.
  static double bell(double p) => math.sin(math.pi * p.clamp(0.0, 1.0));

  /// A bump of width [w] centred at [at]: 0 outside it, 1 at its centre.
  static double bump(double p, double at, double w) {
    final x = (p - at) / w;
    if (x <= -0.5 || x >= 0.5) return 0;
    return math.cos(math.pi * x);
  }

  Paint _stroke(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..color = color
    ..isAntiAlias = true;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.shortestSide / 2;
    final c = size.center(Offset.zero);
    if (mono == null) {
      // The disc: a step above the surface it sits on, with a hairline; a volt rim when lit.
      canvas.drawCircle(c, r, Paint()..color = colors.isNight ? colors.raised2 : colors.sunken);
      canvas.drawCircle(c, r - 0.5, _stroke(lit ? _volt : colors.line, lit ? 1.5 : 1));
    }

    // The glyph lives in a 24-unit box, about 56% of the disc (all of it for a ghost).
    final unit = size.shortestSide * (mono == null ? 0.56 : 0.92) / 24;
    canvas
      ..save()
      ..translate(c.dx - 12 * unit, c.dy - 12 * unit)
      ..scale(unit);
    final p = t.value;
    switch (kind) {
      case ChoiceGlyphKind.quick:
        _quick(canvas, p);
      case ChoiceGlyphKind.chapter:
        _chapter(canvas, p);
      case ChoiceGlyphKind.smart:
        _smart(canvas, p);
      case ChoiceGlyphKind.mock:
        _mock(canvas, p);
      case ChoiceGlyphKind.nta:
        _nta(canvas, p);
      case ChoiceGlyphKind.repair:
        _repair(canvas, p);
      case ChoiceGlyphKind.ask:
        _ask(canvas, p);
      case ChoiceGlyphKind.resume:
        _resume(canvas, p);
    }
    canvas.restore();
  }

  static final Path _bolt = Path()
    ..moveTo(13.5, 2)
    ..lineTo(4.5, 13.5)
    ..lineTo(11.2, 13.5)
    ..lineTo(10.2, 22)
    ..lineTo(19.5, 10)
    ..lineTo(12.8, 10)
    ..close();

  void _quick(Canvas canvas, double p) {
    final b = bell(p);
    canvas
      ..save()
      ..translate(12, 12)
      ..scale(1 + 0.1 * b)
      ..translate(-12, -12);
    final flash = lit ? 1.0 : b;
    if (flash > 0.01) canvas.drawPath(_bolt, Paint()..color = _volt.withValues(alpha: _volt.a * flash));
    canvas
      ..drawPath(_bolt, _stroke(Color.lerp(_ink, lit ? colors.voltInk : _ink, flash)!, 1.6))
      ..restore();
    if (b < 0.02) return;
    // Three sparks thrown out from the bolt's tips.
    const sparks = [(Offset(3.5, 6), -2.6), (Offset(21, 15.5), 0.35), (Offset(6.5, 21), 2.4)];
    final spark = _stroke(_volt.withValues(alpha: _volt.a * b), 1.4);
    for (final (o, angle) in sparks) {
      final dir = Offset(math.cos(angle), math.sin(angle));
      final start = o + dir * (1.5 * p);
      canvas.drawLine(start, start + dir * (3.2 * b), spark);
    }
  }

  static Path _page({required bool right}) {
    final path = Path();
    if (right) {
      path
        ..moveTo(12, 6.5)
        ..cubicTo(14.8, 5, 18.2, 4.6, 21, 5.4)
        ..lineTo(21, 18.6)
        ..cubicTo(18.2, 17.8, 14.8, 18.2, 12, 19.8)
        ..close();
    } else {
      path
        ..moveTo(12, 6.5)
        ..cubicTo(9.2, 5, 5.8, 4.6, 3, 5.4)
        ..lineTo(3, 18.6)
        ..cubicTo(5.8, 17.8, 9.2, 18.2, 12, 19.8)
        ..close();
    }
    return path;
  }

  static final Path _leftPage = _page(right: false);
  static final Path _rightPage = _page(right: true);

  void _chapter(Canvas canvas, double p) {
    final ink = _stroke(_ink, 1.5);
    final lines = _stroke(_ink.withValues(alpha: 0.45), 1);
    canvas
      ..drawPath(_leftPage, ink)
      ..drawPath(_rightPage, ink);
    for (final y in [9.5, 12.5]) {
      canvas
        ..drawLine(Offset(5.5, y), Offset(9.5, y + 0.4), lines)
        ..drawLine(Offset(14.5, y + 0.4), Offset(18.5, y), lines);
    }
    if (lit) canvas.drawLine(const Offset(12, 6.5), const Offset(12, 19.8), _stroke(_volt, 1.6));
    if (p <= 0.001 || p >= 0.999) return;
    // The turning page: the right page folded about the spine, foreshortened by the turn.
    final fold = math.cos(math.pi * p);
    canvas
      ..save()
      ..translate(12, 0)
      ..scale(fold, 1)
      ..translate(-12, 0)
      // The page is opaque, so the page under it does not show through (the ghost stays a line).
      ..drawPath(_rightPage, Paint()..color = mono == null ? colors.raised : const Color(0x00000000))
      ..drawPath(_rightPage, _stroke(Color.lerp(_ink, _volt, bell(p))!, 1.5))
      ..restore();
  }

  void _smart(Canvas canvas, double p) {
    final b = bell(p);
    const c = Offset(12, 12);
    final outer = 10.4 - 2.6 * b;
    canvas.drawCircle(c, outer, _stroke(_ink.withValues(alpha: 0.3 + 0.4 * b), 1.2));
    // The inner ring is volt and draws itself around the miss during the gesture.
    const inner = 7.2;
    final sweep = p <= 0.001 || p >= 0.999 ? 2 * math.pi : 2 * math.pi * Curves.easeOutCubic.transform(p);
    if (sweep < 2 * math.pi) canvas.drawCircle(c, inner, _stroke(_ink.withValues(alpha: 0.18), 1.5));
    canvas.drawArc(Rect.fromCircle(center: c, radius: inner), -math.pi / 2, sweep, false, _stroke(_volt, 1.6));
    _bubble(canvas, c, 4.2 * (1 - 0.12 * b), BubbleState.wrong);
  }

  void _mock(Canvas canvas, double p) {
    final b = bell(p);
    const c = Offset(12, 13.4);
    final ink = _stroke(_ink, 1.5);
    canvas.drawCircle(c, 7.6, ink);
    // Quarter ticks.
    final tick = _stroke(_ink.withValues(alpha: 0.5), 1.1);
    for (var i = 0; i < 4; i++) {
      final a = i * math.pi / 2;
      final d = Offset(math.cos(a), math.sin(a));
      canvas.drawLine(c + d * 5.4, c + d * 6.4, tick);
    }
    // The crown dips as if pressed.
    final dip = 1.3 * b;
    canvas
      ..drawLine(Offset(12, 4.4 + dip), Offset(12, 5.8), ink)
      ..drawLine(Offset(10, 3.6 + dip), Offset(14, 3.6 + dip), ink)
      ..drawLine(const Offset(18.2, 7.4), const Offset(19.4, 6.2), ink);
    // The hand sweeps one full turn and lands back at twelve.
    final angle = -math.pi / 2 + 2 * math.pi * p;
    final hand = Offset(math.cos(angle), math.sin(angle)) * 5.2;
    final handColor = lit ? _volt : Color.lerp(_ink, _volt, b)!;
    canvas
      ..drawLine(c, c + hand, _stroke(handColor, 1.7))
      ..drawCircle(c, 1.2, Paint()..color = handColor);
  }

  void _nta(Canvas canvas, double p) {
    // The exam palette's own colours: answered, not answered, marked, not visited.
    const answered = Color(0xFF309816);
    const notAnswered = Color(0xFFD84500);
    const marked = Color(0xFF512593);
    const notVisited = Color(0xFFE4E4E4);
    const states = [
      [answered, answered, notAnswered],
      [marked, answered, notVisited],
      [notVisited, notVisited, notVisited],
    ];
    const cell = 5.6;
    const gap = 1.9;
    const origin = 12 - (cell * 1.5 + gap);
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        final i = row * 3 + col;
        // A wave runs through the palette: each cell dips and refills in turn.
        final dipT = p <= 0.001 ? 0.0 : bump(p, 0.18 + i * 0.075, 0.34);
        final s = cell * (1 - 0.42 * dipT);
        final cx = origin + col * (cell + gap) + cell / 2;
        final cy = origin + row * (cell + gap) + cell / 2;
        final rect = Rect.fromCenter(center: Offset(cx, cy), width: s, height: s);
        final fill = states[row][col];
        if (mono != null) {
          // The ghost: answered cells solid, the rest outlined.
          final rr = RRect.fromRectAndRadius(rect, const Radius.circular(1.4));
          canvas.drawRRect(rr, fill == notVisited ? _stroke(mono!, 0.8) : (Paint()..color = mono!));
          continue;
        }
        canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(1.4)), Paint()..color = fill);
        if (fill == notVisited) {
          canvas.drawRRect(RRect.fromRectAndRadius(rect.deflate(0.25), const Radius.circular(1.4)), _stroke(const Color(0xFFB3B3B3), 0.5));
        }
      }
    }
  }

  void _repair(Canvas canvas, double p) {
    final b = bell(p);
    const c = Offset(12, 12);
    final sweep = p <= 0.001 || p >= 0.999 ? 2 * math.pi : 2 * math.pi * Curves.easeOutCubic.transform(p);
    if (sweep < 2 * math.pi) canvas.drawCircle(c, 10, _stroke(_ink.withValues(alpha: 0.18), 1.6));
    canvas.drawArc(Rect.fromCircle(center: c, radius: 10), -math.pi / 2, sweep, false, _stroke(_volt, 1.7));
    _bubble(canvas, c, 6.6 * (1 - 0.12 * b), BubbleState.wrong);
  }

  static final RRect _askBody = RRect.fromRectAndRadius(
    Rect.fromCenter(center: const Offset(12, 10.5), width: 19, height: 13.5),
    const Radius.circular(5),
  );
  static final Path _askTail = Path()
    ..moveTo(7, 16.8)
    ..lineTo(5.6, 21)
    ..lineTo(11, 17.2);

  void _ask(Canvas canvas, double p) {
    final ink = _stroke(_ink2, 1.5);
    canvas
      ..drawRRect(_askBody, ink)
      ..drawPath(_askTail, ink);
    for (var i = 0; i < 3; i++) {
      final hop = p <= 0.001 ? 0.0 : bump(p, 0.22 + i * 0.2, 0.36);
      _bubble(canvas, Offset(12 + (i - 1) * 4.8, 10.5 - 2.6 * hop), 1.6, BubbleState.filled);
    }
  }

  void _resume(Canvas canvas, double p) {
    final b = bell(p);
    for (var i = 0; i < 5; i++) {
      final center = Offset(12 + (i - 2) * 4.7, 12);
      if (i < 3) {
        _bubble(canvas, center, 1.9, BubbleState.filled);
      } else if (i == 3 && b > 0.01) {
        _bubble(canvas, center, 1.9, BubbleState.hollow);
        _bubble(canvas, center, 1.9, BubbleState.filled, fill: b, origin: const Offset(-0.6, 0.4));
      } else {
        _bubble(canvas, center, 1.9, BubbleState.hollow);
      }
    }
  }

  @override
  bool shouldRepaint(ChoiceGlyphPainter old) => old.kind != kind || old.colors != colors || old.lit != lit || old.t != t;
}
