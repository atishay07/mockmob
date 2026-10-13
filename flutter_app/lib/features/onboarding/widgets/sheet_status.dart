import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../state/sheet_sync.dart';

/// Where saving the sheet to the account stands, in one line with its bubble: pending while the
/// requests are out, inked only once the server has acknowledged every write. A failure keeps
/// the sheet on the phone and offers "Try again". Today and You may reuse it.
class SheetStatus extends StatelessWidget {
  const SheetStatus({super.key, required this.phase, required this.onRetry, this.offline = false});

  final SheetSyncPhase phase;
  final bool offline;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (title, detail) = switch (phase) {
      SheetSyncPhase.saved => (OnboardingCopy.savedSheet, OnboardingCopy.savedWhat),
      SheetSyncPhase.failed => (offline ? OnboardingCopy.savedOffline : OnboardingCopy.savedFailed, null),
      SheetSyncPhase.kept => (OnboardingCopy.keptExisting, null),
      SheetSyncPhase.saving || SheetSyncPhase.idle => (OnboardingCopy.savingSheet, null),
    };
    final mark = switch (phase) {
      SheetSyncPhase.saved => const Bubble(state: BubbleState.filled, size: 22, inkOrigin: Offset(-1, 0)),
      SheetSyncPhase.saving || SheetSyncPhase.idle => SizedBox.square(dimension: 22, child: Center(child: MmSpinner(color: colors.ink2))),
      _ => const Bubble(state: BubbleState.marked, size: 22),
    };
    return Semantics(
      liveRegion: true,
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              mark,
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: type.cardTitle),
                    if (detail != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(detail, style: type.small.copyWith(color: colors.ink2)),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (phase == SheetSyncPhase.failed)
            Align(alignment: Alignment.centerLeft, child: KeyButton.quiet(label: OnboardingCopy.tryAgain, onPressed: onRetry)),
        ],
      ),
    );
  }
}
