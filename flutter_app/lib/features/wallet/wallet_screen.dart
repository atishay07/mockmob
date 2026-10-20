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
import '../you/widgets/you_row.dart' show IconWell, YouPanel;
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
    final firstMockFree = ref.watch(firstFullMockFreeProvider);

    return YouPage(
      title: WalletCopy.title,
      children: [
        if (view.stale)
          const Padding(
            padding: EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: InlineBanner(message: WalletCopy.stale),
          ),
        const SizedBox(height: MmSpace.s8),
        Padding(padding: youGutter, child: WalletBalanceCard(view: view)),
        if (view.failed)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
            child: Align(alignment: Alignment.centerLeft, child: KeyButton.quiet(label: WalletCopy.tryAgain, onPressed: _reload)),
          ),
        // The Pro bridge sits right under the balance for a Free student: the subscription is never hidden (I6, I9).
        if (billingOn && !view.isPro) ...[
          const SizedBox(height: MmSpace.s16),
          Padding(padding: youGutter, child: _ProBridge(onTap: () => showGetProSheet(context))),
        ],
        // Top-ups are Google Play's: with PLAY_BILLING off there is nothing to buy, so the section is not
        // drawn at all (no "open soon" promise and no key that does nothing).
        if (ref.watch(playBillingEnabledProvider)) ...[
          SectionTitle(view.isPro ? BillingCopy.topUpsTitlePro : BillingCopy.topUpsTitleFree, padding: const EdgeInsets.fromLTRB(youText, MmSpace.s32, youText, MmSpace.s8)),
          const Padding(padding: youGutter, child: WalletTopUps()),
        ],
        const SectionTitle(WalletCopy.buysTitle, padding: EdgeInsets.fromLTRB(youText, MmSpace.s32, youText, MmSpace.s12)),
        Padding(padding: youGutter, child: _Buys(pro: view.isPro, firstMockFree: firstMockFree)),
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

/// The balance as the hero: the one Credits figure (it counts to a new value when the server's figure
/// moves, such as after a confirmed top-up), the plan tag, and the figure split honestly into this
/// month's free credits with their refill date and the kept credits that do not expire (I8: a new
/// account's 150 is 50 free this month plus 100 kept welcome credits). Information only.
class WalletBalanceCard extends StatelessWidget {
  const WalletBalanceCard({super.key, required this.view});

  final WalletView view;

  /// At or under this many credits a Free student is told the balance is running low.
  static const int lowAt = 10;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final total = view.total;
    final free = view.freeLeft;
    final allowance = view.freeAllowance;
    final held = view.held;
    final split = total != null && free != null && held != null;
    final until = view.proUntil;
    final low = total != null && !view.isPro && total <= lowAt;
    final figureWords = total != null ? '$total' : (view.loading ? WalletCopy.checking : WalletCopy.notLoaded);
    final spoken = [
      '${WalletCopy.creditsName}, $figureWords',
      view.isPro ? WalletCopy.planPro : WalletCopy.planFree,
      if (split && allowance != null) '${WalletCopy.freePart}: ${WalletCopy.freePartNote(free, allowance, view.resetsAt)}',
      if (split) '${WalletCopy.keptPart}: $held. ${WalletCopy.keptPartNote}',
      if (low) WalletCopy.lowNote,
      if (view.isPro) WalletCopy.practiceUnlimitedNote,
    ].join('. ');

    return MmSurface.hero(
      lit: true,
      semanticsLabel: spoken,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.wallet, size: 18, color: colors.ink2),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(WalletCopy.creditsName, style: type.labelLarge.copyWith(color: colors.ink2))),
                _Tag(pro: view.isPro),
              ],
            ),
            const SizedBox(height: MmSpace.s12),
            if (total != null)
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  _BalanceFigure(value: total, style: type.figureHero),
                  const SizedBox(width: MmSpace.s8),
                  Flexible(child: Text(WalletCopy.toSpend, style: type.labelLarge.copyWith(color: colors.ink2))),
                ],
              )
            else
              Text(figureWords, style: type.title.copyWith(color: colors.ink3)),
            if (split) ...[
              const SizedBox(height: MmSpace.s16),
              _SplitBar(free: free, kept: held),
              const SizedBox(height: MmSpace.s16),
              _Part(
                dot: colors.volt,
                title: WalletCopy.freePart,
                figure: '$free',
                note: allowance == null ? null : WalletCopy.freePartNote(free, allowance, view.resetsAt),
              ),
              const SizedBox(height: MmSpace.s12),
              _Part(dot: colors.ink3, title: WalletCopy.keptPart, figure: '$held', note: WalletCopy.keptPartNote),
            ],
            if (low) ...[
              const SizedBox(height: MmSpace.s12),
              Text(WalletCopy.lowNote, style: type.small.copyWith(color: colors.warnText)),
            ],
            if (view.isPro) ...[
              const SizedBox(height: MmSpace.s16),
              Text(
                until == null ? WalletCopy.practiceUnlimitedNote : '${CreditsCopy.planUntil(until)}. ${WalletCopy.practiceUnlimitedNote}',
                style: type.small.copyWith(color: colors.ink),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The hero figure. It shows the server's balance as it is; when a new figure from the server is higher
/// (a confirmed top-up) it counts up to it in volt and then settles back to ink over 1.6 s. Under
/// reduced motion it simply shows the new figure.
class _BalanceFigure extends StatefulWidget {
  const _BalanceFigure({required this.value, required this.style});

  final int value;
  final TextStyle style;

  @override
  State<_BalanceFigure> createState() => _BalanceFigureState();
}

class _BalanceFigureState extends State<_BalanceFigure> with SingleTickerProviderStateMixin {
  late final AnimationController _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void didUpdateWidget(_BalanceFigure old) {
    super.didUpdateWidget(old);
    if (widget.value > old.value && !MediaQuery.disableAnimationsOf(context)) _glow.forward(from: 0);
  }

  @override
  void dispose() {
    _glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.mmColors.accentText;
    return AnimatedBuilder(
      animation: _glow,
      builder: (context, _) {
        final v = _glow.value;
        // Full volt while it counts (the first half), then an ease back to the figure's own ink.
        final t = !_glow.isAnimating ? 0.0 : (v < 0.5 ? 1.0 : Curves.easeOut.transform(1 - (v - 0.5) / 0.5));
        return MmCountUp(
          value: widget.value,
          fromZeroOnFirstBuild: false,
          style: widget.style.copyWith(color: Color.lerp(widget.style.color, accent, t)),
        );
      },
    );
  }
}

/// The balance as one bar: this month's free credits in volt, the kept credits in quiet ink.
class _SplitBar extends StatelessWidget {
  const _SplitBar({required this.free, required this.kept});

  final int free;
  final int kept;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final empty = free + kept <= 0;
    return ClipRRect(
      borderRadius: MmRadius.pillAll,
      child: SizedBox(
        height: 8,
        child: empty
            ? ColoredBox(color: colors.line, child: const SizedBox.expand())
            : Row(
                children: [
                  if (free > 0) Expanded(flex: free, child: ColoredBox(color: colors.volt, child: const SizedBox.expand())),
                  if (free > 0 && kept > 0) const SizedBox(width: 2),
                  if (kept > 0) Expanded(flex: kept, child: ColoredBox(color: colors.ink3, child: const SizedBox.expand())),
                ],
              ),
      ),
    );
  }
}

class _Part extends StatelessWidget {
  const _Part({required this.dot, required this.title, required this.figure, this.note});

  final Color dot;
  final String title;
  final String figure;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: DecoratedBox(decoration: BoxDecoration(color: dot, shape: BoxShape.circle), child: const SizedBox(width: 10, height: 10)),
        ),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: type.labelLarge),
              if (note != null) ...[
                const SizedBox(height: 2),
                Text(note!, style: type.small.copyWith(color: colors.ink2)),
              ],
            ],
          ),
        ),
        const SizedBox(width: MmSpace.s12),
        Text(figure, style: type.title.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
      ],
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

