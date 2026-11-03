import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../state/sample_import.dart';

/// The state of the guest carry-over (spec 5.1.5): "Saving", "Saved to your account" (only once
/// the server acknowledged) or the failure line with a retry. Idle and unavailable show nothing,
/// because nothing may claim the answers are saved.
class ImportStatusLine extends StatelessWidget {
  const ImportStatusLine({super.key, required this.phase, this.onRetry});

  final SampleImportPhase phase;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    switch (phase) {
      case SampleImportPhase.idle:
      case SampleImportPhase.unavailable:
        return const SizedBox.shrink();
      case SampleImportPhase.pending:
        return Semantics(
          container: true,
          liveRegion: true,
          label: OnboardingCopy.importPending,
          excludeSemantics: true,
          child: Row(
            children: [
              MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2),
              const SizedBox(width: MmSpace.s8),
              Text(OnboardingCopy.importPending, style: type.small.copyWith(color: colors.ink2)),
            ],
          ),
        );
      case SampleImportPhase.accepted:
        return Semantics(liveRegion: true, child: const ReceiptLine(text: OnboardingCopy.importAccepted));
      case SampleImportPhase.failed:
        return Semantics(
          container: true,
          liveRegion: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: ExcludeSemantics(child: Icon(LucideIcons.circleAlert, size: 16, color: colors.badText)),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(child: Text(OnboardingCopy.importFailed, style: type.small.copyWith(color: colors.ink))),
                ],
              ),
              if (onRetry != null)
                Transform.translate(
                  offset: const Offset(-MmSpace.s16, 0),
                  child: KeyButton.quiet(label: OnboardingCopy.tryAgain, onPressed: onRetry),
                ),
            ],
          ),
        );
    }
  }
}
