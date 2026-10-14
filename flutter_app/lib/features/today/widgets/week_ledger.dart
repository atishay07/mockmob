// The week on Today as a ledger on the ground (ui-blitz/today.md 2.1; owner 13 Oct: every dot
// must earn its place). The count ("1 of 4 study days") and what the rest of the week asks,
// then seven days on a rail: the stretch from Monday to today is inked, so the week visibly
// fills as it goes, and each bubble is a state (counted, planned, rest, passed without study).
// Today is marked by a lit volt edge along the top of its column (no tile, no box). The count
// is a condensed figure, so the week has an anchor. A one-line key names the marks on screen.
// The whole ledger is one control: it sinks on press and opens the week sheet.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/logic/plan_week.dart';
import '../../rhythm/widgets/plan_week_strip.dart' show PlanWeekKey;
import '../logic/today_model.dart';
import 'today_entrance.dart';
import 'today_tones.dart';
import 'today_type.dart';

class WeekLedger extends ConsumerWidget {
  const WeekLedger({super.key, required this.week, this.onTap});

  final WeekModel week;
  final VoidCallback? onTap;

  /// Height of the rail row at 1x text: the weekday letters, the bubbles and today's lit edge.
  static const double railHeight = 62;

  String describe() => [
        week.count,
        ?week.outlook,
        week.days.map((d) => d.describe()).join('; '),
        if (onTap != null) 'Opens your week',
      ].join('. ');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final tap = onTap;
    return MmPressable(
      semanticsLabel: describe(),
      onTap: tap == null
          ? null
          : () {
              ref.read(hapticsProvider).selection();
              tap();
            },
      pressedScale: 0.985,
      focusRadius: MmRadius.panelAll,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // The count never breaks mid-phrase: when the outlook does not fit beside it
                  // (large text), the outlook drops to its own line.
                  Expanded(
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: MmSpace.s8,
                      runSpacing: 2,
                      children: [
                        _Count(count: week.count),
                        if (week.outlook != null)
                          Text(
                            week.outlook!,
                            style: type.caption.copyWith(color: week.met ? colors.accentText : colors.ink2, fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                  ),
                  if (tap != null) ...[
                    const SizedBox(width: MmSpace.s4),
                    Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
                  ],
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s8),
            ExcludeSemantics(child: _Rail(days: week.days, paused: week.paused)),
            const SizedBox(height: MmSpace.s8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
              child: PlanWeekKey(days: week.days),
            ),
          ],
        ),
      ),
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail({required this.days, required this.paused});

  final List<PlanDay> days;
  final bool paused;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final letter = type.micro.copyWith(fontWeight: FontWeight.w500, color: colors.ink2, letterSpacing: 0.4);
    // The rail's ink draws from Monday to today, then the counted days ink in, left to right.
    final draw = todayEnterValue(context, delay: const Duration(milliseconds: 120));
    final fill = todayEnterValue(context, delay: const Duration(milliseconds: 220), length: const Duration(milliseconds: 520));
    return RepaintBoundary(
      child: SizedBox(
        height: WeekLedger.railHeight + (scaler.scale(16) - 16),
        width: double.infinity,
        child: CustomPaint(
          painter: _RailPainter(
            days: days,
            colors: colors,
            paused: paused,
            draw: draw,
            fill: fill,
            letter: letter,
            today: letter.copyWith(fontWeight: FontWeight.w700, color: colors.ink),
            rest: letter.copyWith(color: colors.ink3),
            scaler: scaler,
          ),
        ),
      ),
    );
  }
}

class _RailPainter extends CustomPainter {
  _RailPainter({
    required this.days,
    required this.colors,
    required this.paused,
    required this.draw,
    required this.fill,
    required this.letter,
    required this.today,
    required this.rest,
    required this.scaler,
  }) : super(repaint: Listenable.merge([draw, fill]));

  final List<PlanDay> days;
  final MmColors colors;
  final bool paused;
  final Animation<double> draw;
  final Animation<double> fill;
  final TextStyle letter;
  final TextStyle today;
  final TextStyle rest;
  final TextScaler scaler;

  static const double _bubble = 11;

