import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/analytics/event_allowlist.dart';
import '../../../core/repositories/consent_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_row.dart';
import 'event_list_sheet.dart';
import 'usage_data_controller.dart';

/// The usage-data switch card of spec 5.12.3 for an adult: the switch labelled exactly
/// [usageDataConsentLabel], the explanation and the "See every event we collect" link. Reusable:
/// the first-result inline row and the "Before you start" sheet show this same card (they add
/// their own Done key).
///
/// The switch is off until the server acknowledges a turn-on. A turn-off is shown at once, and
/// its confirmation appears only after the server answers.
class UsageDataSwitchCard extends ConsumerWidget {
  const UsageDataSwitchCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final consent = ref.watch(consentRepositoryProvider);
    final ui = ref.watch(usageDataControllerProvider);
    final controller = ref.read(usageDataControllerProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        YouSwitchRow(
          title: usageDataConsentLabel,
          value: consent.analyticsActive,
          hairline: false,
          onChanged: ui.busy ? null : controller.setAllowed,
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Text(YouCopy.consentExplanation, style: type.body.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s8),
        Padding(
          padding: EdgeInsets.zero,
          child: Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(label: YouCopy.seeEvents, onPressed: () => showEventListSheet(context)),
          ),
        ),
        _Status(ui: ui, onRetry: () => controller.setAllowed(false)),
      ],
    );
  }
}

class _Status extends StatelessWidget {
  const _Status({required this.ui, required this.onRetry});

  final UsageDataUi ui;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Widget? body = switch (ui.phase) {
      UsagePhase.idle => null,
      UsagePhase.enabling => _line(type, colors, YouCopy.consentEnabling, spinner: true),
      UsagePhase.withdrawing => _line(type, colors, YouCopy.consentTurningOff, spinner: true),
      UsagePhase.enabled => _line(type, colors, YouCopy.consentEnabled, done: true),
      UsagePhase.withdrawn => _line(
          type,
          colors,
          ui.deletedEvents != null ? YouCopy.consentWithdrawn : YouCopy.consentWithdrawnShort,
          done: true,
        ),
      UsagePhase.enableFailed => const InlineBanner(message: YouCopy.consentEnableFailed, tone: BannerTone.error),
      UsagePhase.ageFailed => const InlineBanner(message: YouCopy.ageChangeFailed, tone: BannerTone.error),
      UsagePhase.deleteFailed =>
        InlineBanner(message: YouCopy.consentDeleteFailed, tone: BannerTone.warning, actionLabel: YouCopy.tryAgain, onAction: onRetry),
      UsagePhase.unreached =>
        InlineBanner(message: YouCopy.consentUnreached, tone: BannerTone.warning, actionLabel: YouCopy.tryAgain, onAction: onRetry),
    };
    if (body == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12),
      child: Semantics(liveRegion: true, container: true, child: body),
    );
  }

  Widget _line(MmType type, MmColors colors, String text, {bool spinner = false, bool done = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: spinner
                ? MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2)
                : Icon(done ? LucideIcons.check : LucideIcons.smartphone, size: 16, color: colors.ink2),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}
