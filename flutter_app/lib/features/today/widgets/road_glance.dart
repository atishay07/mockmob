// Road to CUET (TODAY-1018 section 3 row 4, and the owner's 3:30 am words: "respecting information
// like what's due today, what's due for the week, and showing the overall goal"; D26). One outlined
// surface that reads at a glance, top to bottom:
//
// * the distance: "27 weeks to CUET UG", "Expected from Sat 1 May 2027" (tap: Change plan);
// * Due today: what today asks, as answer bubbles (filled when done), and the next one in words;
// * Due this week: the week's plan (the study days and the full mock the pace asks for), what is
//   left and by when;
// * Overall goal: full mocks taken of the target as a row of bubbles, the pace that reaches it and
//   the study days left.
//
// The bubbles are the answer sheet's own (MockMob's mark), inked in the page's ink, not volt: volt
// stays on the one lead key and the counted days of This week (no glow, no neon, D7). Each layer
// opens in place to its items, each one a tap from its screen. Calendar arithmetic and the
// student's own plan only: no predictions, and an unknown count says so (never 0).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../copy_glance.dart';
import '../logic/today_model.dart';
import 'plan_flow_sheet.dart';
import 'road_section.dart' show RoadActions;

class RoadGlance extends StatefulWidget {
  const RoadGlance({super.key, required this.layers, required this.road, this.actions, this.onOpen, this.initialOpen});

  final RoadLayers layers;
  final RoadModel road;

  /// Where Change plan saves; without it the plan still opens, and its answers save nowhere.
  final RoadActions? actions;

  /// A due item opens its screen through this.
  final void Function(TodayTarget target)? onOpen;

  /// A layer open from the start (goldens and tests).
  final int? initialOpen;

  @override
  State<RoadGlance> createState() => _RoadGlanceState();
}

class _RoadGlanceState extends State<RoadGlance> {
  late int? _open = widget.initialOpen;
  String? _receipt;

  void _toggle(int layer) {
    HapticFeedback.selectionClick();
    setState(() => _open = _open == layer ? null : layer);
  }

