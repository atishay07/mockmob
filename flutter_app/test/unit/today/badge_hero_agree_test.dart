// Today's hero and Review's tab badge never contradict (owner recording 15 Oct, item 3: the hero
// said "3 to repair tonight" while the badge said 4). Since the final walk (18 Oct, H7) the badge is
// the account's open repairs, the one count Today's Repairs tile and Practice's Repairs row print, so
// a bare "2" never sits beside "139 open". The hero counts tonight's chapter and always names it: it
// says "to repair tonight" (or "today") only with the whole chapter's number; a smaller run names its
// length ("to repair in 10 min") and says "N of the M open mistakes in <chapter>".
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app_overrides.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/widgets/bar/bar_badges.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/glance_builder.dart' show buildQueue;
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';

import 'support/today_fixtures.dart';

void main() {
  ReviewIndex indexFor(TodayInputs inputs) => buildReviewIndex(inputs.attempts!, const [], unopened: {for (final u in inputs.unopened) u.attemptId});

  /// The number Review's tab badge shows for the same record, read through the live wiring.
  int badgeFor(TodayInputs inputs) {
    final container = ProviderContainer(overrides: [...liveAppOverrides(), reviewIndexProvider.overrideWithValue(indexFor(inputs))]);
    addTearDown(container.dispose);
    return container.read(barReviewCountProvider);
  }

  /// Tonight's chapter: every open mistake of that chapter of that paper (what the hero counts).
  int tonightFor(TodayInputs inputs) => indexFor(inputs).tonight!.items.length;

  void agrees(String name, TodayInputs inputs) {
    test(name, () {
      final move = buildMove(inputs);
      final badge = tonightFor(inputs);
      expect(move.state, NextMoveState.ready);
      expect(badge, greaterThan(0));
      expect(badgeFor(inputs), greaterThanOrEqualTo(badge), reason: 'the badge is every open repair, tonight's chapter among them');

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
        if (!inputs.returning) expect(move.meaning, startsWith('$n of the $badge open mistakes in '), reason: 'the chapter count always names its chapter');
      }
    });
  }

  // Asha's Mock 7 left four open mistakes in Partnership: tonight's chapter is 4 in every case below.
  for (final (time, now) in [('in the evening', tuesdayEvening), ('late at night', tuesdayLate), ('in the morning', DateTime.utc(2026, 10, 13, 2, 0))]) {
    agrees('$time, with the default length', ashaInputs(now: now));
    for (final minutes in const [5, 10, 15]) {
      agrees('$time, with the $minutes min chip', ashaInputs(now: now, selectedMinutes: minutes));
    }
  }
  agrees('a returning student on the 10 min chip', ashaInputs(returning: true, selectedMinutes: 10));

  test('late at night the recorded case reads 3 in 10 min of the chapter's 4, never 3 to repair tonight', () {
    final inputs = ashaInputs(now: tuesdayLate);
    final move = buildMove(inputs);
    expect(tonightFor(inputs), 4);
    expect(move.number, '3');
    expect(move.numberLabel, 'to repair\nin 10 min');
    expect(move.meaning, startsWith('3 of the 4 open mistakes in '));
  });

  test('the whole chapter says mistakes to repair, with the chapter's number', () {
    final inputs = ashaInputs(selectedMinutes: 15);
    final move = buildMove(inputs);
    expect(move.number, '${tonightFor(inputs)}');
    expect(move.numberLabel, 'mistakes\nto repair');
  });

  test('the badge, Today's Repairs tile and Practice's row say one count: every open repair (final walk, H7)', () {
    final inputs = ashaInputs();
    final index = indexFor(inputs);
    final badge = badgeFor(inputs);
    expect(badge, index.openCount);
    final container = ProviderContainer(overrides: [reviewIndexProvider.overrideWithValue(index)]);
    addTearDown(container.dispose);
    final open = container.read(openRepairsProvider);
    expect(open, badge, reason: 'Practice's Repairs row reads openRepairsProvider');
    final withOpen = ashaInputs(openRepairs: open);
    expect(buildQueue(withOpen).repairsOpen, badge, reason: 'Today's Repairs tile');
    expect(BarBadges(reviewCount: badge).reviewText, badge > 9 ? '9+' : '$badge');
  });
}
