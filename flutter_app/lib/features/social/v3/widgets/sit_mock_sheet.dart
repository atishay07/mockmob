// Sitting a Full mock together costs a Free member credits (D174, D175): the one question asked before the paper
// opens. A small sheet, not a screen (D169): what the paper is, what it costs and what the student has, the key
// that says the price ("Sit it for 50 credits"), and one clear way to Pro ("With Pro you start full mocks together
// and sit every one free", See Pro plans). Pro, billing off, a paper already begun on this account and a price the
// server sends as 0 never see it: those open straight in the runner.
//
// The price is the server's (`cost_credits` on the game, or `starts.mock.cost_credits`; 50 when it says nothing
// and billing is on). The server charges on the paper's start and reads the balance itself; the balance here only
// tells the student, it never decides. A refusal that still comes back (CREDITS) is the server's sentence.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_state.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';

/// What sitting [g] costs this student now: the game's own `cost_credits`, else the den's `starts.mock`, else 0.
/// Nothing for a paper already begun (`yourRun`), for a game that is not a full mock, or for Pro.
int mockSitCost(MobGameSummary g, StartRight starts) {
  if (g.format != GameFormat.mock || g.yourRun != YourRun.none) return 0;
  if (!starts.billingOn || starts.via == StartVia.pro) return 0;
  return g.costCredits ?? starts.mockCost;
}

/// Asks before the paper is paid for. True: sit it. False or null: the student left.
Future<bool> showSitMockSheet(BuildContext context, {required MobGameSummary game, required int cost}) async {
  final go = await showMmSheet<bool>(
    context: context,
    title: MobV3Copy.sitMockTitle,
    builder: (_) => _SitBody(game: game, cost: cost),
    footer: (_) => _SitKeys(cost: cost),
  );
  return go == true;
}

int? _balance(WidgetRef ref) => ref.watch(authSnapshotProvider.select((s) => s.creditBalance));

class _SitBody extends ConsumerWidget {
  const _SitBody({required this.game, required this.cost});

  final MobGameSummary game;
  final int cost;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final have = _balance(ref);
    final short = have != null && have < cost;
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
        const SizedBox(height: MmSpace.s4),
        Text(MobV3Copy.sitMockOnce, style: type.small.copyWith(color: colors.ink2)),
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
  const _SitKeys({required this.cost});

  final int cost;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final have = _balance(ref);
    final short = have != null && have < cost;
    final pro = ref.watch(proNudgesOnProvider);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Short of credits, Pro is the way forward and takes the primary place.
        if (short && pro)
          KeyButton(key: const ValueKey('sit-pro'), label: MobV3Copy.sitMockProKey, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.mobFullMock))
        else
          KeyButton(
            key: const ValueKey('sit-key'),
            label: MobV3Copy.sitMockKey(cost),
            onPressed: short ? null : () => Navigator.of(context).pop(true),
            disabledReason: short ? MobV3Copy.sitMockShort(cost, have) : null,
          ),
        if (pro && !short) ...[
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(key: const ValueKey('sit-pro'), label: MobV3Copy.sitMockProKey, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.mobFullMock)),
        ],
      ],
    );
  }
}
