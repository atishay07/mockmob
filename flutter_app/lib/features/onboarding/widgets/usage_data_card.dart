import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../choices_copy.dart';
import '../copy.dart';

/// The usage-data row: the switch labelled exactly "Allow usage data to improve MockMob", on by
/// default for an adult (D49) and always in plain sight, with one short line of what it is and
/// where to turn it off later. It sits flat on the sheet (no
/// card inside the sheet). The full explanation and the list of every event we collect are one
/// tap away behind "See every event we collect". [on] comes from the server's acknowledged
/// consent or the student's own choice before they continue (the sheet decides). While a write is in flight a
/// spinner of the same size replaces it.
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MergeSemantics(
          child: Semantics(
            container: true,
            toggled: on,
            label: OnboardingCopy.usageSwitchLabel,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(OnboardingCopy.usageSwitchLabel, style: type.cardTitle),
                        const SizedBox(height: MmSpace.s4),
                        Text(OnboardingCopy.usageSummary, style: type.small.copyWith(color: colors.ink2)),
                        const SizedBox(height: MmSpace.s4),
                        Text(on ? ChoicesCopy.usageOffAnyTime : ChoicesCopy.usageChangeAnyTime, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                SizedBox(
                  width: 56,
                  height: 48,
                  child: Center(child: busy ? MmSpinner(color: colors.ink) : Switch(value: on, onChanged: onChanged)),
                ),
              ],
            ),
          ),
        ),
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
          Text(OnboardingCopy.usageExplanation, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          Text(OnboardingCopy.eventsIntro, style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
          for (final name in OnboardingCopy.eventsPlain)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s4),
              child: Text(name, style: type.small.copyWith(color: colors.ink)),
            ),
        ],
      ],
    );
  }
}