  Future<void> _changePlan() async {
    final receipt = await showPlanFlow(context, layers: widget.layers, road: widget.road, actions: widget.actions);
    if (receipt != null && mounted) setState(() => _receipt = receipt);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final l = widget.layers;
    final countWeeks = l.days >= 7;
    final figure = countWeeks ? l.weeks : l.days;
    final windowOpen = widget.road.phase == RoadPhase.window;
    final dateLine = l.ownDate ? GlanceCopy.yourDate(l.examDate) : GlanceCopy.expectedFrom(l.examDate);
    final unit = countWeeks ? TodayCopy.roadWeeksTo(own: l.ownDate, n: figure) : TodayCopy.roadDaysTo(own: l.ownDate, n: figure);

    // The distance and the date: the plan's own answers, so a tap opens Change plan on them.
    final head = MmPressable(
      key: const ValueKey('road-head'),
      onTap: _changePlan,
      semanticsLabel: GlanceCopy.roadHeadSemantics(windowOpen ? TodayCopy.windowOpen : '$figure $unit', dateLine),
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s4, MmSpace.s8, MmSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (windowOpen)
              Text(TodayCopy.windowOpen, style: type.figureCompact.copyWith(fontSize: 34, height: 1.1, color: colors.ink))
            else
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  MmCountUp(
                    value: figure,
                    fromZeroOnFirstBuild: false,
                    style: type.figureCompact.copyWith(fontSize: 52, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Flexible(child: Text(unit, style: type.title.copyWith(fontSize: 19, color: colors.ink))),
                ],
              ),
            const SizedBox(height: MmSpace.s4),
            Text(dateLine, style: type.caption.copyWith(fontSize: 14, color: pressed ? colors.ink : colors.ink2)),
          ],
        ),
      ),
    );

    // Due today.
    final todayLeft = [for (final t in l.today) if (!t.done) t];
    final todayPips = <_Pip>[
      for (final t in l.today) if (t.done) _Pip.done,
      for (var k = 0; k < todayLeft.length; k++) k == 0 ? _Pip.next : _Pip.todo,
    ];
    final today = _Layer(
      index: 0,
      label: GlanceCopy.layerToday,
      figure: l.todayTotal == 0 ? GlanceCopy.allDoneToday : GlanceCopy.doneOf(l.todayDone, l.todayTotal),
      pips: todayPips,
      line: todayLeft.isEmpty ? (l.todayTotal == 0 ? null : GlanceCopy.allDoneToday) : GlanceCopy.nextToday(todayLeft.first.label),
      open: _open == 0,
      onTap: () => _toggle(0),
      detail: _Detail(items: l.today, onOpen: widget.onOpen),
    );

    // Due this week: the study days the goal asks for, then the full mock the pace asks for.
    final goal = l.weekGoal;
    final daysDone = goal == null ? l.weekDays : math.min(l.weekDays, goal);
    final weekPips = goal == null
        ? const <_Pip>[]
        : <_Pip>[
            for (var k = 0; k < goal; k++) k < daysDone ? _Pip.done : (k == daysDone ? _Pip.next : _Pip.todo),
            for (var k = 0; k < l.weekMocksPlanned; k++) k < l.weekMocksDone ? _Pip.paperDone : _Pip.paper,
          ];
    final daysLeft = goal == null ? 0 : math.max(0, goal - l.weekDays);
    final mocksLeft = math.max(0, l.weekMocksPlanned - l.weekMocksDone);
    final String weekLine;
    if (!l.weekKnown) {
      weekLine = TodayCopy.weekNotRead;
    } else if (goal == null) {
      weekLine = GlanceCopy.setDaysHint;
    } else if (daysLeft == 0 && mocksLeft == 0) {
      weekLine = l.nextMockOn == null ? GlanceCopy.weekPlanDone : GlanceCopy.weekPlanDoneNext(l.nextMockOn!);
    } else if (daysLeft > 0 && l.weekDaysOpen != null && daysLeft > l.weekDaysOpen!) {
      // More study days are asked than there are days to come (Sunday already counted, say): "Left: 1 study day by Sun"
      // promised a day that does not exist (v15 walk). The full mock, if one is due, is still said.
      weekLine = mocksLeft == 0
          ? GlanceCopy.weekGoalOutOfReach
          : '${GlanceCopy.weekLeft(days: 0, mocks: mocksLeft, by: l.weekEnds)} ${GlanceCopy.weekGoalOutOfReach}';
    } else {
      final left = GlanceCopy.weekLeft(days: daysLeft, mocks: mocksLeft, by: l.weekEnds);
      weekLine = mocksLeft == 0 && l.nextMockOn != null ? GlanceCopy.weekLeftNext(left, l.nextMockOn!) : left;
    }
    final week = _Layer(
      index: 1,
      label: GlanceCopy.layerWeek,
      figure: !l.weekKnown ? null : (goal == null ? GlanceCopy.studyDaysNoGoal(l.weekDays) : GlanceCopy.weekFigure(l.plannedDone, l.planned)),
      pips: weekPips,
      line: weekLine,
      open: _open == 1,
      onTap: () => _toggle(1),
      detail: _Detail(items: l.weekItems, onOpen: widget.onOpen),
    );

    // The overall goal: full mocks taken of the target.
    final known = l.mocksKnown;
    final met = known && l.mocksTaken >= l.mockTarget;
    final goalLine = known
        ? GlanceCopy.goalLine(pace: l.pace, suggested: l.targetSuggested, met: met, studyLeft: l.studyDaysLeft, perWeek: l.perWeek)
        : (l.studyDaysLeft != null && l.perWeek != null ? GlanceCopy.itemStudyLeft(l.studyDaysLeft!, l.perWeek!) : null);
    final overall = _Layer(
      index: 2,
      label: GlanceCopy.layerGoal,
      figure: known ? GlanceCopy.mocksOf(l.mocksTaken, l.mockTarget) : GlanceCopy.mocksUnknown,
      pips: known ? [for (var k = 0; k < l.mockTarget; k++) k < l.mocksTaken ? _Pip.paperDone : (k == l.mocksTaken ? _Pip.paperNext : _Pip.paper)] : const [],
      line: goalLine,
      open: _open == 2,
      onTap: () => _toggle(2),
      detail: _Detail(items: l.goalItems, onOpen: widget.onOpen),
    );

    final rule = Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
      child: Divider(height: 1, thickness: 1, color: colors.line),
    );
    final milestone = l.milestone;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(GlanceCopy.roadTitle, style: type.title.copyWith(fontSize: 19))),
        const SizedBox(height: MmSpace.s12),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.35) : colors.raised.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: colors.line),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s16, MmSpace.s12, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                head,
                const SizedBox(height: MmSpace.s12),
                today,
                rule,
                week,
                rule,
                overall,
                rule,
                const SizedBox(height: MmSpace.s12),
                if (milestone != null)
                  Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8), child: _Milestone(text: milestone)),
                if (_receipt != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                    child: Text(_receipt!, style: type.caption.copyWith(fontSize: 13.5, color: colors.ink2)),
                  ),
                ],
                const SizedBox(height: MmSpace.s12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                  child: Align(alignment: Alignment.centerRight, child: _PlanKey(onTap: _changePlan)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// One layer: its label and figure, its bubbles, one line, and its items when open. The whole
/// layer is the button (one target, at least 48 dp).
class _Layer extends StatelessWidget {
  const _Layer({
    required this.index,
    required this.label,
    required this.figure,
    required this.pips,
    required this.line,
    required this.open,
    required this.onTap,
    required this.detail,
  });

  final int index;
  final String label;

  /// Null when the layer's count is not known (it is never shown as 0).
  final String? figure;
  final List<_Pip> pips;
  final String? line;
  final bool open;
  final VoidCallback onTap;
  final Widget detail;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MmPressable(
          key: ValueKey('road-layer-$index'),
          onTap: onTap,
          semanticsLabel: GlanceCopy.layerSemantics(label, figure ?? '', line ?? '', open),
          selected: open,
          focusRadius: MmRadius.smallAll,
          pressedScale: 0.99,
          builder: (context, pressed, _) => AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            constraints: const BoxConstraints(minHeight: MmTarget.min),
            padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s12, MmSpace.s8, MmSpace.s12),
            decoration: BoxDecoration(
              color: pressed ? colors.raised2.withValues(alpha: colors.isNight ? 0.7 : 0.8) : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(label, style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: colors.ink2)),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Text(
                        figure ?? '',
                        textAlign: TextAlign.end,
                        maxLines: 2,
                        style: type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w700, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s6),
                    AnimatedRotation(
                      turns: open ? 0.5 : 0,
                      duration: Motion.of(context, const Duration(milliseconds: 220)),
                      curve: Motion.out,
                      child: Icon(LucideIcons.chevronDown, size: 16, color: colors.ink3),
                    ),
                  ],
                ),
                if (pips.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s8),
                  _Pips(pips: pips),
                ],
                if (line != null) ...[
                  const SizedBox(height: MmSpace.s6),
                  Text(line!, maxLines: 3, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(fontSize: 13.5, height: 19 / 13.5, color: colors.ink2)),
                ],
              ],
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.ui,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.hardEdge,
          child: open
              ? Padding(key: ValueKey('road-detail-$index'), padding: const EdgeInsets.only(bottom: MmSpace.s8), child: detail)
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// What a bubble on the road says. Study days and today's tasks are round, like the answer
/// sheet's bubbles; full mocks are small papers.
enum _Pip { done, next, todo, paperDone, paperNext, paper }

