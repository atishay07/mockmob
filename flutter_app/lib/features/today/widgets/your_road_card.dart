// "Your road to CUET" (V15-SPEC 2.2): the one card that replaces the road strip and the mock slider.
// Line one is the number the student cares about, weeks to CUET, big and tabular, with the window
// it counts to and a quiet Change. Line two is this week only, never a calendar: the study days as
// small dots and the full mocks as small dots, today's dot ringed. Line three is the next
// milestone in words. The one action is "Adjust plan", a text link, which opens the sheet where
// every choice lives. Mobi stands here only when the week's goal has just been met, once.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/week_cheers.dart';
import '../logic/road_card.dart';
import '../logic/today_model.dart';

/// Weeks whose goal-met cheer already played in this run: Mobi cheers once per week. The account's
/// record of it is kept on the phone ([weekCheersProvider]), so a restart never replays it.
final Set<String> _cheered = {};
final Set<String?> _cheeredNow = {};

class YourRoadCard extends ConsumerWidget {
  const YourRoadCard({
    super.key,
    required this.view,
    this.lastWeek,
    this.onAdjust,
    this.onChangeDate,
    this.onWeeklyEnding,
    this.onRetry,
    this.allowMobi = true,
  });

  final TodayView view;

  /// The week that just closed, (done, goal), on Sunday night and Monday.
  final (int, int)? lastWeek;

  /// Opens the Adjust plan sheet.
  final VoidCallback? onAdjust;

  /// Opens the Adjust plan sheet at the exam date.
  final VoidCallback? onChangeDate;

  /// Opens the week that just closed.
  final VoidCallback? onWeeklyEnding;

  /// Reads again (the week or the papers did not load).
  final VoidCallback? onRetry;

  /// Another Mobi is in view (the move card's): the goal-met cheer waits.
  final bool allowMobi;

