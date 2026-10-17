// Today's hero and Review's tab badge never contradict (owner recording 15 Oct, item 3: the hero
// said "3 to repair tonight" while the badge said 4). The badge counts tonight's chapter, every
// open mistake of that chapter of that paper; the hero counts the run its chip starts. The rule
// (`repairNumberLabel`): the hero says "to repair tonight" (or "today") only with the badge's
// number. A smaller run names its length ("to repair in 10 min") and says "N of the M open
// mistakes", where M is the badge, and the badge speaks the same noun ("M open mistakes").
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app_overrides.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/widgets/bar/bar_badges.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';

import 'support/today_fixtures.dart';

void main() {
  /// The number Review's tab badge shows for the same record, read through the live wiring.
  int badgeFor(TodayInputs inputs) {
    final index = buildReviewIndex(inputs.attempts!, const [], unopened: {for (final u in inputs.unopened) u.attemptId});
    final container = ProviderContainer(overrides: [...liveAppOverrides(), reviewIndexProvider.overrideWithValue(index)]);
    addTearDown(container.dispose);
    return container.read(barReviewCountProvider);
  }

  void agrees(String name, TodayInputs inputs) {
    test(name, () {
      final move = buildMove(inputs);
      final badge = badgeFor(inputs);
      expect(move.state, NextMoveState.ready);
      expect(badge, greaterThan(0));
      expect(BarBadges(reviewCount: badge).reviewText, '$badge');

      final n = int.parse(move.number!);
      final label = move.numberLabel!;
      final when = TodayCopy.mistakesLabel(n, inputs.clock());
      expect(n, lessThanOrEqualTo(badge), reason: 'the run never holds more than the chapter the badge counts');
      if (n == badge) {
        expect(label, when);
      } else {
        // A smaller run never claims tonight: it names its minutes, and the line under it
        // reconciles the two numbers (not in the returning card, whose line is about the paper).
        expect(label, TodayCopy.mistakesInLabel(move.selectedMinutes!));
        expect(label, isNot(contains('tonight')));
        expect(label, isNot(contains('today')));
        if (!inputs.returning) expect(move.meaning, startsWith('$n of the $badge open mistakes in '));
      }
    });
  }

  // Asha's Mock 7 left four open mistakes in Partnership: the badge says 4 in every case below.
  for (final (time, now) in [('in the evening', tuesdayEvening), ('late at night', tuesdayLate), ('in the morning', DateTime.utc(2026, 10, 13, 2, 0))]) {
    agrees('$time, with the default length', ashaInputs(now: now));
    for (final minutes in const [5, 10, 15]) {
      agrees('$time, with the $minutes min chip', ashaInputs(now: now, selectedMinutes: minutes));
    }
  }
  agrees('a returning student on the 10 min chip', ashaInputs(returning: true, selectedMinutes: 10));

  test('late at night the recorded case reads 3 in 10 min beside a badge of 4, never 3 to repair tonight', () {
    final inputs = ashaInputs(now: tuesdayLate);
    final move = buildMove(inputs);
    expect(badgeFor(inputs), 4);
    expect(move.number, '3');
    expect(move.numberLabel, 'to repair\nin 10 min');
    expect(move.meaning, startsWith('3 of the 4 open mistakes in '));
  });

  test('the whole chapter says mistakes to repair, with the badge number', () {
    final inputs = ashaInputs(selectedMinutes: 15);
    final move = buildMove(inputs);
    expect(move.number, '${badgeFor(inputs)}');
    expect(move.numberLabel, 'mistakes\nto repair');
  });
}
