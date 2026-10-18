import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart' show nowProvider;
import '../../core/copy/copy.dart';
import '../../core/repositories/remote_state.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../billing/billing.dart';
import '../credits/credits_copy.dart';
import '../credits/data/credits_data.dart';
import '../credits/data/credits_models.dart';
import '../credits/widgets/history_row.dart';
import '../you/widgets/you_page.dart';
import '../you/widgets/you_row.dart' show YouPanel, YouRow;
import 'data/wallet_view.dart';
import 'wallet_copy.dart';

/// The one wallet: both balances side by side (Practice credits, and AI credits with this month's
/// included credits and the ones bought), one line each on what they are for, the top-ups, a quiet
/// Pro row for a Free student and the recent history. The figures are the server's own; nothing is
/// estimated and a balance that did not load is never 0.
///
/// Top-ups and Pro are Google Play's (`PLAY_BILLING`): every price here is Google Play's own
/// string. With the flag off the balances and the history are the same and the top-ups say they
/// open soon.
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  /// The history opens at the latest few lines; Show earlier opens everything read so far.
  bool _expanded = false;
  static const int _recent = 8;

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
    final view = ref.watch(walletViewProvider);
    final mine = ref.watch(meCreditsProvider);
    final billingOn = ref.watch(playBillingEnabledProvider) && ref.watch(playBillingUserIdProvider) != null;

    return YouPage(
      title: WalletCopy.title,
      children: [
        if (view.stale)
          const Padding(
            padding: EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: InlineBanner(message: WalletCopy.stale),
          ),
        _PlanLine(view: view),
        const SizedBox(height: MmSpace.s16),
        Padding(padding: youGutter, child: _Balances(view: view)),
        if (view.failed)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.quiet(label: WalletCopy.tryAgain, onPressed: () => ref.read(meCreditsProvider.notifier).refresh(force: true)),
            ),
          ),
        const GroupHeading(BillingCopy.topUpsTitle, top: MmSpace.s32),
        Padding(padding: youGutter, child: WalletTopUps(showPractice: !view.isPro)),
        if (billingOn && !view.isPro) ...[
          const SizedBox(height: MmSpace.s24),
          YouPanel(
            flat: true,
            children: [
              YouRow(
                flat: true,
                icon: LucideIcons.sparkles,
                title: WalletCopy.proRowTitle,
                note: WalletCopy.proRowNote,
                onTap: () => showGetProSheet(context),
              ),
            ],
          ),
        ],
        const GroupHeading(WalletCopy.recent, top: MmSpace.s32),
        _history(context, mine),
      ],
    );
  }

  Widget _history(BuildContext context, RemoteState<CreditsOverview> mine) {
    final colors = context.mmColors;
    final type = context.mmType;
    final more = ref.watch(creditsMoreProvider);
    final rows = <CreditEntry>[...?mine.value?.history, ...more.rows];
    final hasMore = ref.read(creditsMoreProvider.notifier).hasMore;

    if (mine.isInitialLoading) {
      return const Padding(
        padding: youGutter,
        child: SkeletonGroup(
          label: WalletCopy.recent,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Skeleton(height: 56), SizedBox(height: MmSpace.s12), Skeleton(height: 56), SizedBox(height: MmSpace.s12), Skeleton(height: 56)],
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
            Text(WalletCopy.historyFailedTitle, style: type.title),
            const SizedBox(height: MmSpace.s8),
            Text(WalletCopy.historyFailedBody, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            PillKey(label: WalletCopy.tryAgain, onPressed: () => ref.read(meCreditsProvider.notifier).refresh(force: true)),
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
            Text(WalletCopy.historyEmptyTitle, style: type.title),
            const SizedBox(height: MmSpace.s8),
            Text(WalletCopy.historyEmptyBody, style: type.body.copyWith(color: colors.ink2)),
          ],
        ),
      );
    }

    final shown = _expanded ? rows : rows.take(_recent).toList();
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
    final canExpand = !_expanded && rows.length > _recent;
    final canLoadMore = _expanded && hasMore;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in groups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, MmSpace.s4),
            child: Semantics(header: true, child: Text(group.$1, style: type.caption.copyWith(color: colors.ink2))),
          ),
          YouPanel(
            flat: true,
            margin: EdgeInsets.zero,
            inset: youText + 36 + MmSpace.s12,
            children: [for (final e in group.$2) HistoryRow(entry: e)],
          ),
        ],
        if (more.failed)
          const Padding(
            padding: EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, 0),
            child: InlineBanner(message: WalletCopy.moreFailed, tone: BannerTone.error),
          ),
        if (canExpand || canLoadMore)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s16, youText, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: PillKey(
                label: more.loading ? WalletCopy.loadingMore : (more.failed ? WalletCopy.tryAgain : WalletCopy.showEarlier),
                onPressed: more.loading
                    ? null
                    : canExpand
                        ? () => setState(() => _expanded = true)
                        : () => ref.read(creditsMoreProvider.notifier).loadMore(),
              ),
            ),
          ),
      ],
    );
  }

  static String _dayLabel(DateTime now, DateTime at) {
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(at.year, at.month, at.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return WalletCopy.today;
    if (diff == 1) return WalletCopy.yesterday;
    return at.year == now.year ? formatDayMonth(at) : '${formatDayMonth(at)} ${at.year}';
  }
}

