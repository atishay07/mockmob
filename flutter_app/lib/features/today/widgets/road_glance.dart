// Road to CUET (TODAY-1018 section 3 row 4, and the owner's 3:30 am words: "respecting information
// like what's due today, what's due for the week, and showing the overall goal"). Three layers
// read at a glance, drawn as three nested rings beside their numbers: due today (inner, volt:
// the counted things), due this week (middle, ink), the overall goal (outer: full mocks done
// over the target). Each layer is a button that opens its detail in place; Change plan opens the
// guided sentence. One outlined surface (the whole of it is pressable parts), no card in a card,
// no glow, no neon. Calendar arithmetic and the student's own plan only: no predictions.
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
import 'today_type.dart';
import 'plan_flow_sheet.dart';
import 'road_section.dart' show RoadActions;

class RoadGlance extends StatefulWidget {
  const RoadGlance({super.key, required this.layers, required this.road, this.actions, this.onOpen, this.initialOpen});

  final RoadLayers layers;
  final RoadModel road;

  /// Where Change plan saves; without it the button still opens the plan, read-only.
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
    final ringColors = RoadRings.colorsFor(colors);

    final windowOpen = widget.road.phase == RoadPhase.window;
    final headline = windowOpen
        ? Text(TodayCopy.windowOpen, style: type.figureCompact.copyWith(fontSize: 34, height: 1.1, color: colors.ink))
        : Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        MmCountUp(
          value: figure,
          fromZeroOnFirstBuild: false,
          style: type.figureCompact.copyWith(fontSize: 52, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        const SizedBox(width: MmSpace.s8),
        Flexible(
          child: Text(
            countWeeks ? GlanceCopy.weeksTo(own: l.ownDate) : GlanceCopy.daysTo(own: l.ownDate),
            style: type.title.copyWith(fontSize: 19, color: colors.ink),
          ),
        ),
      ],
    );

    final rows = [
      _Layer(
        index: 0,
        color: ringColors[0],
        label: GlanceCopy.layerToday,
        figure: l.todayTotal == 0 ? GlanceCopy.allDoneToday : GlanceCopy.doneOf(l.todayDone, l.todayTotal),
        line: _todayLine(l),
        open: _open == 0,
        onTap: () => _toggle(0),
      ),
      _Layer(
        index: 1,
        color: ringColors[1],
        label: GlanceCopy.layerWeek,
        figure: l.weekGoal == null ? GlanceCopy.studyDaysNoGoal(l.weekDays) : GlanceCopy.studyDaysOf(l.weekDays, l.weekGoal!),
        line: l.planned == 0 ? GlanceCopy.setDaysHint : GlanceCopy.plannedDone(l.plannedDone, l.planned),
        open: _open == 1,
        onTap: () => _toggle(1),
      ),
      _Layer(
        index: 2,
        color: ringColors[2],
        label: GlanceCopy.layerGoal,
        figure: l.mocksKnown ? GlanceCopy.mocksOf(l.mocksTaken, l.mockTarget) : GlanceCopy.mocksUnknown,
        line: !l.mocksKnown ? l.milestone ?? '' : (l.targetSuggested ? '${l.pace}, ${GlanceCopy.suggestedTag}' : l.pace),
        open: _open == 2,
        onTap: () => _toggle(2),
      ),
    ];

    final rings = RoadRings(
      fractions: [l.todayFraction, l.weekFraction, l.goalFraction],
      highlight: _open,
      size: 108,
    );

    final layers = LayoutBuilder(
      builder: (context, box) {
        final scale = MediaQuery.textScalerOf(context).scale(1);
        final stacked = box.maxWidth - 108 - MmSpace.s16 < 170 * scale.clamp(1.0, 1.4);
        final column = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
        if (stacked) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Center(child: rings), const SizedBox(height: MmSpace.s12), column],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [rings, const SizedBox(width: MmSpace.s16), Expanded(child: column)],
        );
      },
    );

    final open = _open;
    final detail = MmSizeEase(
      duration: Motion.ui,
      curve: Motion.out,
      alignment: Alignment.topCenter,
      clipBehavior: Clip.hardEdge,
      child: open == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              key: ValueKey('road-detail-$open'),
              padding: const EdgeInsets.only(top: MmSpace.s12),
              child: _Detail(
                items: switch (open) {
                  0 => l.today,
                  1 => l.weekItems,
                  _ => l.goalItems,
                },
                marks: open == 2 && l.mocksKnown ? (l.mocksTaken, l.mockTarget) : null,
                onOpen: widget.onOpen,
              ),
            ),
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
            padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                headline,
                const SizedBox(height: MmSpace.s4),
                Text(l.ownDate ? GlanceCopy.yourDate(l.examDate) : GlanceCopy.expectedFrom(l.examDate), style: type.caption.copyWith(fontSize: 14, color: colors.ink2)),
                const SizedBox(height: MmSpace.s16),
                layers,
                detail,
                const SizedBox(height: MmSpace.s12),
                Divider(height: 1, thickness: 1, color: colors.line),
                const SizedBox(height: MmSpace.s12),
                if (milestone != null) _Milestone(text: milestone),
                if (_receipt != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(_receipt!, style: type.caption.copyWith(fontSize: 13.5, color: colors.ink2)),
                ],
                const SizedBox(height: MmSpace.s12),
                Align(
                  alignment: Alignment.centerRight,
                  child: _PlanKey(onTap: _changePlan),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static String _todayLine(RoadLayers l) {
    final left = [for (final t in l.today) if (!t.done) t];
    if (l.todayTotal == 0 || left.isEmpty) return GlanceCopy.allDoneToday;
    return GlanceCopy.leftToday(left.first.label, left.length - 1);
  }
}

