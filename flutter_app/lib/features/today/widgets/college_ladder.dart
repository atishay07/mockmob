// "Your colleges" (ui-blitz/today.md 2.5): the student's picks on one closing-score scale, so the
// gaps between them read at a glance, then the numbered rows with each score. The scale's range
// is fitted to the picks (50 below the lowest, rounded, up to 1000) with a tick every 50; each
// pick is a numbered bubble at its closing score, the dream pick inked. Today has no honest CUET
// score for the student (a short check is never projected to one), so nothing places the
// student on this scale: it shows the targets against each other and against 1000.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'section_heading.dart';
import 'today_entrance.dart';
import 'today_reveal.dart';

class CollegeLadder extends StatelessWidget {
  const CollegeLadder({super.key, required this.road, this.onChoose});

  final RoadModel road;
  final VoidCallback? onChoose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rungs = road.ladder;
    final heading = TodaySectionHeading(
      title: TodayCopy.ladderTitle,
      trailing: onChoose != null && rungs.isNotEmpty ? KeyButton.quiet(label: TodayCopy.changeColleges, onPressed: onChoose) : null,
    );
    if (rungs.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading,
          const SizedBox(height: MmSpace.s4),
          Text(TodayCopy.ladderEmpty, style: type.body.copyWith(color: colors.ink2)),
          if (onChoose != null) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: TodayCopy.chooseColleges, onPressed: onChoose),
          ],
        ],
      );
    }
    final scores = [for (final r in rungs) double.tryParse(r.score)];
    // One scale only when every pick is a number on the same 1000 scale.
    final scaled = scores.every((s) => s != null) && rungs.every((r) => r.outOf == null || r.outOf == 1000);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        heading,
        Text(TodayCopy.ladderCaption(road.category), style: type.caption.copyWith(color: colors.ink3)),
        if (scaled) ...[
          const SizedBox(height: MmSpace.s16),
          _Scale(scores: [for (final s in scores) s!], dream: [for (final r in rungs) r.dream]),
        ],
        const SizedBox(height: MmSpace.s8),
        for (final (i, r) in rungs.indexed) _Rung(index: i, rung: r),
      ],
    );
  }
}

class _Rung extends StatelessWidget {
  const _Rung({required this.index, required this.rung});

  final int index;
  final LadderRung rung;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = rung;
    return Semantics(
      container: true,
      label: '${r.college}, ${r.course}. Closed at ${r.score}${r.outOf == null ? '' : ' of ${r.outOf}'}${r.dream ? '. Your dream pick' : ''}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _Numbered(index: index, dream: r.dream, size: 24),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (r.dream)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        TodayCopy.dreamTag,
                        style: type.caption.copyWith(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w700, color: colors.accentText),
                      ),
                    ),
                  Text(r.college, style: type.labelLarge),
                  Text(r.course, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(r.score, style: type.figureCompact.copyWith(fontSize: 28, height: 1)),
                if (r.outOf != null) ...[
                  const SizedBox(width: MmSpace.s4),
                  Text('of ${r.outOf}', style: type.caption.copyWith(color: colors.ink3)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A pick's number in an answer bubble: inked for the dream pick, a ring for the others.
class _Numbered extends StatelessWidget {
  const _Numbered({required this.index, required this.dream, required this.size});

  final int index;
  final bool dream;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _BubblePainter(colors: colors, dream: dream),
        child: Center(
          child: Text(
            '${index + 1}',
            textScaler: TextScaler.noScaling,
            style: type.label.copyWith(fontSize: size * 0.5, height: 1, fontWeight: FontWeight.w700, color: dream ? colors.voltInk : colors.ink),
          ),
        ),
      ),
    );
  }
}

class _BubblePainter extends CustomPainter {
  const _BubblePainter({required this.colors, required this.dream});

  final MmColors colors;
  final bool dream;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    BubblePaint(colors).paint(canvas, c, r, dream ? BubbleState.filled : BubbleState.hollow);
  }

  @override
  bool shouldRepaint(_BubblePainter old) => old.colors != colors || old.dream != dream;
}

/// The closing-score axis with each pick standing on it.
class _Scale extends StatelessWidget {
  const _Scale({required this.scores, required this.dream});

  final List<double> scores;
  final List<bool> dream;

  @override
  Widget build(BuildContext context) => TodayReveal(child: Builder(builder: _drawn));

  Widget _drawn(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The spread inks along the groove, then the picks rise onto their scores.
    final rise = todayEnterValue(context, delay: const Duration(milliseconds: 60), length: const Duration(milliseconds: 520));
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: const Size(double.infinity, 80),
          painter: _ScalePainter(
            scores: scores,
            dream: dream,
            colors: colors,
            rise: rise,
            tick: type.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w600, color: colors.ink3),
            number: type.label.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    );
  }
}

