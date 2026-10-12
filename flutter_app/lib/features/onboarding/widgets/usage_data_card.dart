import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The usage-data card (spec 5.1.6 and 5.12.3): the switch labelled exactly "Allow usage data to
/// improve MockMob", off until an adult turns it on, then the plain explanation and the list of
/// every event we collect. [on] must come from the server's acknowledged consent, so the switch
/// never shows on before the server agrees. While a write is in flight [busy] swaps the switch
/// for a spinner of the same size.
class UsageDataCard extends StatelessWidget {
  const UsageDataCard({
    super.key,
    required this.on,
    required this.busy,
    required this.eventsOpen,
    required this.onChanged,
    required this.onToggleEvents,
  });

  final bool on;
  final bool busy;
  final bool eventsOpen;
  final ValueChanged<bool> onChanged;
  final VoidCallback onToggleEvents;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised2,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MergeSemantics(
              child: Semantics(
                container: true,
                toggled: on,
                label: OnboardingCopy.usageSwitchLabel,
                child: Row(
                  children: [
                    Expanded(child: Text(OnboardingCopy.usageSwitchLabel, style: type.subhead)),
                    const SizedBox(width: MmSpace.s12),
                    SizedBox(
                      width: 52,
                      height: 48,
                      child: Center(
                        child: busy
                            ? MmSpinner(color: colors.ink)
                            : Switch(value: on, onChanged: onChanged),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (busy) ...[
              const SizedBox(height: MmSpace.s4),
              Text(OnboardingCopy.usageSaving, style: type.small.copyWith(color: colors.ink2)),
            ],
            const SizedBox(height: MmSpace.s12),
            Text(OnboardingCopy.usageExplanation, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Transform.translate(
                offset: const Offset(-MmSpace.s16, 0),
                child: KeyButton.quiet(
                  label: eventsOpen ? OnboardingCopy.hideEvents : OnboardingCopy.seeEvents,
                  onPressed: onToggleEvents,
                ),
              ),
            ),
            if (eventsOpen) ...[
              const SizedBox(height: MmSpace.s8),
              Text(OnboardingCopy.eventsIntro, style: type.small.copyWith(color: colors.ink3)),
              const SizedBox(height: MmSpace.s8),
              for (final name in OnboardingCopy.eventsPlain)
                Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s4),
                  child: Text(name, style: type.small.copyWith(color: colors.ink)),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
