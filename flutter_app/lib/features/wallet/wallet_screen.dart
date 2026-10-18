import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart' show nowProvider;
import '../../core/copy/copy.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../billing/billing.dart';
import '../credits/credits_copy.dart';
import '../you/widgets/you_page.dart';
import '../you/widgets/you_row.dart' show IconWell, YouPanel, YouRow;
import 'data/wallet_data.dart';
import 'wallet_copy.dart';

/// The one wallet: one Credits balance (this month's free credits left plus the credits held), what a
/// credit buys, the free allowance and when it resets, the top-ups (one set of packs for everything),
/// a quiet Pro row for a Free student and the recent history. The figures are the server's own;
/// nothing is estimated and a balance that did not load is never 0.
///
/// Top-ups and Pro are Google Play's (`PLAY_BILLING`): every price here is Google Play's own string.
/// With the flag off the balance and the history are the same, and there is no top-up section and no Pro row.
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  /// The history opens at the latest few lines; Show earlier opens everything read.
  bool _expanded = false;
  static const int _recent = 8;

  @override
  void initState() {
    super.initState();
    // Spending happens in other screens: read the wallet again each time this page opens.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(walletRepositoryProvider.notifier).refresh(force: true);
    });
  }

  void _reload() => ref.read(walletRepositoryProvider.notifier).refresh(force: true);

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(walletViewProvider);
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
        Padding(padding: youGutter, child: _Balance(view: view)),
        if (view.failed)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: Align(alignment: Alignment.centerLeft, child: KeyButton.quiet(label: WalletCopy.tryAgain, onPressed: _reload)),
          ),
        // Top-ups are Google Play's: with PLAY_BILLING off there is nothing to buy, so the section is not
        // drawn at all (no "open soon" promise and no key that does nothing).
        if (ref.watch(playBillingEnabledProvider)) ...[
          const SectionTitle(BillingCopy.topUpsTitle, padding: EdgeInsets.fromLTRB(youText, MmSpace.s32, youText, MmSpace.s12)),
          const Padding(padding: youGutter, child: WalletTopUps()),
        ],
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
        const SectionTitle(WalletCopy.recent, padding: EdgeInsets.fromLTRB(youText, MmSpace.s32, youText, MmSpace.s4)),
        _history(context, view),
      ],
    );
  }

  Widget _history(BuildContext context, WalletView view) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rows = view.history;

    if (view.loading) {
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
    // The balance read can work while the lines did not: the figure stays, the lines say so.
    if (view.failed || view.historyUnavailable) {
      return Padding(
        padding: youGutter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(WalletCopy.historyFailedTitle, style: type.title),
            const SizedBox(height: MmSpace.s8),
            Text(WalletCopy.historyFailedBody, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            PillKey(label: WalletCopy.tryAgain, onPressed: _reload),
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
    final groups = <(String, List<WalletEntry>)>[];
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
        for (final group in groups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, youText, MmSpace.s4),
            child: Semantics(header: true, child: Text(group.$1, style: type.caption.copyWith(color: colors.ink2))),
          ),
          YouPanel(
            flat: true,
            margin: EdgeInsets.zero,
            inset: youText + 36 + MmSpace.s12,
            children: [for (final e in group.$2) _HistoryRow(entry: e)],
          ),
        ],
        if (!_expanded && rows.length > _recent)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s16, youText, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: PillKey(label: WalletCopy.showEarlier, onPressed: () => setState(() => _expanded = true)),
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

/// The one balance: the figure, what a credit buys, the free allowance with its reset, and the
/// credits held. Information only.
class _Balance extends StatelessWidget {
  const _Balance({required this.view});

  final WalletView view;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final known = view.total != null;
    final figure = known ? '${view.total}' : (view.loading ? WalletCopy.checking : WalletCopy.notLoaded);
    final lines = <String>[
      view.buys ?? WalletCopy.creditsFor,
      if (view.freeLeft != null && view.freeAllowance != null) WalletCopy.freeLeft(view.freeLeft!, view.freeAllowance!),
      if (view.resetsAt != null) WalletCopy.resets(view.resetsAt!),
      if (view.held != null && view.held! > 0) '${WalletCopy.held(view.held!)}. ${WalletCopy.heldNote}',
      if (view.isPro) WalletCopy.practiceUnlimitedNote,
    ];
    return MmSurface.plain(
      semanticsLabel: '${WalletCopy.creditsName}, $figure. ${lines.join(' ')}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.wallet, size: 18, color: colors.ink2),
              const SizedBox(width: MmSpace.s8),
              Text(WalletCopy.creditsName, style: type.labelLarge.copyWith(color: colors.ink2)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          Text(figure, style: known ? type.figure.copyWith(fontFeatures: const [FontFeature.tabularFigures()]) : type.title.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s12),
          for (final (i, line) in lines.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s4),
              child: Text(line, style: (i == 0 ? type.body : type.small).copyWith(color: i == 0 ? colors.ink : colors.ink2)),
            ),
        ],
      ),
    );
  }
}

/// One line of the history: what it was, the time, the change and what is left. Information only.
class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.entry});

  final WalletEntry entry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final time = formatTime12(entry.at.toLocal());
    final what = entry.what.isEmpty ? (entry.isSpend ? 'Credits used' : 'Credits added') : entry.what;
    final change = entry.delta < 0 ? '$minusSign${entry.delta.abs()}' : '+${entry.delta}';
    final left = entry.balanceAfter == null ? null : '${entry.balanceAfter} left';
    return Semantics(
      container: true,
      label: '$what. ${entry.isSpend ? 'Used' : 'Added'} ${entry.delta.abs()}. ${left ?? ''} $time',
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText, vertical: MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const IconWell(LucideIcons.layers),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(what, style: type.labelLarge.copyWith(fontSize: 16)),
                    const SizedBox(height: MmSpace.s4),
                    Text(time, style: type.caption.copyWith(fontSize: 12, color: colors.ink3)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(change, style: type.title.copyWith(color: entry.isSpend ? colors.ink : colors.goodText)),
                  if (left != null) ...[
                    const SizedBox(height: 2),
                    Text(left, style: type.caption.copyWith(fontSize: 12, color: colors.ink2)),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
