import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';

/// The shape of a tools screen while the DU files load: the focal pane (its number, its words
/// and its key) and the rows under it, on the ground with the warm light sweeping across them.
class ToolsLoading extends StatelessWidget {
  const ToolsLoading({super.key, this.label = ToolsCopy.loadingTitle, this.rows = 4});

  final String label;
  final int rows;

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      label: label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter + 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const MmSkeletonCard(hero: true),
            const SizedBox(height: MmRhythm.section),
            MmSkeletonRows(rows: rows),
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
