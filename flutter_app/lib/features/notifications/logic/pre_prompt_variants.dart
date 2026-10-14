import '../copy.dart';

/// Which example reminders an ask shows: all three kinds, or just the one its wording is about.
enum PrePromptFocus { all, study, repair, result, weekly }

/// One way the sheet asks: its title, the line under it, and which examples back it up.
class PrePromptVariant {
  const PrePromptVariant({
    required this.title,
    required this.line,
    this.focus = PrePromptFocus.all,
    this.showLine = true,
  });

  final String title;
  final String line;

  /// False when the examples below already say what the line says (the first, general ask), so
  /// the sheet leaves the line out. The wording stays here, and for the screen reader's label.
  final bool showLine;

  /// The ask about a repair shows the repair reminder, not all three: one ask, one example.
  final PrePromptFocus focus;
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
      focus: PrePromptFocus.study,
    ),
    2 => const PrePromptVariant(
      title: NotificationsCopy.promptRepairTitle,
      line: NotificationsCopy.promptRepairLine,
      focus: PrePromptFocus.repair,
    ),
    3 => const PrePromptVariant(
      title: NotificationsCopy.promptResultTitle,
      line: NotificationsCopy.promptResultLine,
      focus: PrePromptFocus.result,
    ),
    4 => const PrePromptVariant(
      title: NotificationsCopy.promptWeeklyTitle,
      line: NotificationsCopy.promptWeeklyLine,
      focus: PrePromptFocus.weekly,
    ),
    5 => const PrePromptVariant(
      title: NotificationsCopy.promptOptionalTitle,
      line: NotificationsCopy.promptOptionalLine,
    ),
    _ => const PrePromptVariant(
      title: NotificationsCopy.promptTitle,
      line: NotificationsCopy.promptLead,
      showLine: false,
    ),
  };
}
