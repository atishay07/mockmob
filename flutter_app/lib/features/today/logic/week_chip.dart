// The chip a tapped day on the week rail names itself with: "Tue 14, counted", "Sat, rest day".
// Pure, so the rail, its semantics and the tests say the same words. Real state only: a day
// the server counted is "counted", a day ahead is "planned", a day that passed without study is
// "not studied" (never "missed"), and a rest day is the student's own choice.
import '../../../core/copy/formatters.dart' show weekdayNames;
import '../../rhythm/logic/plan_week.dart';

/// "Tue 14" (or "Tue" when the server's date for the day is not known).
String dayChipName(PlanDay day) {
  final name = weekdayNames[day.index].substring(0, 3);
  return day.date == null ? name : '$name ${day.date}';
}

/// What the day is, in plain words.
String dayChipState(PlanDay day) => switch (day.mark) {
      PlanDayMark.done => 'counted',
      PlanDayMark.planned => 'planned',
      PlanDayMark.rest => 'rest day',
      PlanDayMark.open => day.isPast ? 'not studied' : 'no study yet',
    };

/// The whole chip: "Tue 14, counted".
String dayChipText(PlanDay day) => '${dayChipName(day)}, ${dayChipState(day)}';