/// The plan: the Free pill alone, or the Pro pill with "Pro until 31 July 2027".
class _PlanLine extends StatelessWidget {
  const _PlanLine({required this.view});

  final WalletView view;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final until = view.proUntil;
    final line = view.isPro ? (until == null ? CreditsCopy.planProActive : CreditsCopy.planUntil(until)) : null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
      child: Row(
        children: [
          Semantics(label: view.isPro ? WalletCopy.planPro : WalletCopy.planFree, excludeSemantics: true, child: _Tag(pro: view.isPro)),
          if (line != null) ...[
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(line, style: context.mmType.body.copyWith(color: colors.ink2))),
          ],
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.pro});

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
          pro ? WalletCopy.planPro : WalletCopy.planFree,
          style: context.mmType.label.copyWith(color: pro ? colors.voltInk : colors.ink2, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// The two balances on one surface, side by side. At large text they stack, so no figure or
/// sentence is cut.
class _Balances extends StatelessWidget {
  const _Balances({required this.view});

  final WalletView view;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final stacked = MediaQuery.textScalerOf(context).scale(1) >= 1.3;
    final practice = _Balance(
      icon: LucideIcons.layers,
      name: WalletCopy.practiceName,
      figure: _practiceFigure(),
      lines: [
        if (view.isPro)
          WalletCopy.practiceUnlimitedNote
        else if (view.practice != null)
          WalletCopy.aboutQuestions(view.practice!),
        WalletCopy.practiceFor,
      ],
      boldFirst: !view.isPro && view.practice != null,
    );
    final ai = _Balance(
      icon: LucideIcons.sparkles,
      name: WalletCopy.aiName,
      figure: _aiFigure(),
      lines: [
        if (view.aiPaused) WalletCopy.aiPaused,
        if (view.aiIncludedLeft != null && view.aiIncludedOf != null) WalletCopy.aiIncluded(view.aiIncludedLeft!, view.aiIncludedOf!),
        if (view.aiBought != null) WalletCopy.aiBought(view.aiBought!),
        if (view.aiResetsAt != null) WalletCopy.resets(view.aiResetsAt!),
        WalletCopy.aiFor,
      ],
    );
    return MmSurface.plain(
      child: stacked
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [practice, const SizedBox(height: MmSpace.s16), SizedBox(height: 1, child: ColoredBox(color: colors.line)), const SizedBox(height: MmSpace.s16), ai],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: practice),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                  child: SizedBox(width: 1, height: 160, child: ColoredBox(color: colors.line)),
                ),
                Expanded(child: ai),
              ],
            ),
    );
  }

  String _practiceFigure() {
    if (view.isPro) return WalletCopy.practiceUnlimited;
    if (view.practice != null) return '${view.practice}';
    return view.loading ? WalletCopy.checking : WalletCopy.notLoaded;
  }

  String _aiFigure() {
    if (view.aiTotal != null) return '${view.aiTotal}';
    return view.loading ? WalletCopy.checking : WalletCopy.notLoaded;
  }
}

class _Balance extends StatelessWidget {
  const _Balance({required this.icon, required this.name, required this.figure, required this.lines, this.boldFirst = false});

  final IconData icon;
  final String name;
  final String figure;
  final List<String> lines;

  /// The first line is a figure's meaning (about 38 questions), not a note.
  final bool boldFirst;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final known = RegExp(r'^[0-9]+$').hasMatch(figure) || figure == WalletCopy.practiceUnlimited;
    return Semantics(
      container: true,
      label: '$name, $figure. ${lines.join('. ')}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Expanded(child: Text(name, style: type.labelLarge.copyWith(color: colors.ink2))),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          Align(
            alignment: Alignment.centerLeft,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                figure,
                maxLines: 1,
                style: known ? type.figureCompact.copyWith(fontFeatures: const [FontFeature.tabularFigures()]) : type.title.copyWith(color: colors.ink3),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          for (final (i, line) in lines.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s4),
              child: Text(
                line,
                style: (i == 0 && boldFirst ? type.small.copyWith(fontWeight: FontWeight.w600) : type.small).copyWith(color: i == 0 && boldFirst ? colors.ink : colors.ink2),
              ),
            ),
        ],
      ),
    );
  }
}
