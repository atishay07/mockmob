// C1 and C2, the chains (spec 5.3): two tabs, "You" (the private daily chain) and the Mob's own (the weekly
// chain of the pennant). A student with no Mob sees only their own. The bodies live in widgets/chain_you.dart
// and widgets/chain_mob.dart; this screen holds the header, the tabs and the loading and failed states.
//
// The chain is read from `GET /api/me/chain` (chainProvider); the Mob's part is the den's own read, so the
// two tabs never disagree with the den.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../widgets/chain_mob.dart';
import '../widgets/chain_you.dart';

class ChainsScreen extends ConsumerStatefulWidget {
  const ChainsScreen({super.key, this.mobTab = false});

  /// Opens on the Mob's tab (a tap on the pennant) instead of "You".
  final bool mobTab;

  @override
  ConsumerState<ChainsScreen> createState() => _ChainsScreenState();
}

class _ChainsScreenState extends ConsumerState<ChainsScreen> {
  late bool _mob = widget.mobTab;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final den = ref.watch(denViewProvider);
    final hasMob = den != null && den.mob != null;
    final onMob = _mob && hasMob;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MmPageHeader(title: MobV3Copy.chainsTitle),
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s32 + MediaQuery.paddingOf(context).bottom),
                    children: [
                      if (hasMob) ...[
                        MmSegmented<bool>(
                          showBubbles: false,
                          semanticsLabel: MobV3Copy.chainsTitle,
                          segments: [MmSegment(false, MobV3Copy.tabYou), MmSegment(true, den.v3.name.text.isEmpty ? MobV3Copy.title : den.v3.name.text)],
                          value: onMob,
                          onChanged: (v) => setState(() => _mob = v),
                        ),
                        const SizedBox(height: MmSpace.s24),
                      ],
                      if (onMob) ChainMobBody(den: den) else const _YouTab(),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _YouTab extends ConsumerWidget {
  const _YouTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chain = ref.watch(chainProvider);
    return chain.when(
      data: (c) => ChainYouBody(chain: c),
      loading: () => const SkeletonGroup(
        label: MobV3Copy.chainLoading,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 96, radius: 20),
            SizedBox(height: MmSpace.s20),
            Skeleton(height: 56, radius: 14),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 96, radius: 24),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 240, radius: 24),
          ],
        ),
      ),
      error: (e, _) => _Failed(onRetry: () => ref.invalidate(chainProvider)),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.s32),
        Text(MobV3Copy.chainFailed, textAlign: TextAlign.center, style: type.lead),
        const SizedBox(height: MmSpace.s24),
        KeyButton.secondary(label: MobV3Copy.tryAgain, onPressed: onRetry),
      ],
    );
  }
}
