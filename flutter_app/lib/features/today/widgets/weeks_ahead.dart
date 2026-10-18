// The weeks ahead (D52 item 2, TODAY-SWIPE-1018, mock today.html #ahead): a vertical timeline in
// v10's dated-list form, never a strip to decode (N1). Next week first, with its planned weekdays as
// chips (the suggested mock's day filled) and the stopwatch when a full mock is suggested; then two
// more weeks; then "Then, at this pace": half the goal, registration, the boards and CUET UG with
// its date pill. A week row opens Change plan for that week. On the ground, split by hairlines, no
// card. The rows draw in once, top to bottom, the first time the block comes into view (40 ms
// apart, 220 ms ease-out, 6 dp and opacity); under reduced motion everything is in place at once.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart' show HybridStopwatch, StopwatchMode;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_ahead.dart';
import '../logic/today_model.dart';
import '../logic/weeks_ahead.dart';
import 'glance_rows.dart' show GlanceHead;
import 'plan_flow_sheet.dart' show PlanFlowBody, PlanFooterHost, PlanFooterSlot;
import 'reveal_once.dart';
import 'road_section.dart' show RoadActions;
import 'today_tones.dart';
import 'today_type.dart';

/// Change plan, opened from one week of the timeline: the plan's own sentence on its study days
/// (the week's figures are its study days and its suggested mock), titled with the week.
Future<String?> showWeekPlan(BuildContext context, {required AheadWeek week, required RoadLayers layers, required RoadModel road, RoadActions? actions}) {
  final slot = PlanFooterSlot();
  return showMmSheet<String>(
    context: context,
    title: AheadCopy.planTitle(week.monday),
    builder: (context) => PlanFlowBody(layers: layers, road: road, actions: actions, initialStep: 1, footerSlot: slot),
    footer: (context) => PlanFooterHost(slot: slot),
  );
}

class WeeksAheadBlock extends StatelessWidget {
  const WeeksAheadBlock({super.key, required this.ahead, this.onWeek});

  final WeeksAhead ahead;

  /// A week row's tap: Change plan for that week. Without it the rows are plain.
  final ValueChanged<AheadWeek>? onWeek;

  /// The left rail's width: the nodes sit on its centre line.
  static const double rail = 28;

  /// One row's entrance and the gap between rows (D52 motion).
  static const Duration rowLength = Duration(milliseconds: 220);
  static const Duration stagger = Duration(milliseconds: 40);

  @override
  Widget build(BuildContext context) {
    final a = ahead;
    final rows = <Widget Function(bool first, bool last)>[
      for (final w in a.weeks) (first, last) => _WeekRow(week: w, first: first, last: last, mockTarget: a.mockTarget, onTap: onWeek == null ? null : () => onWeek!(w)),
      if (a.weeks.isNotEmpty) (first, last) => _ThenRow(first: first, last: last),
      for (final m in a.milestones) (first, last) => _MilestoneRow(milestone: m, ahead: a, first: first, last: last),
    ];
    final count = rows.length;
    final total = rowLength + stagger * (count - 1).clamp(0, 99);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        GlanceHead(title: AheadCopy.title, sub: a.perWeek == null ? AheadCopy.datesOnly : AheadCopy.pace(a.perWeek!)),
        const SizedBox(height: MmSpace.s8),
        RevealOnce(
          length: total,
          builder: (context, progress) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var k = 0; k < count; k++)
                _Arrive(
                  progress: progress,
                  start: (stagger * k).inMicroseconds / total.inMicroseconds,
                  end: (stagger * k + rowLength).inMicroseconds / total.inMicroseconds,
                  child: rows[k](k == 0, k == count - 1),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// One row's arrival: 6 dp up and in, ease-out; once landed it stands alone with no layer.
class _Arrive extends StatelessWidget {
  const _Arrive({required this.progress, required this.start, required this.end, required this.child});

  final Animation<double> progress;
  final double start;
  final double end;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (progress.isCompleted) return child;
    return AnimatedBuilder(
      animation: progress,
      child: child,
      builder: (context, child) {
        final v = Motion.out.transform(Interval(start.clamp(0.0, 1.0), end.clamp(0.0, 1.0)).transform(progress.value));
        if (v >= 1) return child!;
        return Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 6 * (1 - v)), child: child));
      },
    );
  }
}

enum _Node { now, week, then, small, band, goal }

/// The rail beside a row: the line through it (from the first node, to the last) and its node.
class _RailPainter extends CustomPainter {
  _RailPainter({required this.node, required this.nodeY, required this.first, required this.last, required this.colors});

