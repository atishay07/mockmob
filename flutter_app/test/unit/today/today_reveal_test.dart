import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/widgets/road_timeline.dart' show roadNextIndex;
import 'package:mockmob/features/today/widgets/today_entrance.dart';
import 'package:mockmob/features/today/widgets/today_reveal.dart';

import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

/// A page with a section far below the fold whose drawn-in value is captured on each build.
Widget _page(ScrollController controller, void Function(Animation<double>) capture) => SingleChildScrollView(
      controller: controller,
      child: Column(
        children: [
          const SizedBox(height: 2000),
          TodayReveal(
            child: Builder(
              builder: (context) {
                capture(todayEnterValue(context, delay: Duration.zero));
                return const SizedBox(height: 120);
              },
            ),
          ),
          const SizedBox(height: 400),
        ],
      ),
    );

void main() {
  testWidgets('a section below the fold waits, then draws itself in once it scrolls into view', (tester) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    late Animation<double> value;
    await pumpMockmob(tester, _page(controller, (v) => value = v), size: const Size(384, 800));
    expect(value.value, 0, reason: 'out of sight, nothing has played yet');

    controller.jumpTo(1700);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));
    expect(value.value, greaterThan(0), reason: 'it starts as it arrives');
    await tester.pumpAndSettle();
    expect(value.value, 1);
  });

  testWidgets('reduced motion shows the section drawn from the first frame', (tester) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    late Animation<double> value;
    await pumpMockmob(tester, _page(controller, (v) => value = v), size: const Size(384, 800), disableAnimations: true);
    expect(value.value, 1);
  });

  test('the road names the stretch to the next stop in weeks, or days in the last week', () {
    expect(TodayCopy.stretchTo(105), '15 weeks');
    expect(TodayCopy.stretchTo(7), '1 week');
    expect(TodayCopy.stretchTo(3), '3 days');
    expect(TodayCopy.stretchTo(0), '1 day');
  });

  test('the next stop is the first one that starts after today', () {
    final road = buildToday(ashaInputs()).road!;
    expect(roadNextIndex(road.stops, road.today), 0, reason: 'registration is the next stop in October');
    expect(roadNextIndex(road.stops, DateTime.utc(2027, 5, 10)), -1, reason: 'inside the window nothing is ahead');
  });
}
