import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../state/sheet_sync.dart';

/// Where saving the sheet to the account stands, in one line with its mark: a spinner while the
/// requests are out, a volt check only once the server has acknowledged every write, a warning
/// glyph when it failed (the sheet stays on the phone; the sheet that holds this offers "Try
/// again" as its main key). Today and You may reuse it.
class SheetStatus extends StatelessWidget {
  const SheetStatus({super.key, required this.phase, this.offline = false});

  final SheetSyncPhase phase;
  final bool offline;

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
    final Widget mark = switch (phase) {
      SheetSyncPhase.saved => Stack(
          alignment: Alignment.center,
          children: [
            const Bubble(state: BubbleState.filled, size: 24, inkOrigin: Offset(-1, 0)),
            Icon(LucideIcons.check, size: 15, color: colors.voltInk),
          ],
        ),
      SheetSyncPhase.saving || SheetSyncPhase.idle => SizedBox.square(dimension: 24, child: Center(child: MmSpinner(color: colors.ink2))),
      SheetSyncPhase.failed => SizedBox.square(dimension: 24, child: Center(child: Icon(LucideIcons.triangleAlert, size: 22, color: colors.warnText))),
      SheetSyncPhase.kept => SizedBox.square(dimension: 24, child: Center(child: Icon(LucideIcons.info, size: 22, color: colors.ink2))),
    };
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(child: mark),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: Text(title, style: type.cardTitle)),
                if (detail != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  Text(detail, style: type.small.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
