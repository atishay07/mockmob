// The pace strip's weekday choice (L05, app-today-1016 8.7): a new study-days count keeps the
// student's own days wherever it can, adds the rest day farthest from its planned neighbours (ties
// to the earlier weekday) and drops the planned day whose neighbours sit closest (ties to the
// later weekday). The same answer every time, for every size from every size.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/rhythm/widgets/goal_editor.dart' show spreadDays;
import 'package:mockmob/features/today/logic/plan_adjust.dart';

void main() {
  test('adding a day takes the widest gap, ties to the earlier weekday', () {
    // Monday alone: Thursday and Friday are both three days from it; Thursday comes first.
    expect(adjustPlan({0}, 2), {0, 3});
    // Mon and Thu: Sat (two from Thu, two from Mon) is the widest gap.
    expect(adjustPlan({0, 3}, 3), {0, 3, 5});
  });

  test('removing a day drops the most crowded one, ties to the later weekday', () {
    // Mon, Tue, Wed: Tuesday sits between two planned days.
    expect(adjustPlan({0, 1, 2}, 2), {0, 2});
    // Mon, Wed, Fri, Sun: Monday and Sunday are equally crowded; Sunday goes.
    expect(adjustPlan({0, 2, 4, 6}, 3), {0, 2, 4});
  });

  test('every size from every plan keeps the student\'s own days and is stable', () {
    final plans = <Set<int>>[
      for (var n = 1; n <= 7; n++) spreadDays(n),
      {0, 1},
      {5, 6},
      {1, 2, 3},
      {0, 6},
    ];
    for (final plan in plans) {
      for (var n = 1; n <= 7; n++) {
        final a = adjustPlan(plan, n);
        expect(a.length, n, reason: '$plan to $n');
        expect(adjustPlan(plan, n), a, reason: 'the same answer twice');
        expect(a.every((d) => d >= 0 && d < 7), isTrue);
        if (n >= plan.length) {
          expect(a.containsAll(plan), isTrue, reason: 'adding keeps $plan');
        } else {
          expect(plan.containsAll(a), isTrue, reason: 'removing only removes from $plan');
        }
      }
    }
  });

  test('counts outside 1 to 7 are clamped, and no plan spreads the days', () {
    expect(adjustPlan({0, 2}, 0), hasLength(1));
    expect(adjustPlan({0, 2}, 9), {0, 1, 2, 3, 4, 5, 6});
    expect(adjustPlan(null, 4), spreadDays(4));
  });
}
