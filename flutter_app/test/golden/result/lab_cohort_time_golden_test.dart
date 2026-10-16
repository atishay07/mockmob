import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/result/full/answer_row.dart';
import 'package:mockmob/features/result/full/lab_ledger_section.dart';

import '../../helpers/fonts.dart';
import '../../unit/result/support/cohort_time_fixtures.dart';
import '../../unit/result/support/lab_fixtures.dart';

/// Mistake Lab slice 5 (cohort time) at 390 dp, Night and Day: the opened answer with and without
/// the time lines, and the ledger with and without the slow finding. The contracts are the website's
/// own output for its Full mock paper, every gate met and one short of every gate.
void main() {
  setUpAll(loadAppFonts);
  setUp(LabLedgerSection.debugResetSeen);

  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    for (final present in [true, false]) {
      final state = present ? 'lines' : 'absent';

      testWidgets('opened answer, time lines $state ($tag)', (tester) async {
        final others = (present ? timeLab() : gatedLab()).othersFor('q1')!;
        await pumpLabHost(
          tester,
          AnswerRow(item: q1Item(), expanded: true, onToggle: () {}, keysOff: false, onRepair: () {}, others: others, othersTitle: 'How others answered'),
          brightness: b,
          size: const Size(390, 760),
          reduced: true,
        );
        await tester.pumpAndSettle();
        await expectLater(find.byKey(labGoldenKey), matchesGoldenFile('goldens/cohort_time_answer_${state}_$tag.png'));
      });

      testWidgets('ledger, slow finding $state ($tag)', (tester) async {
        await pumpLabHost(
          tester,
          LabLedgerSection(attemptId: 'a7', lab: present ? timeLab() : gatedLab(), onOpenQuestion: (_) {}),
          brightness: b,
          size: const Size(390, 1900),
          reduced: true,
        );
        await tester.pumpAndSettle();
        await expectLater(find.byKey(labGoldenKey), matchesGoldenFile('goldens/cohort_time_ledger_${state}_$tag.png'));
      });
    }
  }
}
