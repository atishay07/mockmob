import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_quote.dart';
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'delayed_skeleton.dart';

/// "What you get" on the confirm sheet: the size of the session, how long it takes and what it
/// costs, all from the quote. The only place in the app that states a cost. Every state of the
/// quote is designed here: checking, offline, failed, blocked, credits low and the Pro gate.
class GetPanel extends StatelessWidget {
  const GetPanel({
    super.key,
    required this.selection,
    required this.quote,
    required this.pending,
    required this.offline,
    required this.onRetry,
    required this.onUseDailyCount,
    required this.onOpenConcepts,
    required this.onOpenReview,
    this.conceptsOpen = false,
  });

  final PracticeSelection selection;

  /// Null while a changed selection waits to be quoted.
  final AsyncValue<PracticeQuote>? quote;
  final bool pending;
  final bool offline;
  final VoidCallback onRetry;
  final VoidCallback onUseDailyCount;
  final VoidCallback onOpenConcepts;
  final VoidCallback onOpenReview;

  /// Concepts are listed as free only while study content is switched on.
  final bool conceptsOpen;

  @override
  Widget build(BuildContext context) {
    if (offline) return const InlineBanner(message: PracticeCopy.offlineStart, tone: BannerTone.offline);
    final value = quote;
    // A failed quote may be retrying in the background; say it failed rather than spin.
    if (!pending && value != null && value.hasError && !value.hasValue) {
      final error = value.error;
      if (error is ApiError && error.isOffline) {
        return const InlineBanner(message: PracticeCopy.offlineStart, tone: BannerTone.offline);
      }
      return InlineBanner(message: PracticeCopy.quoteFailed, tone: BannerTone.error, actionLabel: PracticeCopy.retry, onAction: onRetry);
    }
    if (pending || value == null || !value.hasValue) {
      return const DelayedSkeleton(
        height: 96,
        child: SkeletonGroup(
          label: PracticeCopy.checkingCost,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Skeleton(height: 96, radius: MmRadius.key),
            ],
          ),
        ),
      );
    }

    final q = value.requireValue;
    final line = costLineFor(q);
    if (line.kind == CostKind.proGated) return _ProGate(mode: selection.mode);

    final low = creditsLowFor(q);
    if (low != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Ticket(selection: selection, quote: q, costText: null, muted: true),
          const SizedBox(height: MmSpace.s16),
          Text(low.message(selection.mode), style: context.mmType.body),
          const SizedBox(height: MmSpace.s16),
          _FreeRightNow(
            subjectId: selection.subjectId,
            showDaily: !selection.mode.isMock && selection.count != 10,
            conceptsOpen: conceptsOpen,
            onUseDailyCount: onUseDailyCount,
            onOpenConcepts: onOpenConcepts,
            onOpenReview: onOpenReview,
          ),
        ],
      );
    }
    if (line.kind == CostKind.blocked) return InlineBanner(message: line.text!);
    return _Ticket(selection: selection, quote: q, costText: line.kind == CostKind.none ? null : line.text);
  }
}

/// The ticket: the blank sheet you are about to fill, the size and time, and the cost line.
class _Ticket extends StatelessWidget {
  const _Ticket({required this.selection, required this.quote, required this.costText, this.muted = false});

  final PracticeSelection selection;
  final PracticeQuote quote;
  final String? costText;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final count = quote.count ?? selection.effectiveCount;
    final time = quote.durationSec == null ? null : Duration(seconds: quote.durationSec!);
    final get = selection.mode.isMock
        ? PracticeCopy.mockGetLine(count, time == null ? null : (time.inSeconds / 60).round())
        : PracticeCopy.getLine(count, time);
    return Semantics(
      container: true,
      label: '${PracticeCopy.whatYouGet}. $get${costText == null ? '' : ' $costText'}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.ink.withValues(alpha: colors.isNight ? 0.045 : 0.035),
          shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.ink.withValues(alpha: 0.09))),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(PracticeCopy.whatYouGet, style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
              Text(get, style: type.cardTitle.copyWith(color: muted ? colors.ink2 : colors.ink)),
              if (costText != null) ...[
                const SizedBox(height: MmSpace.s4),
                Text(costText!, style: type.body.copyWith(color: colors.ink2)),
              ],
              const SizedBox(height: MmSpace.s12),
              SheetPreview(count: count),
            ],
          ),
        ),
      ),
    );
  }
}