/// The bridge to Pro for a Free student: one card that says what Pro changes and opens the Pro page.
class _ProBridge extends StatelessWidget {
  const _ProBridge({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: BoxDecoration(borderRadius: MmRadius.panelAll, border: Border.all(color: colors.lineStrong)),
      child: MmSurface.plain(
        onTap: onTap,
        semanticsLabel: '${WalletCopy.proBridgeTitle}. ${WalletCopy.proBridgeBody} ${WalletCopy.proBridgeKey}',
        child: ExcludeSemantics(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle),
                child: Padding(padding: const EdgeInsets.all(10), child: Icon(LucideIcons.sparkles, size: 20, color: colors.voltInk)),
              ),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(WalletCopy.proBridgeTitle, style: type.title),
                    const SizedBox(height: MmSpace.s4),
                    Text(WalletCopy.proBridgeBody, style: type.small.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s12),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(WalletCopy.proBridgeKey, style: type.labelLarge.copyWith(color: colors.accentText, fontWeight: FontWeight.w700)),
                        const SizedBox(width: MmSpace.s4),
                        Icon(LucideIcons.chevronRight, size: 18, color: colors.accentText),
                      ],
                    ),
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

/// What credits buy, as four tiles with the cost big: Mobi's two jobs, then practice (included on Pro).
class _Buys extends StatelessWidget {
  const _Buys({required this.pro, required this.firstMockFree});