  final _Node node;
  final double nodeY;
  final bool first;
  final bool last;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    const x = 8.0;
    final line = Paint()
      ..color = colors.line
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final from = first ? nodeY : 0.0;
    final to = last ? nodeY : size.height;
    if (to > from) canvas.drawLine(Offset(x, from), Offset(x, to), line);
    final c = Offset(x, nodeY);
    final mark = colors.litMark;
    switch (node) {
      case _Node.now:
        // Next week: a ring in the mark colour with a dot inside, on a flat 4 dp halo (no blur).
        canvas.drawCircle(c, 12, Paint()..color = colors.voltGlow);
        canvas.drawCircle(c, 8, Paint()..color = colors.ground);
        canvas.drawCircle(c, 7, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = mark);
        canvas.drawCircle(c, 4, Paint()..color = mark);
      case _Node.week:
        canvas.drawCircle(c, 8, Paint()..color = colors.ground);
        canvas.drawCircle(c, 7, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = colors.ink2);
      case _Node.then:
        break;
      case _Node.small:
        canvas.drawCircle(c, 5, Paint()..color = colors.ground);
        canvas.drawCircle(c, 4, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = colors.ink3);
      case _Node.band:
        canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: 14, height: 18), const Radius.circular(3)), Paint()..color = colors.lineStrong);
      case _Node.goal:
        canvas.drawCircle(c, 9, Paint()..color = mark);
    }
  }

  @override
  bool shouldRepaint(_RailPainter old) => old.node != node || old.nodeY != nodeY || old.first != first || old.last != last || old.colors != colors;
}

/// A row with its rail: the rail fills the row's height, the content sits to its right.
class _Railed extends StatelessWidget {
  const _Railed({required this.node, required this.nodeY, required this.first, required this.last, required this.child});

  final _Node node;
  final double nodeY;
  final bool first;
  final bool last;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Stack(
      children: [
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          width: WeeksAheadBlock.rail,
          child: ExcludeSemantics(child: CustomPaint(painter: _RailPainter(node: node, nodeY: nodeY, first: first, last: last, colors: colors))),
        ),
        Padding(padding: const EdgeInsets.only(left: WeeksAheadBlock.rail), child: child),
      ],
    );
  }
}

class _WeekRow extends StatelessWidget {
  const _WeekRow({required this.week, required this.first, required this.last, required this.mockTarget, this.onTap});

  final AheadWeek week;
  final bool first;
  final bool last;
  final int mockTarget;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = week;
    final title = AheadCopy.weekTitle(days: w.studyDays, mocks: w.mocks.length, revise: w.reviseBack);
    final String? line = w.mocks.isNotEmpty
        ? AheadCopy.mockLine(w.mocks.first.number, mockTarget, w.mocks.first.on)
        : (w.reviseBack != null && w.reviseBack! > 0 ? AheadCopy.reviseLine : (w.boards ? AheadCopy.boardsWeek : null));
    final whenTop = w.next ? AheadCopy.nextWeek : AheadCopy.weekOf;
    final whenBottom = w.next ? AheadCopy.range(w.monday, w.sunday) : AheadCopy.dayMonth(w.monday);
    final scale = MediaQuery.textScalerOf(context).scale(15) / 15;
    final strong = type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w600, color: colors.ink);
    final quiet = type.caption.copyWith(fontSize: 13, height: 18 / 13, color: colors.ink3);
    // The first line of the when column: "Next week" strong over its dates, or "Week of" quiet over the date.
    final when = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(whenTop, style: w.next ? strong : quiet),
        Text(whenBottom, style: w.next ? quiet : strong),
      ],
    );
    final chips = w.days == null ? null : _DayChips(planned: w.days!, mockDays: {for (final m in w.mocks) m.on.weekday - 1});
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(title, style: strong),
        if (line != null) ...[
          const SizedBox(height: 2),
          Text(line, style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2)),
        ],
        if (chips != null && w.next) ...[const SizedBox(height: MmSpace.s8), chips],
      ],
    );
    final thumb = w.next && w.mocks.isNotEmpty;
    final trailing = thumb
        ? const Padding(padding: EdgeInsets.only(top: 2), child: SizedBox(width: 44, height: 44, child: HybridStopwatch(height: 44, mode: StopwatchMode.stages)))
        : (onTap == null ? null : Padding(padding: const EdgeInsets.only(top: 1), child: Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3)));
    return MmPressable(
      onTap: onTap,
      semanticsLabel: AheadCopy.weekSemantics('$whenTop $whenBottom', title, line),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      builder: (context, pressed, _) => _Railed(
        node: w.next ? _Node.now : _Node.week,
        nodeY: 14 + 12 * scale.clamp(1.0, 1.6),
        first: first,
        last: last,
        child: Container(
          decoration: BoxDecoration(
            color: pressed ? colors.raised2.withValues(alpha: 0.5) : Colors.transparent,
            border: Border(top: BorderSide(color: colors.line)),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: LayoutBuilder(
            builder: (context, box) {
              final whenWidth = 92 * scale.clamp(1.0, 1.3);
              final trailingWidth = thumb ? 44.0 : (trailing == null ? 0.0 : 18.0);
              final room = box.maxWidth - whenWidth - 12 - (trailingWidth > 0 ? trailingWidth + 12 : 0);
              // Too narrow for the when column (a small phone at large text): it sits over the body instead.
              if (room < 150) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [when, const SizedBox(height: MmSpace.s6), body],
                      ),
                    ),
                    if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing],
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: whenWidth, child: when),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: body),
                  if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The planned weekdays as one-letter chips: planned ringed, the suggested mock's day filled.
class _DayChips extends StatelessWidget {
  const _DayChips({required this.planned, required this.mockDays});

  final Set<int> planned;
  final Set<int> mockDays;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final letter = type.micro.copyWith(fontWeight: FontWeight.w700, height: 1);
    return ExcludeSemantics(
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          for (var d = 0; d < 7; d++)
            () {
              final mock = mockDays.contains(d);
              final on = planned.contains(d);
              return Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: mock ? colors.ink : null,
                  border: on && !mock ? Border.all(color: colors.ink2, width: 1.5) : null,
                ),
                child: Text(
                  AheadCopy.dayLetters[d],
                  textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15),
                  style: letter.copyWith(color: mock ? colors.ground : (on ? colors.ink : colors.ink4)),
                ),
              );
            }(),
        ],
      ),
    );
  }
}

