// Today, Review and Start make one claim about tonight's repair (integrity review, round 1):
// the same paper, the same chapter, the same first mistake.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

void main() {
  void agree(List<({String attemptId, DateTime receivedAt})> unopened, String paper) {
    final inputs = ashaInputs(unopened: unopened);
    final move = buildMove(inputs);
    final index = buildReviewIndex(inputs.attempts!, const [], unopened: {for (final u in unopened) u.attemptId});
    final tonight = index.tonight!;
    final first = AppRoutes.reviewRepair(tonight.attemptId, tonight.items.first.questionId);

    expect(tonight.attemptId, paper);
    expect(move.evidenceId, paper);
    // Today's key opens the run Review would open, on the same first mistake.
    expect((move.primary.target as GoTo).location, startsWith(first));
    // Today's batch is never bigger than the chapter Review names, and names that chapter.
    expect(int.parse(move.number!), lessThanOrEqualTo(tonight.items.length));
    expect(move.meaning, contains(tonight.chapter));

    // Review's pick for Start is the same first mistake, in the same chapter.
    final container = ProviderContainer(overrides: [reviewIndexProvider.overrideWithValue(index)]);
    addTearDown(container.dispose);
    final quick = container.read(quickRepairFromReviewProvider)!;
    expect(quick.location, first);
    expect(quick.chapter, tonight.chapter);

    // Start's "Repair the next mistake" and the launcher's "10-min repair" both open the
    // ten-minute run from that mistake ('$first?count=$ten'), and the count survives the
    // shortcut's trip through ActionRouter.
    final ten = tonight.items.length < 3 ? tonight.items.length : 3;
    expect(quick.shortcutLocation, '$first?count=$ten');
    final target = ActionRouter.forShortcut(AppShortcutType.repair, repairLocation: quick.shortcutLocation);
    expect((target as NativeTarget).location, '$first?count=$ten');
  }

  test("Today, Review and Start agree on tonight's repair", () => agree(const [], 'm7'));

  test('with the newest result still sealed, all three skip it and agree on the paper before', () {
    // The Business Studies Quick 10 is the newest paper that can carry a repair once Mock 7 is
    // left sealed for its reveal.
    agree([(attemptId: 'm7', receivedAt: tuesdayEvening)], 'q1');
  });
}