/// A row of bubbles that wraps to the width, inked in once (their own short draw, the road's
/// part of the page's one load moment), and still under reduced motion.
class _Pips extends StatelessWidget {
  const _Pips({required this.pips});

  final List<_Pip> pips;

  static const double size = 12;
  static const double gap = 5;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: LayoutBuilder(
        builder: (context, box) {
          // One row when the bubbles fit, a little smaller if that is what it takes; otherwise
          // balanced rows (11 and 10, never 20 and a lone 1).
          var s = size, g = gap;
          int fit(double s, double g) => math.max(1, ((box.maxWidth + g) / (s + g)).floor());
          if (fit(s, g) < pips.length && fit(10, 4) >= pips.length) {
            s = 10;
            g = 4;
          }
          final most = fit(s, g);
          final rows = (pips.length / most).ceil();
          final perRow = (pips.length / rows).ceil();
          final height = rows * s + math.max(0, rows - 1) * g;
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: Motion.of(context, const Duration(milliseconds: 520)),
            curve: Motion.out,
            builder: (context, t, _) => CustomPaint(
              size: Size(box.maxWidth, height),
              painter: _PipsPainter(pips: pips, perRow: perRow, t: t, colors: colors, size: s, gap: g),
            ),
          );
        },
      ),
    );
  }
}

class _PipsPainter extends CustomPainter {
  _PipsPainter({required this.pips, required this.perRow, required this.t, required this.colors, required this.size, required this.gap});

  final List<_Pip> pips;
  final int perRow;
  final double t;
  final MmColors colors;
  final double size;
  final double gap;

