import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/practice_quote.dart';
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'composer_parts.dart';
import 'delayed_skeleton.dart';
import 'plain_notice.dart';

/// The height the checking skeleton holds: about the three rows of the finished summary.
const double _skeletonHeight = 176;

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
    required this.subjectName,
    this.conceptsOpen = false,
  });

  final PracticeSelection selection;
  final String subjectName;

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
    if (offline) return const PlainNotice(message: PracticeCopy.offlineStart, tone: BannerTone.offline);
    final value = quote;
    // A failed quote may be retrying in the background; say it failed rather than spin.
    if (!pending && value != null && value.hasError && !value.hasValue) {
      final error = value.error;
      if (error is ApiError && error.isOffline) {
        return const PlainNotice(message: PracticeCopy.offlineStart, tone: BannerTone.offline);
      }
      return PlainNotice(message: PracticeCopy.quoteFailed, tone: BannerTone.error, actionLabel: PracticeCopy.retry, onAction: onRetry);
    }
    if (pending || value == null || !value.hasValue) {
      // The rows of "What you get" as lines of the same shape, so nothing jumps when they land.
      return const DelayedSkeleton(
        height: _skeletonHeight,
        child: SkeletonGroup(
          label: PracticeCopy.checkingCost,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Skeleton.line(width: 96, height: 12),
              SizedBox(height: MmSpace.s8),
              Skeleton.line(width: 220, height: 20),
              SizedBox(height: MmSpace.s20),
              Skeleton.line(height: 14),
              SizedBox(height: MmSpace.s20),
              Skeleton.line(height: 14),
              SizedBox(height: MmSpace.s20),
              Skeleton.line(width: 180, height: 14),
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
          Semantics(liveRegion: true, child: Text(low.message(selection.mode), style: context.mmType.lead)),
          const SizedBox(height: MmSpace.s20),
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
    if (line.kind == CostKind.blocked) return PlainNotice(message: line.text!);
    // Keyed by the selection the quote answers: its rows rise in once for each selection, never
    // again for a rebuild of the same one.
    return _Ticket(
      key: ValueKey(selection.quoteQuery),
      selection: selection,
      quote: q,
      costText: line.kind == CostKind.none ? null : line.text,
      subjectName: subjectName,
    );
  }
}

/// What starts, as plain rows on the sheet (no card, no border: the ticket above already is the
/// one object): the session's size and time as the line, then the rows the website shows that
/// the ticket does not (marking, cost), each figure from the selection or the quote.
/// The difficulty is not repeated: its control sits right above.
class _Ticket extends StatefulWidget {
  const _Ticket({super.key, required this.selection, required this.quote, required this.costText, required this.subjectName});

  final PracticeSelection selection;
  final PracticeQuote quote;
  final String? costText;
  final String subjectName;

  /// Each row rises 45 ms after the one above; the "Free" check inks after the last has landed.
  static const Duration step = Duration(milliseconds: 45);
  static const Duration rise = Duration(milliseconds: 320);
  static const int rows = 4;

  @override
  State<_Ticket> createState() => _TicketState();
}

class _TicketState extends State<_Ticket> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: _Ticket.rise + _Ticket.step * (_Ticket.rows - 1) + const Duration(milliseconds: 160),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// Row [i]'s own 0..1 progress.
  double _t(int i) {
    final total = _c.duration!.inMicroseconds;
    final start = (_Ticket.step * i).inMicroseconds / total;
    final span = _Ticket.rise.inMicroseconds / total;
    return Curves.easeOutCubic.transform(((_c.value - start) / span).clamp(0.0, 1.0));
  }

  Widget _rise(int i, Widget child) => AnimatedBuilder(
    animation: _c,
    child: child,
    builder: (context, child) {
      final t = _t(i);
      return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 8 * (1 - t)), child: child));
    },
  );

  @override
  Widget build(BuildContext context) {
    final selection = widget.selection;
    final quote = widget.quote;
    final costText = widget.costText;
    final subjectName = widget.subjectName;
    final colors = context.mmColors;
    final type = context.mmType;
    final count = quote.count ?? selection.effectiveCount;
    final time = quote.durationSec == null ? null : Duration(seconds: quote.durationSec!);
    final get = selection.mode.isMock
        ? PracticeCopy.mockGetLine(count, time == null ? null : (time.inSeconds / 60).round())
        : PracticeCopy.getLine(count, time);
    final chapters = selection.effectiveChapters;
    final difficulty = selection.effectiveDifficulty == null ? null : DifficultyPicker.label(selection.difficulty);
    final rows = <(String, String)>[
      // No chapters row: the chapter field above names the chosen ones, and "all chapters" is what a
      // quick practice already is.
      (PracticeCopy.summaryMarking, PracticeCopy.markingValue),
      (PracticeCopy.summaryCost, costText ?? (quote.entitlementKind == 'access' ? PracticeCopy.costIncluded : PracticeCopy.costFree)),
    ];
    return Semantics(
      container: true,
      label:
          '${PracticeCopy.whatYouGet}, $subjectName, ${modeTitle(selection.mode)}. $get ${[if (difficulty != null) '${PracticeCopy.difficultyLabel}: $difficulty', if (!selection.mode.isMock) chapters.isEmpty ? PracticeCopy.allChapters : PracticeCopy.chaptersSummary(chapters), for (final r in rows) '${r.$1}: ${r.$2}'].join('. ')}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _rise(
            0,
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(PracticeCopy.whatYouGet, style: type.label.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s4),
                Text(get, style: type.cardTitle),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < rows.length; i++)
            _rise(
              i + 1,
              _SummaryRow(
                label: rows[i].$1,
                value: rows[i].$2,
                // A free start inks a check once the rows have landed. Only "Free" carries it:
                // the words are the state, the mark is the second signal.
                mark: rows[i].$1 == PracticeCopy.summaryCost && rows[i].$2.startsWith(PracticeCopy.costFree) ? _c : null,
              ),
            ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value, this.mark});

  final String label;
  final String value;

  /// The ticket's controller: the check inks over its last 160 ms.
  final AnimationController? mark;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 96,
              child: Text(label, style: type.small.copyWith(color: colors.ink2)),
            ),
            Expanded(
              child: Text(
                value,
                style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600),
              ),
            ),
            if (mark != null) _InkedCheck(controller: mark!),
          ],
        ),
      ),
    );
  }
}

