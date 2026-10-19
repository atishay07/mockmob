import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/review/support/review_fixtures.dart';
import 'review_golden_support.dart';

/// The demo's repair, as the owner walked it: a 10-question quick practice with one mistake. The
/// moment screens put their block at the optical centre (SPACING.md 7), so no dead band opens
/// between the last content and the pinned key.
final _quick = Attempt.fromJson(
  mockJson(
    id: 'dq',
    completedAt: DateTime.utc(2026, 10, 12, 17, 12),
    mode: 'quick',
    count: 10,
    subject: 'economics',
    chapter: 'Money and banking',
    wrong: {1},
  ),
);

RepairRunState _run(RepairPhase phase) {
  final pick = buildReviewIndex([_quick], const []).openGroups.single.items.first;
  return RepairRunState(
    attemptId: 'dq',
    chapter: pick.chapter,
    subjectId: pick.subjectId,
    source: pick.source,
    steps: [RepairStep(pick, phase == RepairPhase.ending ? explained : null)],
    phase: phase,
  );
}

double _void(WidgetTester tester, Finder lastContent) {
  final contentBottom = tester.getRect(lastContent.first).bottom;
  // The pinned key is the first key below the content (the share key sits inside it).
  final below = [
    for (final e in find.byType(KeyButton).evaluate()) tester.getRect(find.byWidget(e.widget)).top,
  ].where((top) => top > contentBottom + 1).toList()..sort();
  return below.first - contentBottom;
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    testWidgets('the repair ending has no dead band above its key, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'dq'),
        brightness: brightness,
        size: kReviewSize,
        disableAnimations: true,
        overrides: reviewOverrides(attempts: [_quick], run: _run(RepairPhase.ending)),
        wrapInScaffold: false,
      );
      await tester.pump(const Duration(seconds: 2));
      final gap = _void(tester, find.text('Share a card'));
      expect(gap, lessThanOrEqualTo(144), reason: 'the void under the last line, above the key: $gap');
    });

    testWidgets('the repair entry has no dead band above its key, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const RepairScreen(attemptId: 'dq', questionId: 'dq-q1'),
        brightness: brightness,
        size: kReviewSize,
        disableAnimations: true,
        overrides: reviewOverrides(attempts: [_quick], run: _run(RepairPhase.entry), credits: credits(9)),
        wrapInScaffold: false,
      );
      await tester.pump(const Duration(seconds: 2));
      final gap = _void(tester, find.textContaining('Uses 1 credit'));
      expect(gap, lessThanOrEqualTo(144), reason: 'the void under the last line, above the key: $gap');
    });
  }
}