  /// The dots' slot: a 14 dp dot with room for today's ring.
  static const double slot = 22;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final model = view.card;
    if (model == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final open = model.phase == RoadPhase.window;
    final unit = open
        ? TodayCopy.windowDaysLeftLine(model.count)
        : (model.countsDays ? TodayCopy.daysToCuet(model.count) : TodayCopy.weeksToCuet(model.count));
    final week = view.header.week;
    final cheer = !open && _cheerNow(ref, week);
    return MmSurface.plain(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(child: Semantics(header: true, child: Text(TodayCopy.roadCardTitle, style: type.title.copyWith(fontSize: 19)))),
              if (!open && onAdjust != null) _Link(key: const ValueKey('road-adjust'), label: TodayCopy.adjustPlan, onTap: onAdjust!),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          Semantics(
            container: true,
            label: TodayCopy.roadCardSemantics(model.count, model.countsDays, model.windowLine),
            excludeSemantics: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                MmCountUp(
                  value: model.count,
                  fromZeroOnFirstBuild: false,
                  style: type.figureCompact.copyWith(fontSize: 40, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
                const SizedBox(width: MmSpace.s8),
                Flexible(child: Text(unit, style: type.title.copyWith(fontSize: 19, color: colors.ink))),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              Expanded(child: Text(model.windowLine, style: type.caption.copyWith(fontSize: 14, color: colors.ink2))),
              if (!open && onChangeDate != null) _Link(key: const ValueKey('road-change-date'), label: TodayCopy.changeDate, onTap: onChangeDate!),
            ],
          ),
          if (!open) ...[
            const SizedBox(height: MmSpace.s12),
            Divider(height: 1, thickness: 1, color: colors.line),
            const SizedBox(height: MmSpace.s12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: _Week(view: view, model: model, onRetry: onRetry)),
                if (cheer || (week != null && week.met && _cheeredNow.contains(week.weekId))) ...[
                  const SizedBox(width: MmSpace.s8),
                  const SizedBox.square(dimension: 52, child: MobiCharacter(size: 52, entrance: MobiAct.cheer, shadow: false)),
                ],
              ],
            ),
            if (model.milestone != null) ...[
              const SizedBox(height: MmSpace.s12),
              Text(model.milestone!, style: type.labelLarge.copyWith(fontSize: 15, color: colors.ink, fontWeight: FontWeight.w600)),
            ] else if (view.mocksLoading) ...[
              const SizedBox(height: MmSpace.s12),
              const _Skel(width: 230),
            ],
            if (lastWeek != null) ...[
              const SizedBox(height: MmSpace.s4),
              Row(
                children: [
                  Expanded(child: Text(TodayCopy.lastWeek(lastWeek!.$1, lastWeek!.$2), style: type.caption.copyWith(fontSize: 14, color: colors.ink2))),
                  if (onWeeklyEnding != null) _Link(key: const ValueKey('road-last-week'), label: TodayCopy.seeYourWeek, onTap: onWeeklyEnding!),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }

  /// Mobi's one cheer for a goal met this week; it is recorded so it never plays twice.
  bool _cheerNow(WidgetRef ref, WeekModel? w) {
    if (w == null || !w.met || !allowMobi || w.weekId == null) return false;
    final seen = ref.watch(weekCheersProvider);
    final cheer = seen != null && !seen.contains(w.weekId) && !_cheered.contains(w.weekId);
    if (cheer) {
      _cheered.add(w.weekId!);
      final id = w.weekId!;
      final cheers = ref.read(weekCheersProvider.notifier);
      scheduleMicrotask(() => unawaited(cheers.mark(id)));
      _cheeredNow.add(id);
    }
    return cheer;
  }
}

/// This week's two lines: study days and full mocks, each with its dots.
class _Week extends StatelessWidget {
  const _Week({required this.view, required this.model, this.onRetry});

  final TodayView view;
  final RoadCardModel model;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.caption.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]);
    final head = style.copyWith(color: colors.ink, fontWeight: FontWeight.w600);

    Widget days;
    if (view.header.weekLoading) {
      days = const _Skel(width: 190);
    } else if (view.header.weekFailed) {
      days = Row(
        children: [
          Expanded(child: Text(TodayCopy.weekNotRead, style: style.copyWith(color: colors.ink))),
          if (onRetry != null) _Link(label: TodayCopy.tryAgain, onTap: onRetry!),
        ],
      );
    } else if (model.paused) {
      days = _Line(text: TodayCopy.weekPaused, style: style);
    } else if (model.goal == null) {
      days = _Line(text: TodayCopy.studyDaysNoGoal(model.daysDone), style: style);
    } else {
      days = _Line(
        key: const ValueKey('road-days'),
        lead: head,
        leadText: '${TodayCopy.thisWeekLabel}: ',
        text: TodayCopy.studyDaysCount(model.daysDone, model.goal!),
        style: style,
        dots: _Dots(total: model.dayDots, filled: model.daysDone.clamp(0, model.dayDots), ringAt: model.ringAt, square: false),
        semantics: '${TodayCopy.thisWeekLabel}: ${TodayCopy.studyDaysCount(model.daysDone, model.goal!)}',
      );
    }

    Widget mocks;
    if (view.mocksLoading) {
      mocks = const _Skel(width: 130);
    } else if (view.mocksFailed) {
      mocks = _Line(text: TodayCopy.mocksNotRead, style: style);
    } else if (model.mocksPlanned == null) {
      mocks = const SizedBox.shrink();
    } else if (model.mocksPlanned == 0) {
      mocks = _Line(text: model.mocksDone > 0 ? TodayCopy.mocksTakenThisWeek(model.mocksDone) : TodayCopy.noMockThisWeek, style: style);
    } else {
      final planned = model.mocksPlanned!;
      mocks = _Line(
        key: const ValueKey('road-mocks'),
        text: TodayCopy.mocksCount(model.mocksDone, planned),
        style: style,
        dots: _Dots(total: planned, filled: model.mocksDone.clamp(0, planned), ringAt: null, square: true),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [days, const SizedBox(height: MmSpace.s8), mocks],
    );
  }
}

class _Skel extends StatelessWidget {
  const _Skel({required this.width});

  final double width;

  @override
  Widget build(BuildContext context) => SizedBox(height: 24, child: SkeletonGroup(child: Align(alignment: Alignment.centerLeft, child: Skeleton.line(width: width))));
}

/// One counted line: the words on the left, the dots at the end.
class _Line extends StatelessWidget {
  const _Line({super.key, required this.text, required this.style, this.dots, this.lead, this.leadText, this.semantics});

  final String text;
  final String? leadText;
  final TextStyle style;
  final TextStyle? lead;
  final Widget? dots;
  final String? semantics;

  @override
  Widget build(BuildContext context) {
    final words = Text.rich(
      TextSpan(children: [
        if (leadText != null) TextSpan(text: leadText, style: lead),
        TextSpan(text: text),
      ]),
      style: style,
    );
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Only the words speak: the dots say the same thing a second time, so they stay silent
          // (and out of the words' own semantics box).
          Expanded(
            child: Semantics(container: true, label: semantics ?? text, excludeSemantics: true, child: words),
          ),
          if (dots != null) ...[const SizedBox(width: MmSpace.s8), ExcludeSemantics(child: dots!)],
        ],
      ),
    );
  }
}

/// Small dots, filled for what is done; the ring marks today's. Study days are round, full mocks
/// are rounded squares, so the two lines never read as one.
class _Dots extends StatelessWidget {
  const _Dots({required this.total, required this.filled, required this.ringAt, required this.square});

  final int total;
  final int filled;
  final int? ringAt;
  final bool square;

  static const double size = 14;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < total; i++)
          SizedBox.square(
            dimension: YourRoadCard.slot,
            child: Center(
              child: Container(
                padding: const EdgeInsets.all(2.5),
                decoration: ringAt == i ? BoxDecoration(shape: square ? BoxShape.rectangle : BoxShape.circle, borderRadius: square ? BorderRadius.circular(8) : null, border: Border.all(color: colors.ink, width: 1.5)) : null,
                child: Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(
                    shape: square ? BoxShape.rectangle : BoxShape.circle,
                    borderRadius: square ? BorderRadius.circular(4) : null,
                    color: i < filled ? colors.ink : Colors.transparent,
                    border: i < filled ? null : Border.all(color: colors.lineStrong, width: 1.5),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// A text link: 600 weight ink with a hairline underline, 32 dp to see, 48 dp to touch.
class _Link extends StatelessWidget {
  const _Link({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 32,
      child: MmPressable(
        onTap: onTap,
        semanticsLabel: label,
        focusRadius: MmRadius.smallAll,
        pressedScale: 0.98,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => SizedBox(
          height: 32,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
            child: Center(
              widthFactor: 1,
              child: Text(
                label,
                maxLines: 1,
                style: type.labelLarge.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: pressed ? colors.ink2 : colors.ink,
                  decoration: TextDecoration.underline,
                  decorationColor: colors.ink3,
                  decorationThickness: 1,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
