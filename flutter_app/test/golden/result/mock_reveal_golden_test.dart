// The full mock and NTA reveal brought to the practice finish's standard (20 Oct, owner I13 and "it doesn't do the
// SWOT analysis"): the marks added up under the sheet as it inks (+5, -1, 0 a count), the total counted up and circled
// for every score, and the read of the paper on card 2. For a full mock and an NTA paper, each in four bands (good,
// middling, poor, all left blank): a frame sequence of card 1 from the open (Night), card 1 settled (Night and Day),
// and card 2 whole with the read (Night and Day).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/fixtures.dart';
import '../../unit/result/support/harness.dart';

const _chapters = [
  'Admission of a partner',
  'Goodwill: nature and valuation',
  'Retirement and death of a partner',
  'Partnership fundamentals',
  'Financial statement analysis',
];

/// A 50-question paper of [right], [wrong] and [blank] answers: chapter by chapter in turn, each chapter's share
/// given by [plan] (right, wrong, blank per chapter, in the order of [_chapters]).
List<(String, V)> _paper(List<(int, int, int)> plan) {
  final per = <List<(String, V)>>[
    for (var c = 0; c < plan.length; c++)
      [
        for (var i = 0; i < plan[c].$1; i++) (_chapters[c], V.right),
        for (var i = 0; i < plan[c].$2; i++) (_chapters[c], V.wrong),
        for (var i = 0; i < plan[c].$3; i++) (_chapters[c], V.blank),
      ],
  ];
  // Interleave so the sheet reads as a real paper.
  final out = <(String, V)>[];
  final most = per.map((p) => p.length).reduce((a, b) => a > b ? a : b);
  for (var i = 0; i < most; i++) {
    for (final p in per) {
      if (i < p.length) out.add(p[i]);
    }
  }
  return out;
}

/// The bands: the paper and the server's tone against the last comparable mock.
final Map<String, (List<(String, V)>, String?)> _bands = {
  // 42 right, 5 wrong, 3 blank: 205 of 250, higher than last time. Partnership fundamentals all right.
  'good': (_paper([(8, 2, 0), (9, 1, 0), (8, 1, 1), (10, 0, 0), (7, 1, 2)]), 'higher'),
  // The spec paper: 26 right, 15 wrong, 9 blank, 115 of 250.
  'middling': (specPaper(), null),
  // 10 right, 25 wrong, 15 blank: 25 of 250, lower than last time.
  'poor': (_paper([(2, 6, 2), (3, 4, 3), (1, 6, 3), (2, 5, 3), (2, 4, 4)]), 'lower'),
  // Every question left blank: 0 of 250.
  'blank': (_paper([(0, 0, 10), (0, 0, 10), (0, 0, 10), (0, 0, 10), (0, 0, 10)]), 'lower'),
};

({RecapModel model, AttemptDetail detail}) _mock(String mode, String band) {
  final (paper, tone) = _bands[band]!;
  final d = detail(
    attemptBody: attemptJson(mode: mode, paper: paper),
    recap: tone == null
        ? null
        : {
            'tone': tone,
            'previousComparable': {'marks': tone == 'higher' ? 150 : 120, 'max': 250, 'attemptId': 'p5'},
          },
  );
  return (model: mock7(withDetail: d), detail: d);
}

RecapData _data(RecapModel m, AttemptDetail d) =>
    RecapData(model: m, attempt: d.attempt, detail: d, fetchedAt: DateTime(2026, 10, 12, 22, 44));

Future<void> _frames(WidgetTester tester, int ms) async {
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

Future<void> _pump(WidgetTester tester, String mode, String band, int card, Brightness b, {Size size = const Size(384, 853)}) async {
  final x = _mock(mode, band);
  await pumpResultRoute(
    tester,
    location: '/result/a7/recap/$card',
    brightness: b,
    size: size,
    overrides: resultOverrides(attemptId: 'a7', data: _data(x.model, x.detail), ritual: const RecapRitual(sheetsOpened: 1)),
  );
  await tester.pump();
}

void main() {
  setUpAll(loadAppFonts);

  for (final mode in ['full', 'nta']) {
    for (final band in _bands.keys) {
      for (final ms in [0, 400, 900, 1300, 1700]) {
        testWidgets('$mode, $band, card 1 at $ms ms, night', (tester) async {
          await _pump(tester, mode, band, 1, Brightness.dark);
          await _frames(tester, ms);
          await expectLater(find.byKey(resultGoldenKey), matchesGoldenFile('goldens/reveal_${mode}_${band}_${ms}ms_night.png'));
          await _frames(tester, 3000);
        });
      }
      for (final b in [Brightness.dark, Brightness.light]) {
        final tag = b == Brightness.dark ? 'night' : 'day';
        testWidgets('$mode, $band, card 1 settled, $tag', (tester) async {
          await _pump(tester, mode, band, 1, b);
          await _frames(tester, 2800);
          await settleImages(tester);
          await expectLater(find.byKey(resultGoldenKey), matchesGoldenFile('goldens/reveal_${mode}_${band}_settled_$tag.png'));
        });
        testWidgets('$mode, $band, card 2 with the read, $tag', (tester) async {
          await _pump(tester, mode, band, 2, b, size: const Size(384, 1560));
          await _frames(tester, 4400);
          await settleImages(tester);
          await expectLater(find.byKey(resultGoldenKey), matchesGoldenFile('goldens/reveal_${mode}_${band}_read_$tag.png'));
        });
      }
    }
  }
}
