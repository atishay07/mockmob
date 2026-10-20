// The finish of a practice, the mark sheet reveal (20 Oct, owner K7; earlier I13, G22, D108): the sheet is set down and
// stamped as saved, marked bubble by bubble while its tally and its score add up, and the score lands and is circled,
// for every practice type and band. The settled end at 360 dp, Night and Day, for each; frame sequences straight from
// the submit (fixed steps with tester.pump) for each; the whole moment on one tall page; and a skip, which lands the
// end state in 200 ms.
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

/// The result types, each a band.
final Map<String, (String, List<(String, V)>)> kinds = {
  // Quick practice of 5, good: 4 right, 1 wrong.
  'quick5_good': (
    'quick',
    [
      ('Admission of a partner', V.right),
      ('Admission of a partner', V.right),
      ('Goodwill', V.right),
      ('Admission of a partner', V.right),
      ('Goodwill', V.wrong),
    ],
  ),
  // By chapter, 8 questions, middling: one chapter, so no chapter list.
  'chapter8_mixed': (
    'chapter',
    [
      for (var i = 0; i < 4; i++) ('Goodwill', V.right),
      for (var i = 0; i < 3; i++) ('Goodwill', V.wrong),
      ('Goodwill', V.blank),
    ],
  ),
  // Quick 10, poor: 1 right, 6 wrong, 3 not attempted (-1 of 50); three chapters tied second on 12.
  'quick10_poor': (
    'quick',
    [
      ('Admission of a partner', V.right),
      ('Admission of a partner', V.wrong),
      ('Admission of a partner', V.wrong),
      ('Goodwill', V.wrong),
      ('Goodwill', V.wrong),
      ('Retirement of a partner', V.wrong),
      ('Retirement of a partner', V.wrong),
      ('Dissolution of a firm', V.blank),
      ('Dissolution of a firm', V.blank),
      ('Dissolution of a firm', V.blank),
    ],
  ),
  // Quick 10, all left blank: two chapters tied first.
  'quick10_blank': (
    'quick',
    [
      for (var i = 0; i < 5; i++) ('Goodwill', V.blank),
      for (var i = 0; i < 5; i++) ('Admission of a partner', V.blank),
    ],
  ),
  // Quick 10, middling: 6 right, 3 wrong, 1 not attempted (27 of 50).
  'quick10_mixed': (
    'quick',
    [
      ('Admission of a partner', V.right),
      ('Goodwill', V.right),
      ('Goodwill', V.wrong),
      ('Retirement of a partner', V.right),
      ('Admission of a partner', V.right),
      ('Goodwill', V.wrong),
      ('Retirement of a partner', V.right),
      ('Admission of a partner', V.wrong),
      ('Retirement of a partner', V.right),
      ('Goodwill', V.blank),
    ],
  ),
  // By chapter, 10, good: 9 right, 1 wrong.
  'chapter10_good': (
    'chapter',
    [
      for (var i = 0; i < 6; i++) ('Goodwill', V.right),
      ('Goodwill', V.wrong),
      for (var i = 0; i < 3; i++) ('Goodwill', V.right),
    ],
  ),
  // By chapter, 10, poor: 2 right, 6 wrong, 2 not attempted (4 of 50).
  'chapter10_poor': (
    'chapter',
    [
      ('Goodwill', V.wrong),
      ('Goodwill', V.right),
      for (var i = 0; i < 4; i++) ('Goodwill', V.wrong),
      ('Goodwill', V.right),
      ('Goodwill', V.wrong),
      ('Goodwill', V.blank),
      ('Goodwill', V.blank),
    ],
  ),
  // By chapter, 10, all left blank.
  'chapter10_blank': ('chapter', [for (var i = 0; i < 10; i++) ('Goodwill', V.blank)]),
  // Quick 20, great: 18 right, 2 wrong in two chapters (tied).
  'quick20_great': (
    'quick',
    [
      for (var i = 0; i < 9; i++) ('Admission of a partner', V.right),
      ('Goodwill', V.wrong),
      for (var i = 0; i < 9; i++) ('Goodwill', V.right),
      ('Admission of a partner', V.wrong),
    ],
  ),
};

AttemptDetail _detail(String mode, List<(String, V)> questions) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: mode, subject: 'accountancy', questions: questions),
  'answerReviews': <String, dynamic>{},
  'answerReviewState': 'ready',
});

Future<void> _pump(WidgetTester tester, Brightness b, String kind, {Size size = const Size(360, 760)}) {
  final (mode, qs) = kinds[kind]!;
  final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
  final List<Override> overrides = resultOverrides(attemptId: 'p1', detail: _detail(mode, qs), pending: pending);
  return pumpRouted(tester, location: '/practice/result/p1', routes: _routes(), brightness: b, size: size, overrides: overrides);
}

/// The frames of the sequence: the sheet set down (0), the stamp landing (300), the marking under way (700, 1100), the
/// score landing (1500), the circle and Mobi's turn (1900), the read rising (2400).
const List<int> kFrames = [0, 300, 700, 1100, 1500, 1900, 2400];

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

  for (final kind in kinds.keys) {
    for (final b in [Brightness.dark, Brightness.light]) {
      final tag = b == Brightness.dark ? 'night' : 'day';
      testWidgets('settled, $kind, 360 dp, $tag', (tester) async {
        await _pump(tester, b, kind);
        await tester.pump();
        await tester.pump();
        await _frames(tester, 5200);
        await settleImages(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/reveal_${kind}_settled_$tag.png'));
        await tester.pump(const Duration(seconds: 4));
      });
    }
  }

  for (final kind in kinds.keys) {
    for (final ms in kFrames) {
      testWidgets('frame at $ms ms, $kind, 360 dp, night', (tester) async {
        await _pump(tester, Brightness.dark, kind);
        await warmSheetStamp(tester);
        await tester.pump();
        await tester.pump();
        await _frames(tester, ms);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/reveal_${kind}_${ms}ms_night.png'));
        await tester.pump(const Duration(seconds: 6));
      });
    }
  }

  testWidgets('a skip at 600 ms lands the end state within 200 ms, quick10_poor, day', (tester) async {
    await _pump(tester, Brightness.light, 'quick10_poor');
    await warmSheetStamp(tester);
    await tester.pump();
    await tester.pump();
    await _frames(tester, 600);
    await tester.tapAt(const Offset(300, 200));
    await _frames(tester, 240);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/reveal_quick10_poor_skip_day.png'));
    await tester.pump(const Duration(seconds: 6));
  });

  // The whole moment on one tall page, to judge the chapters beat under the paper.
  for (final kind in kinds.keys) {
    for (final b in [Brightness.dark, Brightness.light]) {
      final tag = b == Brightness.dark ? 'night' : 'day';
      testWidgets('the whole moment, $kind, 360 by 1640, $tag', (tester) async {
        await _pump(tester, b, kind, size: const Size(360, 1640));
        await tester.pump();
        await tester.pump();
        await _frames(tester, 5200);
        await settleImages(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/reveal_${kind}_whole_$tag.png'));
        await tester.pump(const Duration(seconds: 4));
      });
    }
  }
}
