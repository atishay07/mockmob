// The result in four layers (RESULT-1017, packet A1) at the Night Sheet frame (384 by 853, DPR 2), Night and Day: a
// weak, an average and a strong Accountancy full mock (50 questions, +5 / -1; every number adds up), the average one
// scrolled to its mistakes and folds, and a practice set. Each number on the screen comes from the paper, the repair
// order or the wallet.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/credits/data/credit_figures.dart' show CreditFigures;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakesHead;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/fixtures.dart';
import '../../unit/result/support/harness.dart';

const _credits = CreditFigures(ai: 68, practice: 40);

List<(String, V)> _chapter(String name, {int right = 0, int wrong = 0, int blank = 0}) => [
  for (var i = 0; i < right; i++) (name, V.right),
  for (var i = 0; i < wrong; i++) (name, V.wrong),
  for (var i = 0; i < blank; i++) (name, V.blank),
];

/// 8 right, 22 wrong, 20 blank: 18 of 250. Share Capital cost 51 (1 right of 10).
final _weak = [
  ..._chapter('Partnership Fundamentals', right: 2, wrong: 4, blank: 4),
  ..._chapter('Goodwill', right: 2, wrong: 4, blank: 4),
  ..._chapter('Accounting Ratios', right: 2, wrong: 4, blank: 4),
  ..._chapter('Cash Flow Statement', right: 1, wrong: 4, blank: 5),
  ..._chapter('Share Capital', right: 1, wrong: 6, blank: 3),
];

/// 28 right, 12 wrong, 10 blank: 128 of 250. Share Capital (Q45 to Q50) cost 29.
final _average = [
  ..._chapter('Partnership Fundamentals', right: 9, wrong: 2, blank: 1),
  ..._chapter('Goodwill', right: 6, wrong: 2, blank: 2),
  ..._chapter('Accounting Ratios', right: 7, wrong: 2, blank: 3),
  ..._chapter('Cash Flow Statement', right: 5, wrong: 2, blank: 3),
  ('Share Capital', V.right),
  ('Share Capital', V.wrong),
  ('Share Capital', V.wrong),
  ('Share Capital', V.blank),
  ('Share Capital', V.wrong),
  ('Share Capital', V.wrong),
];

/// 44 right, 4 wrong, 2 blank: 216 of 250. Accounting Ratios (Q31 to Q40, wrong on Q39 and Q40) cost 12.
final _strong = [
  ..._chapter('Partnership Fundamentals', right: 10),
  ..._chapter('Share Capital', right: 9, wrong: 1),
  ..._chapter('Goodwill', right: 9, wrong: 1),
  ..._chapter('Accounting Ratios', right: 8, wrong: 2),
  ..._chapter('Cash Flow Statement', right: 8, blank: 2),
];

/// The website's ready lab contract with this paper's own headline and repair order (the cohort lines are the ones
/// the website's preview fixture uses).
Map<String, dynamic> _lab({required String headline, required List<(int, String)> order}) {
  final lab = jsonDecode(File('test/fixtures/mistake_lab/contract_ready_v1.json').readAsStringSync()) as Map<String, dynamic>;
  return {
    ...lab,
    'headline': {'group': (lab['headline'] as Map)['group'], 'text': headline},
    'byQuestion': <String, dynamic>{},
    'repairOrder': {
      'version': 1,
      'state': 'cohort',
      'items': [
        for (final (n, line) in order) {'qid': 'q$n', 'number': n, 'reason': 'most_right', 'key': 'Repair Q$n first', 'line': line},
      ],
    },
  };
}

RecapData _paper(List<(String, V)> paper, {Map<String, dynamic>? lab}) {
  final d = detail(attemptBody: {...attemptJson(paper: paper), 'lab': ?lab});
  return RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d, fetchedAt: DateTime(2026, 10, 12, 22, 44));
}

Future<void> _shot(WidgetTester tester, String name) async {
  await expectLater(find.byKey(resultGoldenKey), matchesGoldenFile('goldens/$name.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(resultGoldenKey));
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

Future<void> _open(WidgetTester tester, RecapData data, Brightness b) async {
  await pumpResultRoute(
    tester,
    location: '/result/a7',
    brightness: b,
    overrides: resultOverrides(attemptId: 'a7', data: data, credits: _credits),
  );
  await settleImages(tester);
  await tester.pump();
  for (var t = 0; t < 1600; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
  await settleImages(tester);
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('weak full mock: a chapter set comes first ($tag)', (tester) async {
      await _open(tester, _paper(_weak), b);
      await _shot(tester, 'layers_mock_weak_$tag');
    });

    testWidgets('average full mock: repair the one most others got right ($tag)', (tester) async {
      await _open(
        tester,
        _paper(
          _average,
          lab: _lab(
            headline: 'Share Capital and Accounting Ratios cost 56 of the 122 marks you missed.',
            order: [(47, '18 of 22 other students got it right.'), (49, '21 of 26 other students got it right.'), (11, '16 of 21 other students got it right.')],
          ),
        ),
        b,
      );
      await _shot(tester, 'layers_mock_average_$tag');
    });

    testWidgets('average full mock, scrolled to the mistakes and the folds ($tag)', (tester) async {
      await _open(
        tester,
        _paper(
          _average,
          lab: _lab(
            headline: 'Share Capital and Accounting Ratios cost 56 of the 122 marks you missed.',
            order: [(47, '18 of 22 other students got it right.'), (49, '21 of 26 other students got it right.'), (11, '16 of 21 other students got it right.')],
          ),
        ),
        b,
      );
      await tester.scrollUntilVisible(find.byType(MistakesHead), 200, scrollable: find.byType(Scrollable).first);
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -40));
      for (var t = 0; t < 800; t += 16) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      await _shot(tester, 'layers_mock_average_list_$tag');
    });

    testWidgets('strong full mock: four repairs left ($tag)', (tester) async {
      await _open(
        tester,
        _paper(
          _strong,
          lab: _lab(
            headline: '4 wrong answers cost 24 of the 34 marks you missed.',
            order: [(39, '19 of 24 other students got it right.'), (20, '14 of 22 other students got it right.')],
          ),
        ),
        b,
      );
      await _shot(tester, 'layers_mock_strong_$tag');
    });
  }
}
