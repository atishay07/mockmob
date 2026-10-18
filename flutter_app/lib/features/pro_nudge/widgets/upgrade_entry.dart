import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/pro_nudge_controller.dart';
import 'upgrade_sheet.dart';

/// The key a Pro gate shows when a feature stands shut for a Free student: an optional line of what
/// Pro changes here, and one key that opens the Upgrade sheet with the gate's own reason. Draws
/// nothing, and takes no space, with `PLAY_BILLING` off, signed out, or for a Pro student.
class UpgradeEntry extends ConsumerWidget {
  const UpgradeEntry({super.key, required this.reason, this.note, this.label = ProNudgeCopy.gateAction, this.topGap = 0, this.bottomGap = 0});

  final ProReason reason;

  /// One calm line above the key (what Pro changes here).
  final String? note;
  final String label;

  /// Space above. It belongs to the entry, so that with the nudge off no gap is left.
  final double topGap;

  /// Space below, owned the same way.
  final double bottomGap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(proNudgesOnProvider)) return const SizedBox.shrink();
    final n = note;
    return Padding(
      padding: EdgeInsets.only(top: topGap, bottom: bottomGap),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (n != null) ...[
            Text(n, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
            const SizedBox(height: MmSpace.s8),
          ],
          KeyButton.secondary(
            label: label,
            expanded: false,
            minHeight: MmTarget.min,
            onPressed: () => showUpgradeSheetIfOn(context, reason: reason),
          ),
        ],
      ),
    );
  }
}
