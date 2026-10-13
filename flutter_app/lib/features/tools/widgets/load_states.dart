import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';

/// The shape of a tools screen while the DU files load: the focal pane and a few rows, no shimmer.
class ToolsLoading extends StatelessWidget {
  const ToolsLoading({super.key, this.label = ToolsCopy.loadingTitle, this.rows = 4});

  final String label;
  final int rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SkeletonGroup(
      label: label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(color: colors.raised, borderRadius: MmRadius.panelAll),
              child: const Padding(
                padding: EdgeInsets.all(MmSpace.cardPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Skeleton(width: 120, height: 48),
                    SizedBox(height: MmSpace.s12),
                    Skeleton.line(width: 220),
                    SizedBox(height: MmSpace.s16),
                    Row(children: [Skeleton(width: 84, height: 32, radius: 16), SizedBox(width: 8), Skeleton(width: 104, height: 32, radius: 16)]),
                  ],
                ),
              ),
            ),
            const SizedBox(height: MmSpace.s32),
            for (var i = 0; i < rows; i++) ...[
              const Skeleton.line(width: 240),
              const SizedBox(height: MmSpace.s8),
              const Skeleton.line(width: 140, height: 12),
              const SizedBox(height: MmSpace.s20),
            ],
          ],
        ),
      ),
    );
  }
}

/// Nothing could be loaded. Offline (the DU files not on this phone yet, or the phone says it
/// has no network) shows sleepy Mobi and the promise that the student's work is safe, and the
/// load runs again by itself the moment the network returns. Any other failure shows thinking
/// Mobi. Both keep "Try again".
class ToolsLoadFailed extends ConsumerWidget {
  const ToolsLoadFailed({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<AsyncValue<void>>(networkRestoredProvider, (previous, next) {
      if (next is AsyncData<void>) onRetry();
    });
    final phoneOffline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    final offline = phoneOffline || (error is DuLoadError && (error as DuLoadError).offline);
    // Sits at about the optical centre of the space under the header, not hard against it.
    final top = (MediaQuery.sizeOf(context).height * 0.16).clamp(MmSpace.s32, 160.0);
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: StateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        pose: offline ? MobiPose.sleepy : MobiPose.think,
        title: offline ? ToolsCopy.offlineTitle : ToolsCopy.errorTitle,
        message: offline ? ToolsCopy.offlineBody : ToolsCopy.errorBody,
        primary: StateAction(ToolsCopy.tryAgain, onRetry),
      ),
    );
  }
}
