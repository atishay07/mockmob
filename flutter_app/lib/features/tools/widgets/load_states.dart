import 'package:flutter/material.dart';

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

/// Nothing could be loaded: offline (sleepy Mobi, the promise that one load is enough) or an
/// error (thinking Mobi), each with "Try again".
class ToolsLoadFailed extends StatelessWidget {
  const ToolsLoadFailed({super.key, required this.error, required this.onRetry, this.offlineBody = ToolsCopy.offlineBody});

  final Object error;
  final VoidCallback onRetry;
  final String offlineBody;

  @override
  Widget build(BuildContext context) {
    final offline = error is DuLoadError && (error as DuLoadError).offline;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s32),
      child: StateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        title: offline ? ToolsCopy.offlineTitle : ToolsCopy.errorTitle,
        message: offline ? offlineBody : ToolsCopy.errorBody,
        primary: StateAction(ToolsCopy.tryAgain, onRetry),
      ),
    );
  }
}
