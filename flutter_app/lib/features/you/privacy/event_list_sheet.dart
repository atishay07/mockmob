import 'package:flutter/material.dart';

import '../../../core/analytics/event_allowlist.dart';
import '../../../core/models/consent.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../edit_copy.dart';

/// "See every event we collect": the whole allowlist, in plain words.
Future<void> showEventListSheet(BuildContext context) {
  return showMmSheet<void>(
    context: context,
    title: YouCopy.eventsTitle,
    builder: (context) => const EventList(),
    footer: (context) => KeyButton.secondary(
      label: EditCopy.done,
      minHeight: MmTarget.min,
      onPressed: () => Navigator.of(context).maybePop(),
    ),
  );
}

class EventList extends StatelessWidget {
  const EventList({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(YouCopy.eventsIntro, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        for (final text in analyticsEventDescriptions.values)
          DecoratedBox(
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
              // A plain ruled list: a bubble here would encode nothing (owner feedback 11-10).
              child: Text(text, style: type.body),
            ),
          ),
      ],
    );
  }
}

/// "Are you 18 or older?": three equal rows. Pops with the chosen band, or null when dismissed.
Future<AgeBand?> showAgeQuestionSheet(BuildContext context, {required AgeBand current, bool answered = true}) {
  return showMmSheet<AgeBand>(
    context: context,
    title: YouCopy.ageQuestion,
    builder: (context) => _AgeQuestion(current: current, answered: answered),
  );
}

class _AgeQuestion extends StatelessWidget {
  const _AgeQuestion({required this.current, required this.answered});

  final AgeBand current;
  final bool answered;

  @override
  Widget build(BuildContext context) {
    Widget option(String label, AgeBand band) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: KeyButton.option(
            label: label,
            // An unknown band can mean "never asked" or "prefer not to say", so only a recorded
            // answer is shown as chosen.
            selected: answered && current == band,
            onPressed: () => Navigator.of(context).pop(band),
          ),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        option(YouCopy.ageYes, AgeBand.adult),
        option(YouCopy.ageNo, AgeBand.minor),
        option(YouCopy.agePreferNot, AgeBand.unknown),
      ],
    );
  }
}
