// Sitting a Full mock together costs a Free member credits (D174, D175): the one question asked before the paper
// opens. A small sheet, not a screen (D169): what the paper is, what it costs and what the student has, the key
// that says the price ("Sit it for 50 credits"), and one clear way to Pro ("With Pro you start full mocks together
// and sit every one free", See Pro plans). Pro, a paper already begun and a game the server prices at 0 never see
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
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobV3Copy.mockDetail, key: const ValueKey('sit-what'), style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        Text(
          short ? MobV3Copy.sitMockShort(cost, have) : MobV3Copy.sitMockCost(cost, have),
          key: const ValueKey('sit-cost'),
          style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700),
        ),
        if (!short) ...[
          const SizedBox(height: MmSpace.s4),
          Text(MobV3Copy.sitMockOnce, style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        Container(
          padding: const EdgeInsets.all(MmSpace.s12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(MmRhythm.plainRadius), border: Border.all(color: colors.lineStrong)),
          child: Text(MobV3Copy.sitMockPro, key: const ValueKey('sit-pro-line'), style: type.body.copyWith(color: colors.ink)),
        ),
        const SizedBox(height: MmSpace.s8),
      ],
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
    final proKey = KeyButton(
      key: const ValueKey('sit-pro'),
      label: MobV3Copy.sitMockProKey,
      onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.mobFullMock),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (short) ...[
          // Short of credits: Pro is the way forward and takes the primary place; credits are the other way.
          if (pro) proKey,
          if (pro) const SizedBox(height: MmSpace.s8),
          pro
              ? KeyButton.secondary(key: const ValueKey('sit-add-credits'), label: MobV3Copy.addCredits, onPressed: () => _addCredits(context))
              : KeyButton(key: const ValueKey('sit-add-credits'), label: MobV3Copy.addCredits, onPressed: () => _addCredits(context)),
        ] else ...[
          KeyButton(key: const ValueKey('sit-key'), label: MobV3Copy.sitMockKey(cost), onPressed: () => Navigator.of(context).pop(true)),
          if (pro) ...[
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(key: const ValueKey('sit-pro'), label: MobV3Copy.sitMockProKey, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.mobFullMock)),
          ],
        ],
      ],
    );
  }
}
