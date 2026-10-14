// "Your colleges" (ui-blitz/today.md 2.5): the student's picks on one closing-score scale, so the
// gaps between them read at a glance, then the numbered rows with each score. The scale's range
// is fitted to the picks (50 below the lowest, rounded, up to 1000) with a tick every 50; each
// pick is its number on a stem at its closing score, the dream pick a volt chip. No bubbles:
// the answer-bubble motif stays with the week and the evidence, where it carries state. Today has no honest CUET
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
import 'today_tones.dart';
import 'today_type.dart';

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
            SizedBox(
              width: 28,
              child: Text('${index + 1}', style: type.pickNumber.copyWith(color: r.dream ? colors.litMark : colors.ink3)),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (r.dream)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        TodayCopy.dreamTag,
                        style: type.microStrong.copyWith(color: colors.accentText),
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
                Text(r.score, style: type.scoreFigure),
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
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    // The spread inks along the groove, then the picks rise onto their scores.
    final rise = todayEnterValue(context, delay: const Duration(milliseconds: 60), length: const Duration(milliseconds: 520));
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: LayoutBuilder(
          builder: (context, box) {
            final layout = _ScaleLayout(scores, box.maxWidth);
            return CustomPaint(
              size: Size(double.infinity, layout.height + (scaler.scale(12) - 12) * 2),
              painter: _ScalePainter(
                layout: layout,
                dream: dream,
                colors: colors,
                rise: rise,
                scaler: scaler,
                tick: type.micro.copyWith(height: 1, fontWeight: FontWeight.w600, color: colors.ink3),
                number: type.pickMark,
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Where each pick stands for a given width: the axis range fitted to the picks, each pick's x,
/// and the row it takes (a pick too close to one already placed stands a row higher).
class _ScaleLayout {
  _ScaleLayout(this.scores, this.width) {
    final lowest = scores.reduce(math.min);
    lo = math.max(0.0, ((lowest - 25) / 50).floor() * 50.0);
    final order = [for (var i = 0; i < scores.length; i++) i]..sort((a, b) => scores[a].compareTo(scores[b]));
    for (final i in order) {
      final px = x(scores[i]);
      var row = 0;
      while (placed.any((p) => p.row == row && (p.x - px).abs() < markWidth + 3)) {
        row++;
      }
      placed.add((i: i, x: px, row: row));
    }
    rows = placed.map((p) => p.row).reduce(math.max) + 1;
  }

  final List<double> scores;
  final double width;
  late final double lo;
  late final int rows;
  final List<({int i, double x, int row})> placed = [];

  static const double hi = 1000;
  static const double inset = 14;
  static const double markWidth = 22;
  static const double markHeight = 22;
  static const double rowStep = markHeight + 4;

  double x(double s) => inset + (width - inset * 2) * ((s - lo) / (hi - lo)).clamp(0.0, 1.0);

  /// The axis sits under the stacked rows of marks and their stems.
  double get axisY => 14 + markHeight / 2 + (rows - 1) * rowStep + 12;
  double get height => axisY + 32;
}

class _ScalePainter extends CustomPainter {
  _ScalePainter({
    required this.layout,
    required this.dream,
    required this.colors,
    required this.rise,
    required this.scaler,
    required this.tick,
    required this.number,
  }) : super(repaint: rise);

  final _ScaleLayout layout;
  final List<bool> dream;
  final MmColors colors;
  final Animation<double> rise;
  final TextScaler scaler;
  final TextStyle tick;
  final TextStyle number;

  static const double _groove = 12;

  @override
  void paint(Canvas canvas, Size size) {
    final lo = layout.lo;
    const hi = _ScaleLayout.hi;
    final axisY = layout.axisY;
    double x(double s) => layout.x(s);
    final scores = layout.scores;

    // The axis and a tick every 50, labelled every 50 (every 100 when the range is wide).
    final step = hi - lo > 300 ? 100.0 : 50.0;
    // The axis is a groove, the same material as the road above it; the stretch between the
    // lowest and the highest pick is inked, so how wide the picks spread reads at a glance.
    final groove = RRect.fromRectAndRadius(
      Rect.fromLTRB(_ScaleLayout.inset - 4, axisY - _groove / 2, size.width - _ScaleLayout.inset + 4, axisY + _groove / 2),
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
      canvas.drawLine(
        Offset(tx, axisY + _groove / 2 + 2),
        Offset(tx, axisY + _groove / 2 + (major ? 7 : 4)),
        Paint()
          ..color = colors.lineStrong
          ..strokeWidth = 1,
      );
      if (major) _text(canvas, v.toStringAsFixed(0), tick, Offset(tx, axisY + _groove / 2 + 7 + 9));
    }
    final lowest = scores.reduce(math.min), highest = scores.reduce(math.max);
    final spreadT = (rise.value * 1.6).clamp(0.0, 1.0);
    if (x(highest) - x(lowest) > 1) {
      final a = x(lowest), b = a + (x(highest) - a) * spreadT;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(a - 4, axisY - _groove / 2, b + 4, axisY + _groove / 2), const Radius.circular(_groove / 2)),
        Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.42 : 0.36),
      );
    }

    final t = ((rise.value - 0.3) / 0.7).clamp(0.0, 1.0);
    double yOf(int row) => axisY - 20 - row * _ScaleLayout.rowStep + (1 - t) * 10;
    // Stems first: each from its mark down to its score, where a short pin crosses the groove.
    for (final p in layout.placed) {
      canvas.drawLine(
        Offset(p.x, yOf(p.row) + _ScaleLayout.markHeight / 2),
        Offset(p.x, axisY),
        Paint()
          ..color = colors.ink.withValues(alpha: 0.4 * t)
          ..strokeWidth = 1,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(p.x, axisY), width: 2.5, height: _groove + 2), const Radius.circular(1.25)),
        Paint()..color = (dream[p.i] ? colors.litMark : colors.ink).withValues(alpha: t),
      );
    }
    // Then the marks: the dream pick a volt chip, the others a number on the ground so a stem
    // passing behind one stops at it.
    for (final p in layout.placed) {
      final c = Offset(p.x, yOf(p.row));
      final chip = RRect.fromRectAndRadius(
        Rect.fromCenter(center: c, width: _ScaleLayout.markWidth, height: _ScaleLayout.markHeight),
        const Radius.circular(7),
      );
      final isDream = dream[p.i];
      canvas.drawRRect(chip, Paint()..color = (isDream ? colors.volt : colors.ground).withValues(alpha: t));
      _text(canvas, '${p.i + 1}', number.copyWith(color: (isDream ? colors.voltInk : colors.ink).withValues(alpha: t)), c);
    }
  }

  void _text(Canvas canvas, String text, TextStyle style, Offset center) {
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)..layout();
    tp.paint(canvas, Offset(center.dx - tp.width / 2, center.dy - tp.height / 2));
    tp.dispose();
  }

  @override
  bool shouldRepaint(_ScalePainter old) =>
      old.colors != colors ||
      old.rise != rise ||
      old.scaler != scaler ||
      old.layout.width != layout.width ||
      old.layout.scores.join(',') != layout.scores.join(',') ||
      old.dream.join(',') != dream.join(',');
}