  @override
  void paint(Canvas canvas, Size box) {
    final s = size;
    final g = gap;
    final done = pips.where((p) => p == _Pip.done || p == _Pip.paperDone).length;
    var inked = 0;
    for (var k = 0; k < pips.length; k++) {
      final p = pips[k];
      final c = Offset((k % perRow) * (s + g) + s / 2, (k ~/ perRow) * (s + g) + s / 2);
      final filled = p == _Pip.done || p == _Pip.paperDone;
      final paper = p == _Pip.paper || p == _Pip.paperDone || p == _Pip.paperNext;
      // Done ones ink in, in order: each one pops from 0.6 to full size in its slice of the draw.
      var scale = 1.0;
      var alpha = 1.0;
      if (filled) {
        final slice = done <= 1 ? t : (t * (done + 1) - inked).clamp(0.0, 1.0);
        scale = 0.6 + 0.4 * Motion.out.transform(slice.clamp(0.0, 1.0));
        alpha = slice.clamp(0.0, 1.0);
        inked++;
      }
      final r = s / 2 * scale;
      final rect = paper
          ? RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: s * 0.78 * scale, height: s * scale), const Radius.circular(2.5))
          : null;
      if (filled) {
        final paint = Paint()..color = colors.ink.withValues(alpha: (colors.isNight ? 0.92 : 0.88) * alpha);
        if (rect != null) {
          canvas.drawRRect(rect, paint);
        } else {
          canvas.drawCircle(c, r, paint);
        }
        continue;
      }
      final next = p == _Pip.next || p == _Pip.paperNext;
      final stroke = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = next ? 1.75 : 1.25
        ..color = next ? colors.ink2 : colors.ink4;
      if (rect != null) {
        canvas.drawRRect(rect.deflate(stroke.strokeWidth / 2), stroke);
      } else {
        canvas.drawCircle(c, r - stroke.strokeWidth / 2, stroke);
      }
    }
  }

  @override
  bool shouldRepaint(_PipsPainter old) =>
      old.t != t || old.perRow != perRow || old.size != size || old.gap != gap || old.colors != colors || !_same(old.pips, pips);

  static bool _same(List<_Pip> a, List<_Pip> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

/// The open layer's items: each done or not, the open ones a tap away.
class _Detail extends StatelessWidget {
  const _Detail({required this.items, this.onOpen});

  final List<DueItem> items;
  final void Function(TodayTarget target)? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final item in items)
          MmPressable(
            onTap: item.target == null || onOpen == null ? null : () => onOpen!(item.target!),
            semanticsLabel: '${item.label}${item.done && !item.info ? ', done' : ''}',
            focusRadius: MmRadius.smallAll,
            pressedScale: 0.99,
            builder: (context, pressed, _) => Container(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
              decoration: BoxDecoration(
                color: pressed ? colors.raised2.withValues(alpha: 0.6) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  if (item.info)
                    SizedBox(width: 20, child: Center(child: Container(width: 5, height: 5, decoration: BoxDecoration(color: colors.ink3, shape: BoxShape.circle))))
                  else
                    _Tick(done: item.done),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Text(
                      item.label,
                      style: type.body.copyWith(fontSize: 14.5, height: 20 / 14.5, color: item.done ? colors.ink2 : colors.ink),
                    ),
                  ),
                  if (item.target != null && onOpen != null) Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// A done item is a filled bubble with a tick, in ink; an open one is a hollow bubble.
class _Tick extends StatelessWidget {
  const _Tick({required this.done});

  final bool done;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (done) {
      return Container(
        width: 20,
        height: 20,
        decoration: BoxDecoration(color: colors.ink.withValues(alpha: 0.9), shape: BoxShape.circle),
        child: Icon(LucideIcons.check, size: 12, color: colors.ground),
      );
    }
    return Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink3, width: 1.5)));
  }
}

/// "Next, in 15 weeks: registration expected to open, Mon 1 Feb." with the time in ink 600.
class _Milestone extends StatelessWidget {
  const _Milestone({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final colon = text.indexOf(':');
    final style = type.caption.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2);
    if (colon < 0) return Text(text, style: style);
    final head = text.substring(0, colon + 1);
    final comma = head.indexOf(', ');
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: comma < 0 ? '' : head.substring(0, comma + 2)),
        TextSpan(text: comma < 0 ? head : head.substring(comma + 2), style: TextStyle(color: colors.ink, fontWeight: FontWeight.w600)),
        TextSpan(text: text.substring(colon + 1)),
      ]),
      style: style,
    );
  }
}

class _PlanKey extends StatelessWidget {
  const _PlanKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: const ValueKey('road-change-plan'),
      onTap: onTap,
      semanticsLabel: GlanceCopy.changePlan,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        height: MmTarget.min,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.5 : 0.6),
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.slidersHorizontal, size: 16, color: colors.ink),
            const SizedBox(width: MmSpace.s8),
            Text(GlanceCopy.changePlan, style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink)),
          ],
        ),
      ),
    );
  }
}