  final bool pro;
  final bool firstMockFree;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Mobi first on every plan (owner, 20 Oct: most top-ups pay for doubts and fixes). On Pro, practice and full mocks
    // are included.
    final mobi = <(IconData, int?, String, String?)>[
      (LucideIcons.messageCircle, 1, WalletCopy.buyDoubt, WalletCopy.buyDoubtNote),
      (LucideIcons.wrench, 1, WalletCopy.buyFix, WalletCopy.buyFixNote),
    ];
    final practice = <(IconData, int?, String, String?)>[
      (LucideIcons.listChecks, pro ? null : 1, WalletCopy.buyQuestion, null),
      (LucideIcons.timer, pro ? null : 50, WalletCopy.buyMock, !pro && firstMockFree ? WalletCopy.buyMockFirstFree : null),
    ];
    final tiles = [...mobi, ...practice];
    return LayoutBuilder(
      builder: (context, c) {
        final w = (c.maxWidth - MmSpace.s12) / 2;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (r, row) in [tiles.sublist(0, 2), tiles.sublist(2)].indexed) ...[
              if (r > 0) const SizedBox(height: MmSpace.s12),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (i, t) in row.indexed) ...[
                      if (i > 0) const SizedBox(width: MmSpace.s12),
                      SizedBox(width: w, child: _BuyTile(icon: t.$1, cost: t.$2, what: t.$3, note: t.$4)),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: MmSpace.s12),
            Text(WalletCopy.costShows, style: type.caption.copyWith(color: colors.ink3)),
          ],
        );
      },
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
              IconWell(entry.delta > 0 ? LucideIcons.plus : (entry.pool == 'ai' ? LucideIcons.messageCircle : LucideIcons.layers)),
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

class _BuyTile extends StatelessWidget {
  const _BuyTile({required this.icon, required this.cost, required this.what, this.note});

  final IconData icon;

  /// Null on Pro for what Pro includes.
  final int? cost;
  final String what;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = cost;
    return Semantics(
      container: true,
      label: '$what: ${c == null ? WalletCopy.includedOnPro : '$c ${WalletCopy.creditsWord(c)}'}${note == null ? '' : '. $note'}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(color: colors.raised, borderRadius: MmRadius.smallAll, border: Border.all(color: colors.line)),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: colors.ink2),
              const SizedBox(height: MmSpace.s8),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: c == null ? WalletCopy.includedOnPro : '$c', style: type.title.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                  if (c != null) TextSpan(text: ' ${WalletCopy.creditsWord(c)}', style: type.small.copyWith(color: colors.ink2)),
                ]),
              ),
              const SizedBox(height: 2),
              Text(what, style: type.small.copyWith(color: colors.ink)),
              if (note != null) ...[
                const SizedBox(height: 2),
                Text(note!, style: type.caption.copyWith(color: colors.goodText)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
