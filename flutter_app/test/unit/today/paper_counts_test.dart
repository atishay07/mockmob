// "Recent papers" and the marks strip above its rows each name their own set with its real count
// (owner recording 15 Oct, item 4: "Your last 4" sat beside "Marks across your last 6 mocks").
// Papers are every finished paper, the rows; the strip is one kind of them, named with its
// subject. Each caption's numbers are what is drawn, out of what is on record.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';

import 'support/today_fixtures.dart';

void main() {
  test("Asha's record: the newest 4 of 8 papers, and the strip draws the newest 6 of 7 Accountancy mocks", () {
    final view = buildToday(ashaInputs());
    expect(view.sheet, hasLength(4));
    expect(view.papers, 8);
    expect(TodayCopy.sheetCaption(view.sheet.length, view.papers), 'Last 4 of 8 papers');

    final trend = view.trend!;
    expect(trend.points, hasLength(6));
    expect(trend.ofKind, 7);
    expect(TodayCopy.trendCaption(trend.points.length, trend.ofKind, trend.kind), 'Marks in your last 6 of 7 Accountancy mocks');
  });

  test('when everything is shown, both captions say all of them', () {
    final record = ashaRecord(tuesdayEvening);
    final view = buildToday(ashaInputs(attempts: [record[0], record[2], record[3]]));
    expect(TodayCopy.sheetCaption(view.sheet.length, view.papers), 'All 3 papers');
    final trend = view.trend!;
    expect(TodayCopy.trendCaption(trend.points.length, trend.ofKind, trend.kind), 'Marks in all 3 of your Accountancy mocks');
  });

  test('a practice strip is named the way its rows are: Quick 10 papers', () {
    final now = tuesdayEvening;
    Attempt quick(String id, int days) => paper(
          id: id,
          completedAt: daysBefore(now, days),
          mode: 'quick',
          runs: const [('Partnership fundamentals', V.right, 7), ('Partnership fundamentals', V.wrong, 3)],
        );
    final view = buildToday(ashaInputs(attempts: [quick('p3', 1), quick('p2', 2), quick('p1', 3)]));
    final trend = view.trend!;
    expect(TodayCopy.trendCaption(trend.points.length, trend.ofKind, trend.kind), 'Marks in all 3 of your Accountancy Quick 10 papers');
    expect(view.sheet.first.label, 'Quick 10');
  });

  test('one paper says so', () {
    expect(TodayCopy.sheetCaption(1, 1), 'Your only paper');
  });
}
