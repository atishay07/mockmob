// "Your colleges" on Today (IA 5.2, app-today-1016 section 10): the last block, after Recent
// papers. With colleges it shows the first three of My colleges on one closing-score scale, so the
// gaps between them read at a glance, then the rows with each Round 1 figure; a row opens that
// programme in Admission Compass and "See all" goes to the Colleges tab. Without colleges it says
// what the student's subjects open and offers Choose colleges (the chooser over Today, L25) and
// Open Compass. Neither key is volt: the hero keeps the page's one primary. Today has no honest
// CUET score for the student, so nothing places the student on this scale.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/copy/sentences.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../tools/my_colleges/my_colleges_copy.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'section_heading.dart';
import 'today_entrance.dart';
import 'today_reveal.dart';
import 'today_tones.dart';
import 'today_type.dart';

/// Where the card's list stands.
enum CollegesCardStatus { loading, failed, ready }

/// What the card knows beyond the road: the list's state and what the subjects open in Compass.
class CollegesCardInfo {
  const CollegesCardInfo({this.status = CollegesCardStatus.ready, this.open, this.total});

  final CollegesCardStatus status;

  /// DU programmes open to the student's subjects, of [total]; null when not known yet.
  final int? open, total;
}

class CollegesCard extends StatelessWidget {
  const CollegesCard({
    super.key,
    required this.road,
    this.info = const CollegesCardInfo(),
    this.onChoose,
    this.onSeeAll,
    this.onCompass,
    this.onRow,
    this.onRetry,
  });

  final RoadModel road;
  final CollegesCardInfo info;

  /// Opens the My colleges chooser over Today.
  final VoidCallback? onChoose;

  /// The Colleges tab.
  final VoidCallback? onSeeAll;

  /// Admission Compass.
  final VoidCallback? onCompass;

  /// A row: that programme in Compass.
  final void Function(LadderRung rung)? onRow;

  /// The list did not load: read it again.
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rungs = road.ladder;
    final status = rungs.isNotEmpty ? CollegesCardStatus.ready : info.status;
    final heading = TodaySectionHeading(
      title: TodayCopy.collegesTitle,
      trailing: onSeeAll != null && rungs.isNotEmpty ? KeyButton.quiet(label: TodayCopy.seeAllColleges, onPressed: onSeeAll) : null,
    );
    final Widget body;
    switch (status) {
      case CollegesCardStatus.loading:
        // Three rows at their loaded height, so the page does not move when the list arrives.
        body = const Column(
          key: ValueKey('colleges-loading'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [SizedBox(height: MmSpace.s8), MmSkeletonRows(rows: 3)],
        );
      case CollegesCardStatus.failed:
        body = Column(
          key: const ValueKey('colleges-failed'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MmSpace.s4),
            Text(TodayCopy.collegesFailed, style: type.body.copyWith(color: colors.ink2)),
            if (onRetry != null) ...[
              const SizedBox(height: MmSpace.s12),
              Wrap(children: [KeyButton.secondary(label: TodayCopy.tryAgain, onPressed: onRetry)]),
            ],
          ],
        );
      case CollegesCardStatus.ready when rungs.isEmpty:
        final known = info.open != null && info.total != null && info.total! > 0;
        body = Column(
          key: const ValueKey('colleges-none'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MmSpace.s4),
            Text(
              known ? TodayCopy.collegesOpenCount(info.open!, info.total!) : TodayCopy.collegesOpenUnknown,
              style: type.body.copyWith(color: colors.ink2),
            ),
            const SizedBox(height: MmSpace.s12),
            Wrap(
              spacing: MmSpace.s8,
              runSpacing: MmSpace.s4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (onChoose != null) KeyButton.secondary(label: TodayCopy.chooseCollegesShort, onPressed: onChoose),
                if (onCompass != null) KeyButton.quiet(label: TodayCopy.openCompass, onPressed: onCompass),
              ],
            ),
          ],
        );
      case CollegesCardStatus.ready:
        final scores = [for (final r in rungs) double.tryParse(r.score)];
        // One scale only when every pick is a number on the same 1000 scale.
        final scaled = scores.every((s) => s != null) && rungs.every((r) => r.outOf == null || r.outOf == 1000);
        body = Column(
          key: const ValueKey('colleges-some'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (scaled) ...[
              const SizedBox(height: MmSpace.s12),
              _Scale(scores: [for (final s in scores) s!], dream: [for (final r in rungs) r.dream]),
            ],
            const SizedBox(height: MmSpace.s8),
            for (final (i, r) in rungs.indexed)
              _Rung(index: i, rung: r, onTap: onRow == null || r.programmeId == null ? null : () => onRow!(r)),
            const SizedBox(height: MmSpace.s4),
            Text(TodayCopy.ladderCaption(road.category), style: type.caption.copyWith(color: colors.ink3)),
          ],
        );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        heading,
        MmSizeEase(
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: MmOverlapSwitcher.fade(alignment: Alignment.topLeft, child: body),
        ),
      ],
    );
  }
}

class _Rung extends StatelessWidget {
  const _Rung({required this.index, required this.rung, this.onTap});

  final int index;
  final LadderRung rung;

  /// Opens the programme in Compass; null leaves the row as text.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = rung;
    final label = joinSentences([
      '${r.college}, ${r.course}',
      r.score.isEmpty ? MyCollegesCopy.noFigure : 'Closed at ${r.score}${r.outOf == null ? '' : ' of ${r.outOf}'}',
      if (r.dream) 'Your dream pick',
    ]);
    final row = Semantics(
      container: true,
      label: label,
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
            if (r.score.isEmpty)
              // No Round 1 figure on file for this college and category: say so, never a number.
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 96),
                child: Text(MyCollegesCopy.noFigure, textAlign: TextAlign.right, style: type.caption.copyWith(color: colors.ink3)),
              )
            else
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
    if (onTap == null) return row;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(constraints: const BoxConstraints(minHeight: 56), child: row),
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
    final rise = todayEnterValue(context, delay: const Duration(milliseconds: 60), length: Motion.drawIn);
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
