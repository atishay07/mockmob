// "This week" on Today (TODAY-1017 4.3): the week as seven marks on the ground, the figure
// "3 of 4 study days" and one line that ties the week to tonight ("Tonight makes 4."). No card:
// the row sits in the glance group under the move, and the whole row opens the week. Before the
// rhythm is read the row keeps its height with skeleton marks; a failed first read says so in the
// same space (L03). On the week's close the row shows last week ("Last week: 4 of 4.").
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/logic/plan_week.dart' show PlanDay, PlanDayMark;
import '../copy.dart';
import '../logic/today_model.dart';
import 'today_type.dart';

/// Weeks whose goal-met cheer already played in this run: Mobi cheers once per week (4.6).
final Set<String> _cheered = {};

class TodayWeekRow extends StatelessWidget {
  const TodayWeekRow({
    super.key,
    this.week,
    this.loading = false,
    this.failed = false,
    this.onTap,
    this.onRetry,
    this.onSetDays,
    this.lastWeek,
    this.allowMobi = true,
  });

  final WeekModel? week;
  final bool loading;
  final bool failed;
  final VoidCallback? onTap;
  final VoidCallback? onRetry;

  /// No goal yet: the Set days token opens the study-days sheet.
  final VoidCallback? onSetDays;

  /// The week that just closed (Sunday night and Monday): (done, goal). The row says it and opens
  /// the week's ending.
  final (int, int)? lastWeek;

  /// Another Mobi is already in view (the move card's): the goal-met cheer waits.
  final bool allowMobi;

  /// The marks' side.
  static const double mark = 26;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = week;
    final figure = w == null
        ? null
        : Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisSize: MainAxisSize.min,
            children: [
              MmCountUp(
                value: w.done,
                fromZeroOnFirstBuild: false,
                style: type.figureCompact.copyWith(fontSize: 30, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              if (w.goal != null) ...[
                const SizedBox(width: MmSpace.s4),
                Text(TodayCopy.ofDenominator(w.goal!), style: type.title.copyWith(fontSize: 19, color: colors.ink2)),
              ],
              const SizedBox(width: MmSpace.s6),
              Text(TodayCopy.weekStudyDays, style: type.caption.copyWith(fontSize: 14, color: colors.ink2)),
            ],
          );
    final heading = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: Semantics(header: true, child: Text(TodayCopy.weekTitle, style: type.title.copyWith(fontSize: 19)))),
        ?figure,
      ],
    );
    final Widget body;
    if (w == null) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s12),
          _Marks(days: null, before: const {}),
          const SizedBox(height: MmSpace.s8),
          SizedBox(
            height: 40,
            child: failed
                ? Row(
                    children: [
                      Expanded(child: Text(TodayCopy.weekNotRead, style: type.caption.copyWith(fontSize: 14, color: colors.ink))),
                      if (onRetry != null) KeyButton.quiet(label: TodayCopy.tryAgain, onPressed: onRetry),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      );
    } else {
      final last = lastWeek;
      final caption = last != null ? '${TodayCopy.lastWeek(last.$1, last.$2)} ${TodayCopy.seeYourWeek}' : w.caption;
      final key = last != null ? TodayCopy.seeYourWeek : w.captionKey;
      final cheer = w.met && allowMobi && w.weekId != null && !_cheered.contains(w.weekId);
      if (cheer) _cheered.add(w.weekId!);
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s12),
          _Marks(days: w.days, before: w.beforeAccount),
          const SizedBox(height: MmSpace.s8),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (cheer || (w.met && _cheeredNow.contains(w.weekId))) ...[
                  _Cheer(weekId: w.weekId!),
                  const SizedBox(width: MmSpace.s8),
                ],
                Expanded(child: _Caption(text: caption, keyClause: key)),
                if (w.goal == null && onSetDays != null) _SetDays(onTap: onSetDays!),
              ],
            ),
          ),
        ],
      );
      if (cheer) _cheeredNow.add(w.weekId!);
    }
    final semantics = w == null
        ? TodayCopy.weekTitle
        : TodayCopy.weekSemantics(TodayCopy.weekFigureSemantics(w.done, w.goal), _markWords(w), w.caption);
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semantics,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [heading, body],
      ),
    );
  }

  static String _markWords(WeekModel w) => [
        for (final d in w.days)
          '${TodayCopy.weekdayShort[d.index]} ${w.beforeAccount.contains(d.index) ? TodayCopy.markBefore : switch (d.mark) {
              PlanDayMark.done => TodayCopy.markCounted,
              PlanDayMark.planned => TodayCopy.markPlanned,
              PlanDayMark.rest => TodayCopy.markRest,
              PlanDayMark.open => TodayCopy.markOpen,
            }}',
      ].join(', ');
}

