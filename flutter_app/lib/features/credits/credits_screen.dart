import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart' show nowProvider;
import '../../core/copy/copy.dart';
import '../../core/repositories/remote_state.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../you/widgets/you_page.dart';
import '../you/widgets/you_row.dart' show YouPanel;
import 'credits_copy.dart';
import 'data/credit_figures.dart';
import 'data/credits_data.dart';
import 'data/credits_models.dart';
import 'widgets/history_row.dart';
import 'widgets/pool_card.dart';

/// Credits: the plan, the balance and the history of every spend and top-up, newest first, 30 to a
/// page. The figures are the server's own (`GET /api/me/credits`); nothing is estimated and a balance
/// that did not load is never 0. No price and no purchase.
///
/// On a server that keeps one credits balance the page shows that one figure, "Credits", and a history
/// with no pools to filter. On an older server it shows the two pools with what each pays for, and the
/// history can be narrowed to one of them.
class CreditsScreen extends ConsumerStatefulWidget {
  const CreditsScreen({super.key});

  @override
  ConsumerState<CreditsScreen> createState() => _CreditsScreenState();
}

class _CreditsScreenState extends ConsumerState<CreditsScreen> {
  /// Null shows both pools.
  CreditPool? _filter;

  @override
  void initState() {
    super.initState();
    // Spending happens in other screens: read the ledger again each time this page opens.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(meCreditsProvider.notifier).refresh(force: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final figures = ref.watch(creditFiguresProvider);
    final mine = ref.watch(meCreditsProvider);
    final more = ref.watch(creditsMoreProvider);
    final overview = mine.value;
    final one = figures.oneBalance;
    final rows = <CreditEntry>[...?overview?.history, ...more.rows];
    final filter = one ? null : _filter;
    final shown = filter == null ? rows : [for (final r in rows) if (r.pool == filter) r];
    final hasMore = ref.read(creditsMoreProvider.notifier).hasMore;

    return YouPage(
      title: CreditsCopy.title,
      children: [
        if (mine.isStale)
          const Padding(
            padding: EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: InlineBanner(message: CreditsCopy.stale),
          ),
        _PlanLine(figures: figures),
        const SizedBox(height: MmSpace.s16),
        if (one)
          Padding(padding: youGutter, child: OneBalanceCard(figures: figures))
        else ...[
          Padding(
            padding: youGutter,
            child: PoolCard(pool: CreditPool.practice, figures: figures),
          ),
          const SizedBox(height: MmSpace.s12),
          Padding(
            padding: youGutter,
            child: PoolCard(pool: CreditPool.ai, figures: figures, mobi: true),
          ),
        ],
        const GroupHeading(CreditsCopy.historyTitle, top: MmSpace.s32),
        _history(context, mine: mine, rows: rows, shown: shown, hasMore: hasMore, more: more, one: one, filter: filter),
      ],
    );
  }

