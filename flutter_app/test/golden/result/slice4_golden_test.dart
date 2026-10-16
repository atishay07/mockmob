import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/rules/widgets/same_mistakes_later_view.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/fixtures.dart';
import '../../unit/result/support/harness.dart';
import '../../unit/result/support/lab_fixtures.dart';

Map<String, dynamic> _contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

Future<void> _shot(WidgetTester tester, Finder boundary, String name) async {
  await expectLater(boundary, matchesGoldenFile('goldens/$name.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final render = tester.renderObject<RenderRepaintBoundary>(boundary);
  await tester.runAsync(() async {
    final image = await render.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

TrapTag _tag(String qid, {String letter = 'B', int index = 1}) =>
    TrapTag.tryParse('q17', {...(((_contract('traps')['paper'] as Map)['tags'] as Map)[qid] as Map<String, dynamic>), 'index': index, 'letter': letter})!;

/// Mistake Lab v4 slice 4 at 360 dp, Night and Day: the trap tag under the student's wrong option
/// (a format trap with its sentence, and one Mistake Repair named), Same mistakes later in Prove,
/// and recap card 4 when the repair order leads to another question.
void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('the trap tag, a format trap, with the others\' counts ($tag)', (tester) async {
      final others = labOf('ready').othersFor('q17');
      await pumpLabHost(
        tester,
        AnswerRow(
          item: q17Item(),
          expanded: true,
          onToggle: () {},
          keysOff: false,
          onRepair: () {},
          others: others,
          othersTitle: 'How others answered',
          trap: _tag('p1-q2'),
        ),
        brightness: b,
        size: const Size(360, 980),
        reduced: true,
      );
      await tester.pumpAndSettle();
      await _shot(tester, find.byKey(labGoldenKey), 'trap_tag_format_$tag');
    });

    testWidgets('the trap tag Mistake Repair named, no counts ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        AnswerRow(item: q17Item(), expanded: true, onToggle: () {}, keysOff: false, trap: _tag('p1-q1')),
        brightness: b,
        size: const Size(360, 800),
        reduced: true,
      );
      await tester.pumpAndSettle();
      await _shot(tester, find.byKey(labGoldenKey), 'trap_tag_repair_$tag');
    });

    testWidgets('Same mistakes later, tomorrow and ready now ($tag)', (tester) async {
      await pumpLabHost(
        tester,
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SameMistakesLaterView(later: SameMistakesLater.tryParse(_contract('later')['prove'])!, onOpen: () {}),
            const SizedBox(height: 32),
            SameMistakesLaterView(later: SameMistakesLater.tryParse(_contract('later')['proveWithCards'])!, onOpen: () {}),
          ],
        ),
        brightness: b,
        size: const Size(360, 780),
        reduced: true,
      );
      await tester.pumpAndSettle();
      await _shot(tester, find.byKey(labGoldenKey), 'same_mistakes_later_$tag');
    });

    testWidgets('card 4 when the repair order leads to question 11 ($tag)', (tester) async {
      final base = mock7();
      final c = base.candidates.firstWhere((x) => x.questionId == 'q11');
      final order = {
        'version': 1,
        'state': 'cohort',
        'items': [
          {'qid': c.questionId, 'number': c.number, 'reason': 'most_right', 'key': 'Repair Q${c.number} first', 'line': '26 of 31 other students got it right.'},
          for (final o in base.candidates)
            if (o.questionId != c.questionId) {'qid': o.questionId, 'number': o.number, 'reason': 'paper', 'key': null, 'line': null},
        ],
      };
      final d = detail(attemptBody: {...attemptJson(), 'lab': {...labContract('ready'), 'repairOrder': order}});
      final m = mock7(withDetail: d);
      await pumpResultRoute(
        tester,
        location: '/result/a7/recap/4',
        brightness: b,
        overrides: resultOverrides(
          attemptId: m.attemptId,
          data: RecapData(model: m, attempt: d.attempt, detail: d, fetchedAt: DateTime(2026, 10, 12, 22, 44)),
          ritual: const RecapRitual(sheetsOpened: 1),
        ),
      );
      await settleImages(tester);
      for (var i = 0; i < 150; i++) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      await _shot(tester, find.byKey(resultGoldenKey), 'card4_cohort_lead_$tag');
    });
  }
}
