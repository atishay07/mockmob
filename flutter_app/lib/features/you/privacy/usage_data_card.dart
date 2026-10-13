import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/analytics/event_allowlist.dart';
import '../../../core/repositories/consent_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import 'event_list_sheet.dart';
import 'usage_data_controller.dart';

/// The usage-data switch for an adult: the switch labelled exactly [usageDataConsentLabel] on its
/// own panel, the plain explanation, "See every event we collect", and the story of the last
/// change. Sits in a You page (it brings its own gutters).
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
        YouPanel(
          children: [
            YouSwitchRow(
              title: usageDataConsentLabel,
              value: consent.analyticsActive,
              onChanged: ui.busy ? null : controller.setAllowed,
            ),
          ],
        ),
        _Status(ui: ui, onRetry: () => controller.setAllowed(false)),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s16, MmSpace.gutter, 0),
          child: Text(YouCopy.consentExplanation, style: type.body.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s4),
        const SeeEventsKey(),
      ],
    );
  }
}

/// "See every event we collect", lined up with the text above it.
class SeeEventsKey extends StatelessWidget {
  const SeeEventsKey({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: MmSpace.s4),
      child: Align(
        alignment: Alignment.centerLeft,
        child: KeyButton.quiet(label: YouCopy.seeEvents, onPressed: () => showEventListSheet(context)),
      ),
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
      UsagePhase.enabled => ReceiptLine(text: YouCopy.consentEnabled),
      UsagePhase.withdrawn => ReceiptLine(text: ui.deletedEvents != null ? YouCopy.consentWithdrawn : YouCopy.consentWithdrawnShort),
      UsagePhase.enableFailed => const InlineBanner(message: YouCopy.consentEnableFailed, tone: BannerTone.error),
      UsagePhase.ageFailed => const InlineBanner(message: YouCopy.ageChangeFailed, tone: BannerTone.error),
      UsagePhase.deleteFailed =>
        InlineBanner(message: YouCopy.consentDeleteFailed, tone: BannerTone.warning, actionLabel: YouCopy.tryAgain, onAction: onRetry),
      UsagePhase.unreached =>
        InlineBanner(message: YouCopy.consentUnreached, tone: BannerTone.warning, actionLabel: YouCopy.tryAgain, onAction: onRetry),
    };
    if (body == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
      child: Semantics(liveRegion: true, container: true, child: body),
    );
  }

  Widget _line(MmType type, MmColors colors, String text, {bool spinner = false}) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: spinner ? MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2) : Icon(LucideIcons.check, size: 16, color: colors.ink2),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}

/// The plain statement for a minor or an unknown age: off, and why, on its own panel.
class OffForAccountPanel extends StatelessWidget {
  const OffForAccountPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return YouPanel(
      children: [
        Padding(
          padding: const EdgeInsets.all(MmSpace.gutter),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const IconWell(LucideIcons.shieldCheck),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(liveRegion: true, child: Text(YouCopy.offForAccount, style: type.labelLarge.copyWith(fontSize: 16))),
                    const SizedBox(height: MmSpace.s4),
                    Text(YouCopy.offForAccountNote, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A short paragraph in a You page's text column.
class YouParagraph extends StatelessWidget {
  const YouParagraph(this.text, {super.key, this.top = 0});

  final String text;
  final double top;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(youGutter.left + 4, top, youGutter.right, 0),
      child: Text(text, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
    );
  }
}