/// The blank answer sheet of [count] questions, ten bubbles to a row.
class SheetPreview extends StatelessWidget {
  const SheetPreview({super.key, required this.count, this.bubble = 11});

  final int count;
  final double bubble;

  @override
  Widget build(BuildContext context) {
    final rows = (count / 10).ceil();
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var r = 0; r < rows; r++)
            Padding(
              padding: EdgeInsets.only(top: r == 0 ? 0 : 5),
              child: BubbleRow(
                states: List.filled((count - r * 10).clamp(0, 10), BubbleState.hollow),
                bubbleSize: bubble,
                gap: 5,
              ),
            ),
        ],
      ),
    );
  }
}

class _ProGate extends StatelessWidget {
  const _ProGate({required this.mode});

  final PracticeMode mode;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = switch (mode) {
      PracticeMode.nta => PracticeCopy.ntaTitle,
      PracticeMode.full => PracticeCopy.fullMockTitle,
      PracticeMode.quick => PracticeCopy.quickTitle,
      PracticeMode.chapter => PracticeCopy.chapterTitle,
    };
    return Semantics(
      container: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.ink.withValues(alpha: colors.isNight ? 0.045 : 0.035),
          shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.ink.withValues(alpha: 0.09))),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ExcludeSemantics(child: Mobi(pose: MobiPose.point, size: 56)),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(header: true, child: Text(PracticeCopy.proGateTitle(name), style: type.cardTitle)),
                    const SizedBox(height: MmSpace.s4),
                    Text(PracticeCopy.proGateBody, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Free right now": only paths that are really free. The 10-question daily practice is listed
/// only when its own quote says the allowance is available; Concepts only while study content
/// is on; your answers and keys always.
class _FreeRightNow extends ConsumerWidget {
  const _FreeRightNow({
    required this.subjectId,
    required this.showDaily,
    required this.conceptsOpen,
    required this.onUseDailyCount,
    required this.onOpenConcepts,
    required this.onOpenReview,
  });

  final String subjectId;
  final bool showDaily;
  final bool conceptsOpen;
  final VoidCallback onUseDailyCount;
  final VoidCallback onOpenConcepts;
  final VoidCallback onOpenReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final daily = showDaily ? ref.watch(practiceQuoteProvider(QuoteQuery(subject: subjectId, apiMode: 'quick', count: 10))).value : null;
    final dailyOpen = daily != null && daily.launchable && daily.allowance?.kind == 'daily_practice' && daily.allowance!.isAvailable;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, child: Text(PracticeCopy.freeRightNow, style: context.mmType.label.copyWith(color: context.mmColors.ink2))),
        const SizedBox(height: MmSpace.s4),
        if (dailyOpen) _FreeRow(label: PracticeCopy.freeDaily, onTap: onUseDailyCount),
        if (conceptsOpen) _FreeRow(label: PracticeCopy.freeLearn, onTap: onOpenConcepts),
        _FreeRow(label: PracticeCopy.freeReview, onTap: onOpenReview),
      ],
    );
  }
}

class _FreeRow extends StatelessWidget {
  const _FreeRow({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.98,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 52),
        child: Row(
          children: [
            const Bubble(state: BubbleState.hollow, size: 14, animate: false),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(label, style: context.mmType.labelLarge.copyWith(color: pressed ? colors.ink2 : colors.ink))),
            Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}