  @override
  void paint(Canvas canvas, Size size) {
    final n = days.length;
    if (n == 0) return;
    final col = size.width / n;
    final cy = size.height - _bubble - 10;
    double cx(int i) => col * (i + 0.5);
    final todayIndex = days.indexWhere((d) => d.isToday);

    // Today: the screen's lit edge in small. A 1.5 dp volt line along the top of its column,
    // and the light it throws a little way down, behind the letter and the bubble.
    if (todayIndex >= 0) {
      final half = (col - 14).clamp(24.0, 40.0) / 2;
      final x0 = cx(todayIndex) - half, x1 = cx(todayIndex) + half;
      final lit = colors.litMark;
      final wash = Rect.fromLTRB(x0, 0, x1, 34);
      canvas.drawRect(
        wash,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [lit.withValues(alpha: colors.isNight ? 0.2 : 0.16), lit.withValues(alpha: 0)],
          ).createShader(wash),
      );
      canvas.drawRRect(
        RRect.fromLTRBR(x0, 0, x1, 1.5, const Radius.circular(0.75)),
        Paint()..color = lit,
      );
    }

    // The rail: a groove between the bubbles, Monday to Sunday, inked from Monday up to today.
    const gap = _bubble + 4;
    final groove = Paint()
      ..color = colors.line
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final inked = Paint()
      ..color = colors.ink.withValues(alpha: colors.isNight ? 0.6 : 0.55)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final inkTo = todayIndex <= 0 || paused ? -1.0 : cx(0) + (cx(todayIndex) - cx(0)) * draw.value;
    for (var i = 0; i < n - 1; i++) {
      final a = cx(i) + gap, b = cx(i + 1) - gap;
      if (b <= a) continue;
      canvas.drawLine(Offset(a, cy), Offset(b, cy), groove);
      if (inkTo > a) canvas.drawLine(Offset(a, cy), Offset(inkTo.clamp(a, b), cy), inked);
    }

    final bubbles = BubblePaint(colors);
    for (var i = 0; i < n; i++) {
      final d = days[i];
      final c = Offset(cx(i), cy);
      final state = switch (d.mark) {
        PlanDayMark.done => BubbleState.filled,
        PlanDayMark.rest => BubbleState.rest,
        PlanDayMark.planned || PlanDayMark.open => BubbleState.hollow,
      };
      // Counted days ink in one after another; a planned day ahead is a full ring, a day that
      // passed without study a dim one.
      final stagger = n <= 1 ? 0.0 : i / (n - 1) * 0.5;
      final f = d.mark == PlanDayMark.done ? ((fill.value - stagger) / 0.5).clamp(0.0, 1.0) : 1.0;
      final dim = d.mark == PlanDayMark.open && !d.isToday ? 0.5 : (paused ? 0.6 : 1.0);
      if (d.mark == PlanDayMark.done && f < 1) bubbles.paint(canvas, c, _bubble, BubbleState.hollow, dim: dim);
      bubbles.paint(canvas, c, _bubble, state, fill: f, dim: dim);
      final tp = TextPainter(
        text: TextSpan(text: d.initial, style: d.isToday ? today : (d.mark == PlanDayMark.rest ? rest : letter)),
        textDirection: TextDirection.ltr,
        textScaler: scaler,
      )..layout();
      tp.paint(canvas, Offset(c.dx - tp.width / 2, 8));
      tp.dispose();
    }
  }

  @override
  bool shouldRepaint(_RailPainter old) =>
      old.days != days ||
      old.colors != colors ||
      old.paused != paused ||
      old.draw != draw ||
      old.fill != fill ||
      old.letter != letter ||
      old.scaler != scaler;
}

/// "1 of 4 study days" with the figure in the condensed cut and the rest in the body, so the
/// week has one number to read first. A count that does not start with a figure stays a line.
class _Count extends StatelessWidget {
  const _Count({required this.count});

  final String count;

  static final RegExp _shape = RegExp(r'^(\d+)\s+(.+)$');

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = _shape.firstMatch(count);
    if (m == null) return Text(count, style: type.cardTitle.copyWith(color: colors.ink));
    // One run of text: the figure and its words share a baseline and never split apart.
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: m.group(1), style: type.countFigure.copyWith(color: colors.ink)),
          TextSpan(text: ' ${m.group(2)}', style: type.labelLarge.copyWith(color: colors.ink)),
        ],
      ),
    );
  }
}
