// The week as the student planned it: which days counted (the server's study days), which days
// are planned study days still ahead, and which are rest days by the student's own choice. Pure,
// shared by Today's week row and the week sheet, so both always say the same thing.
import '../../../core/copy/formatters.dart';
import '../../../core/widgets/widgets.dart' show WeekBubbleDay, WeekDayMark;

/// What one day of the week shows. Every mark is a state the student can read and act on
/// (owner 13 Oct: a bubble must carry information or go).
enum PlanDayMark {
  /// The server counted a study day.
  done,

  /// A planned study day not counted yet (today or ahead).
  planned,

  /// A rest day the student chose. Never a miss.
  rest,

  /// A day that passed without study, or any day while there is no plan.
  open,
}

class PlanDay {
  const PlanDay({required this.index, required this.mark, this.isToday = false, this.isPast = false, this.date});

  /// 0 = Monday.
  final int index;
  final PlanDayMark mark;
  final bool isToday;

  /// The day is before today. An open past day is read as not studied, never as "yet".
  final bool isPast;

  /// Day of the month, when the server's week is known.
  final int? date;

  String get initial => weekdayNames[index].substring(0, 1);

  /// The same day in the shared study week ([StudyWeek]): every mark keeps its own meaning.
  WeekBubbleDay toBubble() => WeekBubbleDay(
        mark: switch (mark) {
          PlanDayMark.done => WeekDayMark.done,
          PlanDayMark.planned => WeekDayMark.planned,
          PlanDayMark.rest => WeekDayMark.rest,
          PlanDayMark.open => WeekDayMark.open,
        },
        isToday: isToday,
        date: date,
      );

  String describe() {
    final name = weekdayNames[index];
    final state = switch (mark) {
      PlanDayMark.done => 'study day, counted',
      PlanDayMark.planned => 'planned study day',
      PlanDayMark.rest => 'rest day',
      PlanDayMark.open => isPast ? 'not studied' : 'no study yet',
    };
    return '$name${isToday ? ', today' : ''}, $state';
  }
}

/// Seven days from the server's [studied] flags (Monday first), the student's [planned] study
/// days (0 = Monday; null without a plan) and today's position. A planned day that already
/// passed without study reads as open: it is not shamed, it is just not counted.
List<PlanDay> planWeek({required List<bool> studied, int? todayIndex, Set<int>? planned, List<int?>? dates}) {
  return [
    for (var d = 0; d < 7; d++)
      PlanDay(
        index: d,
        isToday: todayIndex == d,
        isPast: todayIndex != null && d < todayIndex,
        date: dates != null && d < dates.length ? dates[d] : null,
        mark: d < studied.length && studied[d]
            ? PlanDayMark.done
            : planned == null
                ? PlanDayMark.open
                : !planned.contains(d)
                    ? PlanDayMark.rest
                    : (todayIndex == null || d >= todayIndex)
                        ? PlanDayMark.planned
                        : PlanDayMark.open,
      ),
  ];
}

/// The seven days as the shared study week draws them.
List<WeekBubbleDay> bubbleWeek(List<PlanDay> days) => [for (final d in days) d.toBubble()];