/// One layer: its ring's colour as a short bar, the label, the figure and the line; a tap opens
/// the detail in place (one at a time).
class _Layer extends StatelessWidget {
  const _Layer({required this.index, required this.color, required this.label, required this.figure, required this.line, required this.open, required this.onTap});

  final int index;
  final Color color;
  final String label;
  final String figure;
  final String line;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: ValueKey('road-layer-$index'),
      onTap: onTap,
      semanticsLabel: GlanceCopy.layerSemantics(label, figure, line, open),
      selected: open,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.98,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s6, horizontal: MmSpace.s6),
        decoration: BoxDecoration(
          color: open || pressed ? colors.raised2.withValues(alpha: colors.isNight ? 0.8 : 0.9) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(width: 3, height: 30, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label, style: type.micro.copyWith(fontSize: 12, fontWeight: FontWeight.w600, color: colors.ink3, letterSpacing: 0.2)),
                  Text(figure, style: type.labelLarge.copyWith(fontSize: 15, height: 20 / 15, fontWeight: FontWeight.w700, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                  Text(line, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(fontSize: 12.5, height: 17 / 12.5, color: colors.ink2)),
                ],
              ),
            ),
            AnimatedRotation(
              turns: open ? 0.5 : 0,
              duration: Motion.of(context, const Duration(milliseconds: 200)),
              curve: Motion.out,
              child: Icon(LucideIcons.chevronDown, size: 16, color: colors.ink3),
            ),
          ],
        ),
      ),
    );
  }
}

/// The open layer's items: each done or not, the open ones a tap away.
class _Detail extends StatelessWidget {
  const _Detail({required this.items, this.marks, this.onOpen});

  final List<DueItem> items;

  /// (taken, target): the goal's full mocks as small marks.
  final (int, int)? marks;
  final void Function(TodayTarget target)? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = marks;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (m != null) ...[
          _MockMarks(taken: m.$1, target: m.$2),
          const SizedBox(height: MmSpace.s8),
        ],
        for (final item in items)
          MmPressable(
            onTap: item.target == null || onOpen == null ? null : () => onOpen!(item.target!),
            semanticsLabel: '${item.label}${item.done && !item.info ? ', done' : ''}',
            focusRadius: MmRadius.smallAll,
            pressedScale: 0.99,
            builder: (context, pressed, _) => Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s6),
              color: pressed ? colors.raised2.withValues(alpha: 0.6) : Colors.transparent,
              child: Row(
                children: [
                  if (item.info)
                    SizedBox(width: 20, child: Center(child: Container(width: 6, height: 6, decoration: BoxDecoration(color: colors.ink3, shape: BoxShape.circle))))
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
        decoration: BoxDecoration(color: colors.markFill, shape: BoxShape.circle),
        child: Icon(LucideIcons.check, size: 12, color: colors.voltInk),
      );
    }
    return Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink3, width: 1.5)));
  }
}

/// Full mocks as small marks: taken filled in ink, the rest outlined.
class _MockMarks extends StatelessWidget {
  const _MockMarks({required this.taken, required this.target});

  final int taken;
  final int target;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final n = target.clamp(1, 30);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s6),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          for (var k = 0; k < n; k++)
            Container(
              width: 12,
              height: 6,
              decoration: BoxDecoration(
                color: k < taken ? colors.ink : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
                border: k < taken ? null : Border.all(color: colors.ink4.withValues(alpha: 0.9)),
              ),
            ),
        ],
      ),
    );
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

/// Three nested rings: today inside, this week, the goal outside. Each draws in once (the page's
/// one authored moment for the road) and, while a layer is open, the others step back.
class RoadRings extends StatelessWidget {
  const RoadRings({super.key, required this.fractions, this.highlight, this.size = 108});

  final List<double> fractions;
  final int? highlight;
  final double size;

  /// Today (volt: counted things), this week (ink), the goal (a softer ink).
  static List<Color> colorsFor(MmColors c) => [c.markFill, c.ink, c.isNight ? c.ink2 : c.ink3];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final palette = colorsFor(colors);
    return Semantics(
      excludeSemantics: true,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Motion.of(context, const Duration(milliseconds: 900)),
        curve: const Cubic(0.23, 1, 0.32, 1),
        builder: (context, t, _) => SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: _RingsPainter(
              fractions: [for (final f in fractions) f * t],
              colors: palette,
              track: colors.isNight ? colors.line : colors.lineStrong.withValues(alpha: 0.5),
              highlight: highlight,
              voltInk: colors.voltInk,
            ),
          ),
        ),
      ),
    );
  }
}

class _RingsPainter extends CustomPainter {
  _RingsPainter({required this.fractions, required this.colors, required this.track, required this.voltInk, this.highlight});

  final List<double> fractions;
  final List<Color> colors;
  final Color track;
  final Color voltInk;
  final int? highlight;

  static const double stroke = 9;
  static const double gap = 4;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final outer = size.width / 2 - stroke / 2;
    // Index 0 (today) is the innermost ring.
    for (var k = 0; k < 3; k++) {
      final r = outer - (2 - k) * (stroke + gap);
      final dim = highlight != null && highlight != k;
      final rect = Rect.fromCircle(center: c, radius: r);
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..color = track,
      );
      final f = fractions[k].clamp(0.0, 1.0);
      if (f <= 0) continue;
      final color = colors[k].withValues(alpha: dim ? 0.3 : 1);
      final sweep = math.max(f * math.pi * 2, 0.06);
      canvas.drawArc(
        rect,
        -math.pi / 2,
        sweep,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_RingsPainter old) =>
      old.highlight != highlight || old.track != track || !_same(old.fractions, fractions) || !_same(old.colors, colors);

  static bool _same<T>(List<T> a, List<T> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