class _ThenRow extends StatelessWidget {
  const _ThenRow({required this.first, required this.last});

  final bool first;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return _Railed(
      node: _Node.then,
      nodeY: 0,
      first: first,
      last: last,
      child: Container(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        padding: const EdgeInsets.only(top: 14, bottom: 6),
        child: Text(AheadCopy.then, style: type.caption.copyWith(fontSize: 13, color: colors.ink3)),
      ),
    );
  }
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow({required this.milestone, required this.ahead, required this.first, required this.last});

  final AheadMilestone milestone;
  final WeeksAhead ahead;
  final bool first;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = milestone;
    final a = ahead;
    final String title;
    String? right;
    String? line;
    var node = _Node.small;
    switch (m.kind) {
      case AheadMilestoneKind.halfGoal:
        title = AheadCopy.halfGoal(m.number!, a.mockTarget);
        right = AheadCopy.about(m.from);
      case AheadMilestoneKind.registration:
        title = AheadCopy.registration;
        right = AheadCopy.dayShort(m.from);
        line = AheadCopy.registrationLine(m.daysAway);
      case AheadMilestoneKind.boards:
        title = AheadCopy.boards;
        right = AheadCopy.span(m.from, m.to ?? m.from);
        final perWeek = a.perWeek;
        line = perWeek != null && perWeek > 2 ? AheadCopy.boardsLine(2) : null;
        node = _Node.band;
      case AheadMilestoneKind.exam:
        title = AheadCopy.exam(own: a.ownDate);
        line = AheadCopy.examLine(days: a.daysToExam, studyDays: a.studyDaysLeft, mocksLeft: a.mocksLeft);
        node = _Node.goal;
    }
    final scale = MediaQuery.textScalerOf(context).scale(15) / 15;
    final strong = type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w600, color: colors.ink);
    final exam = m.kind == AheadMilestoneKind.exam;
    final Widget? trailing = exam
        ? Container(
            height: 24 * scale.clamp(1.0, 1.3),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            alignment: Alignment.center,
            decoration: ShapeDecoration(color: colors.volt, shape: const StadiumBorder()),
            child: Text(AheadCopy.dayShort(m.from), maxLines: 1, style: type.micro.copyWith(fontWeight: FontWeight.w700, height: 1, color: colors.voltInk)),
          )
        : (right == null ? null : Text(right, style: type.caption.copyWith(fontSize: 13, height: 20 / 13, color: colors.ink3)));
    return Semantics(
      container: true,
      child: _Railed(
        node: node,
        nodeY: 8 + 10 * scale.clamp(1.0, 1.6),
        first: first,
        last: last,
        child: Padding(
          padding: EdgeInsets.only(top: 8, bottom: exam ? 4 : 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(title, style: strong)),
                  if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing],
                ],
              ),
              if (line != null) ...[
                const SizedBox(height: 2),
                Text(line, style: type.small.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
