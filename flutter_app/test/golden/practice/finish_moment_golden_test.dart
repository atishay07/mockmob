// The moment after Submit (19 Oct, D108 and G22): the restored finish moment with its completion line, at 360 and 412 dp,
// Night and Day, and at 1.3x text; and a frame sequence of a 10-question set straight from the submit (0, 300, 600, 840,
// 1100, 1500 and 2200 ms), the in-test twin of the emulator's frames, to compare with FinishStage's approved beats.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mobi_ration.dart' show MobiRation;
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show settleImages;
import '../../unit/core_data/support/fixtures.dart';
import '../../unit/practice/support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/today'),
  stubRoute('/practice'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/start'),
  stubRoute('/review'),
  stubRoute('/review/repair/:attemptId/:questionId'),
];

/// Seven right, two wrong, one left: 33 of 50 marks.
final _seven = [
  for (var i = 0; i < 7; i++) ('Admission of a partner', V.right),
  ('Admission of a partner', V.wrong),
  ('Goodwill', V.wrong),
  ('Goodwill', V.blank),
];

/// A great set: nine right, one wrong.
final _great = [
  for (var i = 0; i < 9; i++) ('Admission of a partner', V.right),
  ('Goodwill', V.wrong),
];

AttemptDetail _detail(List<(String, V)> questions) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
  'answerReviews': <String, dynamic>{},
  'answerReviewState': 'ready',
});

Future<void> _pump(WidgetTester tester, Brightness b, Size size, List<Override> overrides, {double textScale = 1}) => pumpRouted(
  tester,
  location: '/practice/result/p1',
  routes: _routes(),
  brightness: b,
  size: size,
  textScale: textScale,
  overrides: overrides,
);

Future<void> _frames(WidgetTester tester, int ms) async {
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  setUpAll(loadAppFonts);
  // Mobi's acts are rationed on the wall clock across the run (once a day a screen, never twice in a hurry): each
  // golden starts from a fresh ration, so his pose does not depend on the tests before it.
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    for (final (width, height) in [(360.0, 760.0), (412.0, 915.0)]) {
      testWidgets('the settled moment, 7 of 10, ${width.round()} dp, $tag', (tester) async {
        final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
        await _pump(tester, b, Size(width, height), resultOverrides(attemptId: 'p1', detail: _detail(_seven), pending: pending));
        await tester.pump();
        await tester.pump();
        await _frames(tester, 3200);
        await settleImages(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/moment_settled_${width.round()}_$tag.png'));
        await tester.pump(const Duration(seconds: 4));
      });
    }

    testWidgets('the settled moment at 1.3x text, 360 dp, $tag', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      await _pump(tester, b, const Size(360, 760), resultOverrides(attemptId: 'p1', detail: _detail(_seven), pending: pending), textScale: 1.3);
      await tester.pump();
      await tester.pump();
      await _frames(tester, 3200);
      await settleImages(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/moment_settled_360_text130_$tag.png'));
      await tester.pump(const Duration(seconds: 4));
    });

    testWidgets('opened again from Your papers: the end state with when it was saved, 360 dp, $tag', (tester) async {
      await _pump(tester, b, const Size(360, 760), resultOverrides(attemptId: 'p1', detail: _detail(_seven)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      await settleImages(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/moment_reopened_360_$tag.png'));
      await tester.pump(const Duration(seconds: 4));
    });
  }

  // The frame sequence of a great set (the ring and the shards play), Night, 360 dp.
  // 20 Oct, K7: the sheet set down and stamped (0, 300), marked (700, 1100), the score landing with the ring and the
  // shards (1800) and circled (2400).
  for (final ms in [0, 300, 700, 1100, 1500, 1800, 2400]) {
    testWidgets('frame at $ms ms, a great set, 360 dp, night', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      await _pump(tester, Brightness.dark, const Size(360, 760), resultOverrides(attemptId: 'p1', detail: _detail(_great), pending: pending));
      await warmSheetStamp(tester);
      await tester.pump();
      await tester.pump();
      await _frames(tester, ms);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/moment_frame_${ms}ms_night.png'));
      await tester.pump(const Duration(seconds: 4));
    });
  }
}
