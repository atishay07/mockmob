// Sitting a Full mock together costs a Free member credits (D174, D175): the one question asked before the paper
// opens. A small sheet, not a screen (D169), visual first (D185): the paper's facts as figures, the price as one
// figure beside the credit coins with the balance (a meter when short), the key that says the price ("Sit it for
// 50 credits"), and one clear way to Pro (Get Pro, "With Pro, every full mock is free."). Pro, a paper already begun and a game the server prices at 0 never see
// it: those open straight in the runner.
//
// The price is the server's: the game's `price.costCredits` (APP-API-CONTRACT 2.12). The server charges on the
// paper's start and reads the balance itself; the balance here only tells the student, it never decides. When the
// server still refuses (MOCK_CREDITS) the sheet opens again in its short state with the shortfall, Pro and the
// credits screen. Nothing is charged by a refusal.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_state.dart';
import '../../../../core/router/routes.dart' show AppRoutes;
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../../../wallet/widgets/credit_coins.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'mock_for_you.dart' show MockFactsRow;

/// What sitting [g] costs this student now: the game's own `price.costCredits` (0 for Pro, 0 once begun). Nothing
/// when the server sends no price, for a paper already begun (`yourRun`) or for a game that is not a full mock.
/// [starts] is kept for the callers' sake and for a server that prices only in the den.
int mockSitCost(MobGameSummary g, StartRight starts) {
  if (g.format != GameFormat.mock || g.yourRun != YourRun.none) return 0;
  return g.price?.costCredits ?? (g.price == null ? starts.mockCost : 0);
}

/// Asks before the paper is paid for. True: sit it. False or null: the student left. [refused]: the server said
/// MOCK_CREDITS, so the sheet opens in its short state whatever the balance here says.
Future<bool> showSitMockSheet(BuildContext context, {required int cost, bool refused = false}) async {
  final go = await showMmSheet<bool>(
    context: context,
    title: MobV3Copy.sitMockTitle,
    builder: (_) => _SitBody(cost: cost, refused: refused),
    footer: (_) => _SitKeys(cost: cost, refused: refused),
  );
  return go == true;
}

int? _balance(WidgetRef ref) => ref.watch(authSnapshotProvider.select((s) => s.creditBalance));

class _SitBody extends ConsumerWidget {
  const _SitBody({required this.cost, this.refused = false});

  final int cost;
  final bool refused;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final have = _balance(ref);
    final short = refused || (have != null && have < cost);
    final known = have != null && !(refused && have >= cost);
    final figure = type.figureCompact.copyWith(color: colors.ink, fontSize: 30, height: 1, fontFeatures: const [FontFeature.tabularFigures()]);
    final quiet = type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]);
    // The right side of the price: the balance, then one short word on what happens (charged once, or what is missing).
    final (top, bottom) = short
        ? (known ? MobV3Copy.sitYouHave(have) : MobV3Copy.sitNotEnough, known ? MobV3Copy.sitNeedMore(cost - have) : MobV3Copy.sitNothingCharged)
        : (have == null ? null : MobV3Copy.sitYouHave(have), MobV3Copy.sitChargedOnce);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // What the paper is, as figures: 50 questions | 60 minutes | +5 -1 marks each.
        const MockFactsRow(),
        const SizedBox(height: MmSpace.s20),
        Semantics(
          key: const ValueKey('sit-cost'),
          label: short ? MobV3Copy.sitMockShort(cost, known ? have : null) : MobV3Copy.sitPriceSemantics(cost, have),
          excludeSemantics: true,
          child: Row(
            children: [
              const CreditCoins(size: 44, coins: 3),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(MobV3Copy.sitPriceFigure(cost), style: figure)),
              const SizedBox(width: MmSpace.s8),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (top != null) Text(top, key: const ValueKey('sit-have'), textAlign: TextAlign.end, style: quiet.copyWith(color: short ? colors.ink : colors.ink2, fontWeight: short ? FontWeight.w600 : null)),
                    if (bottom != null) Text(bottom, textAlign: TextAlign.end, style: quiet.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Short of credits: how far the balance reaches toward the price.
        if (short && known) ...[
          const SizedBox(height: MmSpace.s12),
          _Reach(share: cost <= 0 ? 0 : (have / cost).clamp(0.0, 1.0)),
        ],
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }
}

/// A slim meter: the balance against the price, volt on a quiet track.
class _Reach extends StatelessWidget {
  const _Reach({required this.share});

  final double share;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: SizedBox(
          height: 6,
          child: Stack(
            children: [
              Positioned.fill(child: ColoredBox(color: colors.line)),
              FractionallySizedBox(widthFactor: share, heightFactor: 1, child: ColoredBox(color: colors.volt)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SitKeys extends ConsumerWidget {
  const _SitKeys({required this.cost, this.refused = false});

  final int cost;
  final bool refused;

  /// The credits screen (balance, plan, history), pushed over the sheet's page once the sheet has left.
  void _addCredits(BuildContext context) {
    final router = GoRouter.maybeOf(context);
    Navigator.of(context).pop(false);
    unawaited(router?.push<void>(AppRoutes.youCredits) ?? Future<void>.value());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final have = _balance(ref);
    final short = refused || (have != null && have < cost);
    final pro = ref.watch(proNudgesOnProvider);
    void getPro() => showUpgradeSheetIfOn(context, reason: ProReason.mobFullMock);
    // One short line under Get Pro says what Pro changes here (D185: Get Pro, one plan).
    final proLine = Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Text(MobV3Copy.sitProFree, key: const ValueKey('sit-pro-line'), textAlign: TextAlign.center, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (short) ...[
          // Short of credits: Pro is the way forward and takes the primary place; credits are the other way.
          if (pro) ...[
            KeyButton(key: const ValueKey('sit-pro'), label: MobV3Copy.sitMockProKey, onPressed: getPro),
            const SizedBox(height: MmSpace.s8),
          ],
          pro
              ? KeyButton.secondary(key: const ValueKey('sit-add-credits'), label: MobV3Copy.addCredits, onPressed: () => _addCredits(context))
              : KeyButton(key: const ValueKey('sit-add-credits'), label: MobV3Copy.addCredits, onPressed: () => _addCredits(context)),
          if (pro) proLine,
        ] else ...[
          KeyButton(key: const ValueKey('sit-key'), label: MobV3Copy.sitMockKey(cost), onPressed: () => Navigator.of(context).pop(true)),
          if (pro) ...[
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(key: const ValueKey('sit-pro'), label: MobV3Copy.sitMockProKey, onPressed: getPro),
            proLine,
          ],
        ],
      ],
    );
  }
}