  Widget _history(
    BuildContext context, {
    required RemoteState<CreditsOverview> mine,
    required List<CreditEntry> rows,
    required List<CreditEntry> shown,
    required bool hasMore,
    required CreditsMoreState more,
    required bool one,
    required CreditPool? filter,
  }) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (mine.isInitialLoading) {
      return const Padding(
        padding: youGutter,
        child: SkeletonGroup(
          label: CreditsCopy.historyTitle,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Skeleton(height: 56),
              SizedBox(height: MmSpace.s12),
              Skeleton(height: 56),
              SizedBox(height: MmSpace.s12),
              Skeleton(height: 56),
            ],
          ),
        ),
      );
    }
    if (mine.isFailedEmpty) {
      return Padding(
        padding: youGutter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(CreditsCopy.historyFailedTitle, style: type.title),
            const SizedBox(height: MmSpace.s8),
            Text(CreditsCopy.historyFailedBody, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            PillKey(label: CreditsCopy.tryAgain, onPressed: () => ref.read(meCreditsProvider.notifier).refresh(force: true)),
          ],
        ),
      );
    }
    if (rows.isEmpty) {
      return Padding(
        padding: youGutter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(CreditsCopy.historyEmptyTitle, style: type.title),
            const SizedBox(height: MmSpace.s8),
            Text(one ? CreditsCopy.historyEmptyBodyOne : CreditsCopy.historyEmptyBody, style: type.body.copyWith(color: colors.ink2)),
          ],
        ),
      );
    }

    final now = ref.watch(nowProvider)();
    final groups = <(String, List<CreditEntry>)>[];
    for (final e in shown) {
      final label = _dayLabel(now, e.at.toLocal());
      if (groups.isEmpty || groups.last.$1 != label) {
        groups.add((label, [e]));
      } else {
        groups.last.$2.add(e);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The pools to narrow by, on an older server only: one row at any width and text size. Short
        // labels (the cards above already say "Practice credits" and "AI credits"), and a sideways scroll
        // rather than a second row when the text is very large (final walk: the chips wrapped at 360 dp).
        if (!one) ...[
          ChipRail.labelled(
            key: const ValueKey('credits-filters'),
            labels: const [CreditsCopy.filterAll, CreditsCopy.filterPractice, CreditsCopy.filterAi],
            selected: switch (filter) { null => 0, CreditPool.practice => 1, CreditPool.ai => 2 },
            onSelected: (i) => setState(() => _filter = const [null, CreditPool.practice, CreditPool.ai][i]),
            padding: youGutter,
            semanticLabel: CreditsCopy.filterLabel,
          ),
          const SizedBox(height: MmSpace.s12),
        ],
        if (shown.isEmpty && filter != null)
          Padding(
            padding: youGutter,
            child: Text(CreditsCopy.historyEmptyFor(filter), style: type.body.copyWith(color: colors.ink2)),
          ),
        for (final group in groups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, MmSpace.s4),
            child: Semantics(header: true, child: Text(group.$1, style: type.caption.copyWith(color: colors.ink2))),
          ),
          YouPanel(
            flat: true,
            margin: EdgeInsets.zero,
            inset: youText + 36 + MmSpace.s12,
            children: [for (final e in group.$2) HistoryRow(entry: e, oneBalance: one)],
          ),
        ],
        if (more.failed)
          const Padding(
            padding: EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, 0),
            child: InlineBanner(message: CreditsCopy.moreFailed, tone: BannerTone.error),
          ),
        if (hasMore)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s16, youText, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: PillKey(
                label: more.loading ? CreditsCopy.loadingMore : (more.failed ? CreditsCopy.tryAgain : CreditsCopy.showMore),
                onPressed: more.loading ? null : () => ref.read(creditsMoreProvider.notifier).loadMore(),
              ),
            ),
          ),
      ],
    );
  }

  /// "Today", "Yesterday" or "14 October" (with the year when it is not this one).
  static String _dayLabel(DateTime now, DateTime at) {
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(at.year, at.month, at.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return CreditsCopy.today;
    if (diff == 1) return CreditsCopy.yesterday;
    return at.year == now.year ? formatDayMonth(at) : '${formatDayMonth(at)} ${at.year}';
  }
}

/// The plan: the "Free" pill alone, or the "Pro" pill with "Pro until 12 January 2027". No price and no
/// way to buy here.
class _PlanLine extends StatelessWidget {
  const _PlanLine({required this.figures});

  final CreditFigures figures;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pro = figures.isPro;
    final until = figures.proUntil;
    final line = pro ? (until == null ? CreditsCopy.planProActive : CreditsCopy.planUntil(until)) : null;
    // Free is the pill alone: "Free" and "Free plan" side by side said the same thing twice
    // (critic 16 Oct, finding 27/28). Pro keeps its line, because the date is news.
    return Padding(
      padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PlanTag(pro: pro),
              if (line != null) ...[
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(line, style: type.body.copyWith(color: colors.ink2))),
              ],
            ],
          ),
          // One quiet line (M-002): where the mocks come from, true on every plan.
          const SizedBox(height: MmSpace.s8),
          Text(PlanCopy.bankLine(pro: pro), style: type.small.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

/// "Pro" inked in volt, or "Free" as a quiet outline.
class PlanTag extends StatelessWidget {
  const PlanTag({super.key, required this.pro});

  final bool pro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: pro ? colors.volt : null,
        borderRadius: MmRadius.pillAll,
        border: pro ? null : Border.all(color: colors.lineStrong),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Text(
          pro ? CreditsCopy.planPro : CreditsCopy.planFree,
          style: context.mmType.label.copyWith(color: pro ? colors.voltInk : colors.ink2, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