/// A small volt bubble with a check that inks in over the last 160 ms of the ticket's rise.
class _InkedCheck extends StatelessWidget {
  const _InkedCheck({required this.controller});

  final AnimationController controller;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final t = Motion.out.transform(((controller.value - 0.62) / 0.38).clamp(0.0, 1.0));
        return Transform.scale(
          scale: t,
          child: Opacity(
            opacity: t.clamp(0.0, 1.0),
            child: DecoratedBox(
              decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle),
              child: SizedBox.square(dimension: 18, child: Icon(LucideIcons.check, size: 12, color: colors.voltInk)),
            ),
          ),
        );
      },
    );
  }
}

/// The blank answer sheet of [count] questions: ten columns across the full width, a 14 dp
/// bubble centred in each cell, rows numbered by their first question.
class SheetPreview extends StatelessWidget {
  const SheetPreview({super.key, required this.count, this.bubble = 14});

  final int count;
  final double bubble;

  @override
  Widget build(BuildContext context) {
    final rows = (count / 10).ceil();
    final colors = context.mmColors;
    final number = context.mmType.caption.copyWith(fontSize: 11, height: 1, color: colors.ink3);
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var r = 0; r < rows; r++)
            Padding(
              padding: EdgeInsets.only(top: r == 0 ? 0 : 6),
              child: Row(
                children: [
                  if (rows > 1) SizedBox(width: 22, child: Text('${r * 10 + 1}', style: number)),
                  for (var c = 0; c < 10; c++)
                    Expanded(
                      child: Center(
                        child: r * 10 + c < count
                            ? Bubble(state: BubbleState.hollow, size: bubble, animate: false)
                            : SizedBox.square(dimension: bubble),
                      ),
                    ),
                ],
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
    final name = modeTitle(mode);
    return Semantics(
      container: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.keyAll,
            side: BorderSide(color: colors.line),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Calm: standing at ease, no pointing and no celebrating at a gate.
              const ExcludeSemantics(child: Mobi(pose: MobiPose.idle, size: 56)),
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
class _FreeRightNow extends ConsumerStatefulWidget {
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
  ConsumerState<_FreeRightNow> createState() => _FreeRightNowState();
}

class _FreeRightNowState extends ConsumerState<_FreeRightNow> {
  /// Mobi, 40 dp, beside the heading: he nudges toward the first free option once and holds the
  /// point. No bubble: the heading and the rows say it.
  final MobiController _mobi = MobiController();
  final GlobalKey _first = GlobalKey(debugLabel: 'free-first');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mobi.pointAtWidget(_first);
      _mobi.play(MobiAct.nudge);
    });
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final daily = widget.showDaily
        ? ref.watch(practiceQuoteProvider(QuoteQuery(subject: widget.subjectId, apiMode: 'quick', count: 10))).value
        : null;
    final dailyOpen = daily != null && daily.launchable && daily.allowance?.kind == 'daily_practice' && daily.allowance!.isAvailable;
    // The first free option is the one Mobi points at.
    final rows = <(String, VoidCallback)>[
      if (dailyOpen) (PracticeCopy.freeDaily, widget.onUseDailyCount),
      if (widget.conceptsOpen) (PracticeCopy.freeLearn, widget.onOpenConcepts),
      (PracticeCopy.freeReview, widget.onOpenReview),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(PracticeCopy.freeRightNow, style: context.mmType.label.copyWith(color: context.mmColors.ink2)),
              ),
            ),
            ExcludeSemantics(child: MobiCharacter(controller: _mobi, size: 40, entrance: MobiAct.idle, seed: 53, watchTaps: false)),
          ],
        ),
        const SizedBox(height: MmSpace.s4),
        for (var i = 0; i < rows.length; i++)
          KeyedSubtree(
            key: i == 0 ? _first : null,
            child: _FreeRow(label: rows[i].$1, onTap: rows[i].$2),
          ),
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
      haptic: MmPressHaptic.selection,
      highlight: true,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 52),
        child: Row(
          children: [
            Expanded(
              child: Text(label, style: context.mmType.labelLarge.copyWith(color: pressed ? colors.ink2 : colors.ink)),
            ),
            Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}
