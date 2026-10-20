// A5, the Your chain sheet (Mob V4, MOB-MINIMAL 3.5): the student's own daily chain in one sheet, opened from
// the chain chip in the den header. The week of ticks, rest passes with the "covered by a rest pass" note,
// Exam pause days, "Hide my chain" and the "On the way" milestones.
//
// [YourChainContent] is the one component: the sheet draws it, and so does the chain section in You, so the
// two never disagree. It reads `GET /api/me/chain` through [chainProvider] and owns the loading and failed
// states. The old Chains screen route is a redirect to this sheet (screens/chains_screen.dart).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import 'chain_you.dart';

/// Opens Your chain over the current screen.
Future<void> showYourChainSheet(BuildContext context) => showMmSheet<void>(
      context: context,
      title: MobV4SheetsCopy.yourChainTitle,
      heightFactor: 0.94,
      builder: (_) => const YourChainContent(),
    );

/// The chain's own content: shared by the den chip's sheet and by You.
class YourChainContent extends ConsumerWidget {
  const YourChainContent({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chain = ref.watch(chainProvider);
    // A read that failed shows the sentence at once, even while the provider is retrying it.
    if (chain.hasError && !chain.hasValue) return _Failed(onRetry: () => ref.invalidate(chainProvider));
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
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s32),
          Text(MobV3Copy.chainFailed, textAlign: TextAlign.center, style: context.mmType.lead),
          const SizedBox(height: MmSpace.s24),
          KeyButton.secondary(label: MobV3Copy.tryAgain, onPressed: onRetry),
        ],
      );
}