class _ScalePainter extends CustomPainter {
  _ScalePainter({required this.scores, required this.dream, required this.colors, required this.rise, required this.tick, required this.number})
      : super(repaint: rise);

  final List<double> scores;
  final List<bool> dream;
  final MmColors colors;
  final Animation<double> rise;
  final TextStyle tick;
  final TextStyle number;

  static const double _axisY = 52;
  static const double _r = 10;
  static const double _groove = 6;

  @override
  void paint(Canvas canvas, Size size) {
    final lowest = scores.reduce(math.min);
    final lo = math.max(0.0, ((lowest - 25) / 50).floor() * 50.0);
    const hi = 1000.0;
    const inset = 12.0;
    final w = size.width - inset * 2;
    double x(double s) => inset + w * ((s - lo) / (hi - lo)).clamp(0.0, 1.0);

    // The axis and a tick every 50, labelled every 50 (every 100 when the range is wide).
    final step = hi - lo > 300 ? 100.0 : 50.0;
    // The axis is a groove, the same material as the road above it; the stretch between the
    // lowest and the highest pick is inked, so how wide the picks spread reads at a glance.
    final groove = RRect.fromRectAndRadius(
      Rect.fromLTRB(inset - 3, _axisY - _groove / 2, size.width - inset + 3, _axisY + _groove / 2),
      const Radius.circular(_groove / 2),
    );
    canvas.drawRRect(groove, Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.07 : 0.06));
    canvas.drawRRect(
      groove.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.line,
    );
    for (var v = lo; v <= hi + 0.1; v += 50) {
      final tx = x(v);
      final major = (v - lo) % step == 0;
      canvas.drawLine(Offset(tx, _axisY + _groove / 2 + 2), Offset(tx, _axisY + _groove / 2 + (major ? 6 : 4)), Paint()
        ..color = colors.lineStrong
        ..strokeWidth = 1);
      if (major) _text(canvas, v.toStringAsFixed(0), tick, Offset(tx, _axisY + 18));
    }
    final highest = scores.reduce(math.max);
    final spreadT = (rise.value * 1.6).clamp(0.0, 1.0);
    if (x(highest) - x(lowest) > 1) {
      final a = x(lowest), b = a + (x(highest) - a) * spreadT;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(a - 3, _axisY - _groove / 2, b + 3, _axisY + _groove / 2), const Radius.circular(_groove / 2)),
        Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.42 : 0.36),
      );
    }

    // Picks, lowest row first; a pick too close to one already placed stands a row higher.
    final order = [for (var i = 0; i < scores.length; i++) i]..sort((a, b) => scores[a].compareTo(scores[b]));
    final placed = <({int i, double x, int row})>[];
    for (final i in order) {
      final px = x(scores[i]);
      var row = 0;
      while (placed.any((p) => p.row == row && (p.x - px).abs() < _r * 2 + 3)) {
        row++;
      }
      placed.add((i: i, x: px, row: row));
    }
    final t = ((rise.value - 0.3) / 0.7).clamp(0.0, 1.0);
    double yOf(int row) => _axisY - 18 - row * (_r * 2 + 4) + (1 - t) * 10;
    // Stems first: each from its bubble down to its score on the axis.
    for (final p in placed) {
      canvas.drawLine(Offset(p.x, yOf(p.row) + _r), Offset(p.x, _axisY), Paint()
        ..color = colors.ink.withValues(alpha: 0.35 * t)
        ..strokeWidth = 1);
      canvas.drawCircle(Offset(p.x, _axisY), 3, Paint()..color = colors.ink.withValues(alpha: t));
    }
    // Then the bubbles, each on a disc of the ground so a stem passing behind one stops at it.
    final bubbles = BubblePaint(colors);
    for (final p in placed) {
      final c = Offset(p.x, yOf(p.row));
      canvas.drawCircle(c, _r + 1.5, Paint()..color = colors.ground.withValues(alpha: t));
      bubbles.paint(canvas, c, _r, dream[p.i] ? BubbleState.filled : BubbleState.hollow, dim: t);
      _text(canvas, '${p.i + 1}', number.copyWith(color: (dream[p.i] ? colors.voltInk : colors.ink).withValues(alpha: t)), c);
    }
  }

  void _text(Canvas canvas, String text, TextStyle style, Offset center) {
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, Offset(center.dx - tp.width / 2, center.dy - tp.height / 2));
    tp.dispose();
  }

  @override
  bool shouldRepaint(_ScalePainter old) =>
      old.colors != colors || old.rise != rise || old.scores.join(',') != scores.join(',') || old.dream.join(',') != dream.join(',');
}