/// Weeks whose cheer is showing on this visit (so a rebuild keeps him in place until the row goes).
final Set<String?> _cheeredNow = {};

/// The seven days: a label over each mark, today's label in ink.
class _Marks extends StatelessWidget {
  const _Marks({required this.days, required this.before});

  final List<PlanDay>? days;
  final Set<int> before;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        for (var i = 0; i < 7; i++)
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  TodayCopy.weekdayShort[i],
                  style: type.micro.copyWith(
                    fontWeight: FontWeight.w600,
                    color: days != null && days![i].isToday ? colors.ink : colors.ink3,
                  ),
                ),
                const SizedBox(height: MmSpace.s6),
                SizedBox.square(
                  dimension: TodayWeekRow.mark + 8,
                  child: Center(
                    child: days == null
                        ? const Skeleton.circle(size: TodayWeekRow.mark)
                        : _Mark(day: days![i], before: before.contains(i)),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// One day: counted (volt with an ink tick), planned (an outline), rest (dashed), before the
/// account (a short dash), open past (a faint outline); today gets an ink ring offset by 3.
class _Mark extends StatelessWidget {
  const _Mark({required this.day, required this.before});

  final PlanDay day;
  final bool before;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    const size = TodayWeekRow.mark;
    final counted = day.mark == PlanDayMark.done;
    final Widget face;
    if (before) {
      face = SizedBox.square(
        dimension: size,
        child: Center(child: Container(width: 10, height: 2, decoration: BoxDecoration(color: colors.ink3, borderRadius: BorderRadius.circular(1)))),
      );
    } else if (counted) {
      face = Container(
          width: size,
          height: size,
          // An ink check on a neutral disc: the screen's one volt belongs to its key (17 Oct).
          decoration: BoxDecoration(color: colors.raised2, shape: BoxShape.circle, border: Border.all(color: colors.lineStrong)),
          child: Icon(LucideIcons.check, size: 15, color: colors.ink),
      );
    } else {
      face = CustomPaint(
        size: const Size.square(size),
        painter: _RingPainter(
          color: day.mark == PlanDayMark.planned ? colors.lineStrong : (day.mark == PlanDayMark.rest ? colors.ink4 : colors.line),
          dashed: day.mark == PlanDayMark.rest,
        ),
      );
    }
    if (!day.isToday) return face;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink, width: 1.5)),
      child: face,
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.color, required this.dashed});

  final Color color;
  final bool dashed;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final r = size.width / 2 - 0.75;
    final c = size.center(Offset.zero);
    if (!dashed) {
      canvas.drawCircle(c, r, paint);
      return;
    }
    const dashes = 12;
    const sweep = 3.14159265 * 2 / dashes;
    for (var k = 0; k < dashes; k++) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), k * sweep, sweep * 0.55, false, paint);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color || old.dashed != dashed;
}

/// The caption with its key clause in ink at weight 600.
class _Caption extends StatelessWidget {
  const _Caption({required this.text, this.keyClause});

  final String text;
  final String? keyClause;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.caption.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2);
    final k = keyClause;
    final at = k == null ? -1 : text.indexOf(k);
    return MmOverlapSwitcher.fade(
      alignment: Alignment.centerLeft,
      child: Text.rich(
        key: ValueKey(text),
        at < 0
            ? TextSpan(text: text)
            : TextSpan(children: [
                TextSpan(text: text.substring(0, at)),
                TextSpan(text: k, style: TextStyle(color: colors.ink, fontWeight: FontWeight.w600)),
                TextSpan(text: text.substring(at + k!.length)),
              ]),
        style: style,
      ),
    );
  }
}

/// No goal yet: "Set days" as a pressable token.
class _SetDays extends StatelessWidget {
  const _SetDays({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => KeyButton.quiet(label: TodayCopy.setDays, onPressed: onTap);
}

/// Mobi's cheer beside the caption, 52 dp, once per week.
class _Cheer extends StatelessWidget {
  const _Cheer({required this.weekId});

  final String weekId;

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 52,
    child: MobiCharacter(size: 52, entrance: MobiAct.cheer, shadow: false),
  );
}
