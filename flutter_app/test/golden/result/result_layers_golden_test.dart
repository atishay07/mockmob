// The result of v15 (spec 3, the restore of N12) at the Night Sheet frame (384 by 853, DPR 2), Night and Day: a weak, an
// average, a strong and a repaired Accountancy full mock (50 questions, +5 / -1; every number adds up). Each paper is
// shot in four parts: the reveal with Mobi and the next move, the open analysis from the answer sheet, where the marks
// went, and the mistakes list. Each number on the screen comes from the paper, the repair order or the wallet.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart' show Attempt;
import 'package:mockmob/core/repositories/repair_local_repository.dart' show RepairLocalRecord, RepairLocalStatus;
import 'package:mockmob/features/credits/data/credit_figures.dart' show CreditFigures;
import 'package:mockmob/features/result/layers_copy.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakesHead;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/fixtures.dart';
import '../../unit/result/support/harness.dart';
import '../../unit/result/support/lab_fixtures.dart' show attemptWithLabAndSwot;

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

/// The website's ready lab contract with this paper's own repair order (the cohort lines are the ones the website's preview
/// fixture uses). The contract's ledger belongs to the spec paper (112 marks missed), so it is left out here: these papers
/// show the breakdown computed from their own rows, and every figure on the page adds up.
Map<String, dynamic> _lab({required List<(int, String)> order}) {
  final lab = jsonDecode(File('test/fixtures/mistake_lab/contract_ready_v1.json').readAsStringSync()) as Map<String, dynamic>;
  return {
    ...lab,
    'headline': null,
    'groups': <Object>[],
    'remark': null,
    'cohort': null,
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

Future<void> _open(WidgetTester tester, RecapData data, Brightness b, {List<RepairLocalRecord> repairs = const [], List<Attempt> attempts = const []}) async {
  await pumpResultRoute(
    tester,
    location: '/result/a7',
    brightness: b,
    overrides: resultOverrides(attemptId: 'a7', data: data, credits: _credits, repairRecords: repairs, reviewAttempts: attempts),
  );
  await settleImages(tester);
  await tester.pump();
  for (var t = 0; t < 1600; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
  await settleImages(tester);
}

/// Scrolls [target] to just under the bar and lets the page settle.
Future<void> _scrollTo(WidgetTester tester, Finder target) async {
  final ctx = tester.element(target.first);
  await Scrollable.ensureVisible(ctx, alignment: 0.02, duration: Duration.zero);
  for (var t = 0; t < 700; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
  await settleImages(tester);
}

/// The four parts of one paper.
Future<void> _parts(WidgetTester tester, String name, String tag) async {
  await _shot(tester, '${name}_$tag');
  await _scrollTo(tester, find.text(LayersCopy.analysis));
  await _shot(tester, '${name}_analysis_$tag');
  await _scrollTo(tester, find.text(LayersCopy.sectionMarksWent));
  await _shot(tester, '${name}_where_$tag');
  await _scrollTo(tester, find.byType(MistakesHead));
  await _shot(tester, '${name}_mistakes_$tag');
}

/// The rest of the open analysis (time, strengths and weaknesses, scores by session) on a paper that carries a device record,
/// the lab, the read of the paper and four earlier full mocks in the same format.
Future<void> _rest(WidgetTester tester, String tag) async {
  await _scrollTo(tester, find.text(LayersCopy.marksSplitTitle));
  await _shot(tester, 'layers_mock_full_split_$tag');
  await _scrollTo(tester, find.text(LayersCopy.sectionTime));
  await _shot(tester, 'layers_mock_full_time_$tag');
  await _scrollTo(tester, find.text(LayersCopy.sectionStrengths));
  await _shot(tester, 'layers_mock_full_strengths_$tag');
  await _scrollTo(tester, find.text(LayersCopy.sectionScores));
  await _shot(tester, 'layers_mock_full_scores_$tag');
}

RepairLocalRecord _repaired(String qid) =>
    RepairLocalRecord(attemptId: 'a7', questionId: qid, requestId: 'req-$qid-000000000000', status: RepairLocalStatus.explained, ackedAt: DateTime.utc(2026, 10, 12, 17, 38));

void main() {
  setUpAll(loadAppFonts);

  final avgLab = _lab(
    order: [(47, '18 of 22 other students got it right.'), (49, '21 of 26 other students got it right.'), (11, '16 of 21 other students got it right.')],
  );

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('weak full mock: a chapter set comes first ($tag)', (tester) async {
      await _open(tester, _paper(_weak), b);
      await _parts(tester, 'layers_mock_weak', tag);
    });

    testWidgets('average full mock: repair the one most others got right ($tag)', (tester) async {
      await _open(tester, _paper(_average, lab: avgLab), b);
      await _parts(tester, 'layers_mock_average', tag);
    });

    testWidgets('strong full mock: four repairs left ($tag)', (tester) async {
      await _open(
        tester,
        _paper(
          _strong,
          lab: _lab(
            order: [(39, '19 of 24 other students got it right.'), (20, '14 of 22 other students got it right.')],
          ),
        ),
        b,
      );
      await _parts(tester, 'layers_mock_strong', tag);
    });

    testWidgets('full analysis: time, strengths and weaknesses, scores by session ($tag)', (tester) async {
      final earlier = [
        attempt(id: 'e1', completedAt: DateTime.utc(2026, 9, 14, 15), paper: _weak),
        attempt(id: 'e2', completedAt: DateTime.utc(2026, 9, 28, 15), paper: _weak),
        attempt(id: 'e3', completedAt: DateTime.utc(2026, 10, 5, 15), paper: _average),
        attempt(id: 'e4', completedAt: DateTime.utc(2026, 10, 9, 15), paper: _average),
      ];
      // The spec paper the website's lab contract was written for: its ledger, time and read all describe this one paper.
      final d = detail(attemptBody: attemptWithLabAndSwot());
      final data = RecapData(model: mock7(withDetail: d, attempts: [...earlier, d.attempt]), attempt: d.attempt, detail: d, fetchedAt: DateTime(2026, 10, 12, 22, 44));
      await _open(tester, data, b, attempts: [...earlier, d.attempt]);
      await _rest(tester, tag);
    });

    testWidgets('repaired: two saved repairs open free and the rest are still to repair ($tag)', (tester) async {
      await _open(
        tester,
        _paper(_average, lab: avgLab),
        b,
        repairs: [_repaired('q47'), _repaired('q49')],
      );
      await _parts(tester, 'layers_mock_repaired', tag);
    });
  }
}
