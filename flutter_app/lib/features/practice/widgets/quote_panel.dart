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
import 'pressable.dart';

/// What the setup screen says about cost, free paths and why a start may not be possible. Every
/// word of it comes from the quote (spec 5.4); while the quote is slow the controls above stay
/// usable and this region shows the static skeleton after 400 ms.
class QuotePanel extends ConsumerWidget {
  const QuotePanel({
    super.key,
    required this.mode,
    required this.selection,
    required this.quote,
    required this.pending,
    required this.onRetry,
    required this.onUseDailyCount,
    required this.onOpenLearn,
    required this.onOpenReview,
    this.offline = false,
  });

  final PracticeMode mode;
  final PracticeSelection selection;

  /// Null while a changed selection waits to be quoted.
  final AsyncValue<PracticeQuote>? quote;
  final bool pending;
  final bool offline;
  final VoidCallback onRetry;
  final VoidCallback onUseDailyCount;
  final VoidCallback onOpenLearn;
  final VoidCallback onOpenReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;

    if (offline) return _Note(icon: LucideIcons.wifiOff, text: PracticeCopy.offlineStart);
    final value = quote;
    if (pending || value == null || value.isLoading && !value.hasValue) {
      return const DelayedSkeleton(
        height: 24,
        child: SkeletonGroup(
          label: 'Checking what this costs',
          child: Align(alignment: Alignment.topLeft, child: Skeleton.line(width: 220, height: 16)),
        ),
      );
    }
    if (value.hasError && !value.hasValue) {
      final error = value.error;
      if (error is ApiError && error.isOffline) return _Note(icon: LucideIcons.wifiOff, text: PracticeCopy.offlineStart);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Note(icon: LucideIcons.circleAlert, text: PracticeCopy.quoteFailed, tone: colors.badText),
          const SizedBox(height: MmSpace.s8),
          KeyButton.quiet(label: PracticeCopy.retry, onPressed: onRetry),
        ],
      );
    }

    final q = value.requireValue;
    final line = costLineFor(q);
    if (line.kind == CostKind.proGated) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(padding: EdgeInsets.only(top: 3), child: Icon(LucideIcons.lock, size: 18)),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(PracticeCopy.proGateTitle(_modeName(mode)), style: type.subhead)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(PracticeCopy.proGateBody, style: type.body.copyWith(color: colors.ink2)),
        ],
      );
    }

    final low = creditsLowFor(q);
    if (low != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(low.message(mode), style: type.body),
          const SizedBox(height: MmSpace.s24),
          _FreeRightNow(
            subjectId: selection.subjectId,
            showDaily: !mode.isMock && selection.count != 10,
            onUseDailyCount: onUseDailyCount,
            onOpenLearn: onOpenLearn,
            onOpenReview: onOpenReview,
          ),
        ],
      );
    }

    if (line.kind == CostKind.blocked) return _Note(icon: LucideIcons.info, text: line.text!);
    if (line.kind == CostKind.none) return const SizedBox.shrink();
    return Text(line.text!, style: type.subhead.copyWith(color: colors.ink));
  }
}

String _modeName(PracticeMode mode) => switch (mode) {
  PracticeMode.nta => 'NTA-style mode',
  PracticeMode.full => 'Full mock',
  PracticeMode.quick => 'Quick practice',
  PracticeMode.chapter => 'Chapter practice',
};

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text, this.tone});

  final IconData icon;
  final String text;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      container: true,
      liveRegion: tone != null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: ExcludeSemantics(child: Icon(icon, size: 20, color: tone ?? colors.ink2)),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Text(text, style: context.mmType.body.copyWith(color: colors.ink)),
          ),
        ],
      ),
    );
  }
}

/// "Free right now": only paths that are really free. The 10-question daily practice is listed
/// only when the quote for it says its allowance is available; Learn and Review of answers and
/// keys are free by the spec. Chapter practice is never listed: it costs the same as Quick.
class _FreeRightNow extends ConsumerWidget {
  const _FreeRightNow({
    required this.subjectId,
    required this.showDaily,
    required this.onUseDailyCount,
    required this.onOpenLearn,
    required this.onOpenReview,
  });

  final String subjectId;
  final bool showDaily;
  final VoidCallback onUseDailyCount;
  final VoidCallback onOpenLearn;
  final VoidCallback onOpenReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, child: Text(PracticeCopy.freeRightNow, style: type.subhead)),
        const SizedBox(height: MmSpace.s4),
        if (showDaily) _DailyRow(subjectId: subjectId, onTap: onUseDailyCount),
        _FreeRow(label: PracticeCopy.freeLearn, onTap: onOpenLearn, colors: colors),
        _FreeRow(label: PracticeCopy.freeReview, onTap: onOpenReview, colors: colors),
      ],
    );
  }
}

class _DailyRow extends ConsumerWidget {
  const _DailyRow({required this.subjectId, required this.onTap});

  final String subjectId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The daily set is a Quick practice of 10; the selection's subject decides availability.
    final daily = ref.watch(practiceQuoteProvider(QuoteQuery(subject: subjectId, apiMode: 'quick', count: 10)));
    final q = daily.value;
    if (q == null || !q.launchable || q.allowance?.kind != 'daily_practice' || !q.allowance!.isAvailable) return const SizedBox.shrink();
    return _FreeRow(label: PracticeCopy.freeDaily, onTap: onTap, colors: context.mmColors);
  }
}

class _FreeRow extends StatelessWidget {
  const _FreeRow({required this.label, required this.onTap, required this.colors});

  final String label;
  final VoidCallback onTap;
  final MmColors colors;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      minHeight: 52,
      builder: (_, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          children: [
            Expanded(child: Text(label, style: context.mmType.body)),
            ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3)),
          ],
        ),
      ),
    );
  }
}
