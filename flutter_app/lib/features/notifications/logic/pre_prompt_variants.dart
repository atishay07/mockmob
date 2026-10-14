import '../copy.dart';

/// One way the sheet asks: its title and the line under it.
class PrePromptVariant {
  const PrePromptVariant({required this.title, required this.line});

  final String title;
  final String line;
}

/// How many different ways the sheet asks before it starts over.
const int prePromptVariantCount = 6;

/// Which wording the [asks]th ask uses: the first ask uses the first wording, and the wording
/// changes with every later ask, in a fixed order.
int prePromptVariantIndex(int asks) => asks <= 0 ? 0 : asks % prePromptVariantCount;

/// The wording for the sheet after [asks] earlier asks. [studyTime] (for example "8:30 PM") is
/// the start of the student's study window, when they have one; only the study-time wording
/// uses it.
///
/// 0 the original, 1 the study-time nudge, 2 repair, 3 result ready, 4 the weekly rhythm,
/// 5 reminders as an option.
PrePromptVariant prePromptVariantFor(int asks, {String? studyTime}) {
  return switch (prePromptVariantIndex(asks)) {
    1 => PrePromptVariant(
      title: NotificationsCopy.promptStudyTitle,
      line: studyTime == null
          ? NotificationsCopy.promptStudyLine
          : NotificationsCopy.promptStudyLineAt(studyTime),
    ),
    2 => const PrePromptVariant(
      title: NotificationsCopy.promptRepairTitle,
      line: NotificationsCopy.promptRepairLine,
    ),
    3 => const PrePromptVariant(
      title: NotificationsCopy.promptResultTitle,
      line: NotificationsCopy.promptResultLine,
    ),
    4 => const PrePromptVariant(
      title: NotificationsCopy.promptWeeklyTitle,
      line: NotificationsCopy.promptWeeklyLine,
    ),
    5 => const PrePromptVariant(
      title: NotificationsCopy.promptOptionalTitle,
      line: NotificationsCopy.promptOptionalLine,
    ),
    _ => const PrePromptVariant(
      title: NotificationsCopy.promptTitle,
      line: NotificationsCopy.promptLead,
    ),
  };
}
