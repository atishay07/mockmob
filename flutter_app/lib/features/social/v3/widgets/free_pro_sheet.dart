// P4 Free and Pro in the Mob (spec 5.3, Arena S7). Only when billing is on. "Pro never changes marks, chains or
// what you can earn. It adds hosting." The two lists are the spec's exact words; "See Pro plans" opens the
// app's existing Upgrade sheet, which is where any price lives. There is no price in the Mob itself.
// With billing off the sheet does not open at all (no plan word may appear).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'chain_paper.dart';

Future<void> showFreeProSheet(BuildContext context) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final v3 = container.read(denViewProvider)?.v3;
  final billingOn = v3?.starts.billingOn ?? false;
  if (!billingOn) return;
  final live = v3?.live.enabled ?? false;
  // The Full mock together lines appear only while the server offers it (formats on).
  final mocks = v3?.starts.shows(GameFormat.mock) ?? false;
  final price = v3?.starts.freeMockPrice ?? kMockSitCredits;
  await showMmSheet<void>(
    context: context,
    title: MobV3Copy.freeProTitle,
    heightFactor: 0.94,
    builder: (_) => FreeProBody(live: live, mocks: mocks, price: price),
    footer: (_) => const _PlansKey(),
  );
}

/// The two lists and the seal: the sheet's body, and the section of Mob settings (A7), the same words in both.
class FreeProBody extends StatelessWidget {
  const FreeProBody({super.key, required this.live, this.mocks = false, this.price = kMockSitCredits});

  /// The server's live switch: live rooms are sold only while it is on (L-04).
  final bool live;
  final bool mocks;
  final int price;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobV3Copy.proLead, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        MmSurface.plain(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: _List(title: MobV3Copy.freeAlways, items: MobV3Copy.freeListFor(mocks: mocks, mockCost: price), icon: LucideIcons.check, iconColor: colors.accentText),
        ),
        const SizedBox(height: MmSpace.s12),
        DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(MmRhythm.plainRadius), border: Border.all(color: colors.lineStrong)),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s16),
            child: _List(title: MobV3Copy.proAdds, items: MobV3Copy.proListFor(live: live, mocks: mocks), icon: LucideIcons.plus, iconColor: colors.ink2),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The seal: nothing in the Mob is for sale.
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(color: ChainPaper.fill(context), borderRadius: BorderRadius.circular(8), border: Border.all(color: ChainPaper.edge(context))),
              child: const Icon(LucideIcons.stamp, size: 16, color: ChainPaper.ink),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Padding(padding: const EdgeInsets.only(top: 4), child: Text(MobV3Copy.notForSale, style: type.small.copyWith(color: colors.ink2)))),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.title, required this.items, required this.icon, required this.iconColor});

  final String title;
  final List<String> items;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, style: type.cardTitle)),
        const SizedBox(height: MmSpace.s8),
        for (final t in items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 18, color: iconColor)),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(t, style: type.body.copyWith(height: 1.35))),
              ],
            ),
          ),
      ],
    );
  }
}

/// "See Pro plans": the existing Upgrade sheet. It is drawn only while the Pro nudges are on, so the key is never dead.
class _PlansKey extends ConsumerWidget {
  const _PlansKey();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(proNudgesOnProvider)) return const SizedBox.shrink();
    return KeyButton(label: MobV3Copy.seePlans, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.mobHosting));
  }
}
