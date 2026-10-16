// Your colleges on Today (IA 5.2, L25): with colleges, the rows open Compass and See all goes to
// Colleges; without, the card says what the subjects open and both keys do something; while the
// list loads its rows are held; a failed read says so and offers Try again.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/colleges_card.dart';

import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  Future<List<String>> pump(WidgetTester tester, RoadModel road, CollegesCardInfo info) async {
    final events = <String>[];
    await pumpMockmob(
      tester,
      SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: CollegesCard(
          road: road,
          info: info,
          onChoose: () => events.add('choose'),
          onSeeAll: () => events.add('all'),
          onCompass: () => events.add('compass'),
          onRow: (r) => events.add('row:${r.college}'),
          onRetry: () => events.add('retry'),
        ),
      ),
      size: const Size(390, 844),
      disableAnimations: true,
    );
    await tester.pumpAndSettle();
    return events;
  }

  RoadModel road({bool picks = true}) {
    final r = buildRoad(ashaInputs())!;
    return RoadModel(
      weeks: r.weeks,
      today: r.today,
      end: r.end,
      category: r.category,
      ladder: picks
          ? const [
              LadderRung(college: 'Hansraj College', course: 'B.Com (Hons)', score: '645.3', outOf: 1000, dream: true, programmeId: 'bcom-hons'),
              LadderRung(college: 'Kirori Mal College', course: 'B.Com (Hons)', score: '637.5', outOf: 1000, programmeId: 'bcom-hons'),
            ]
          : const [],
    );
  }

  testWidgets('with colleges: the rows open Compass and See all goes to Colleges', (tester) async {
    final events = await pump(tester, road(), const CollegesCardInfo());
    expect(find.text(TodayCopy.collegesTitle), findsOneWidget);
    await tester.tap(find.text('Kirori Mal College'));
    await tester.tap(find.text(TodayCopy.seeAllColleges));
    expect(events, ['row:Kirori Mal College', 'all']);
  });

  testWidgets('without colleges: the count with its denominator, Choose colleges and Open Compass', (tester) async {
    final events = await pump(tester, road(picks: false), const CollegesCardInfo(open: 35, total: 73));
    expect(find.text(TodayCopy.collegesOpenCount(35, 73)), findsOneWidget);
    await tester.tap(find.text(TodayCopy.chooseCollegesShort));
    await tester.tap(find.text(TodayCopy.openCompass));
    expect(events, ['choose', 'compass']);
  });

  testWidgets('without the Compass count it says what the card leads to, never a guessed number', (tester) async {
    await pump(tester, road(picks: false), const CollegesCardInfo());
    expect(find.text(TodayCopy.collegesOpenUnknown), findsOneWidget);
  });

  testWidgets('a failed list says so and Try again reads it again', (tester) async {
    final events = await pump(tester, road(picks: false), const CollegesCardInfo(status: CollegesCardStatus.failed));
    expect(find.text(TodayCopy.collegesFailed), findsOneWidget);
    await tester.tap(find.text(TodayCopy.tryAgain));
    expect(events, ['retry']);
  });

  testWidgets('while the list loads its rows are held, with no keys', (tester) async {
    await pump(tester, road(picks: false), const CollegesCardInfo(status: CollegesCardStatus.loading));
    expect(find.text(TodayCopy.chooseCollegesShort), findsNothing);
    expect(find.byKey(const ValueKey('colleges-loading')), findsOneWidget);
  });
}
