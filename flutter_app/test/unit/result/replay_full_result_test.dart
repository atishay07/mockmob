import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/full/lab_ledger_section.dart' show LabLedgerSection;
import 'package:mockmob/features/result/full/replay_section.dart';
import 'package:mockmob/features/result/model/time_decisions.dart' show TimeCopy;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';
import 'support/lab_fixtures.dart' show labContract;

/// The page's own scroll (the Replay's chips scroll sideways inside it).
Finder get _page => find.byType(Scrollable).first;

/// Slice 2 on the full result: the Replay is the Lab's Find step, under the ledger and above Time
/// and decisions; a ledger row's "See it in the replay" lands on it with that chip on; and the time
/// lines in every answer are the server's own, so the web and the app say the same words.
void main() {
  setUpAll(loadAppFonts);
  setUp(LabLedgerSection.debugResetSeen);

  Future<void> pump(WidgetTester tester, {Map<String, dynamic>? lab, String location = '/result/a7'}) async {
    final d = detail(attemptBody: {...attemptJson(), 'lab': ?lab});
    await pumpResultRoute(
      tester,
      location: location,
      overrides: resultOverrides(attemptId: 'a7', data: RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d), log: ResultLog()),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
  }

  testWidgets('order: the ledger, the Replay, then Time and decisions from the server', (tester) async {
    await pump(tester, lab: labContract('replay'));
    expect(find.byType(ReplaySection), findsOneWidget);
    double top(Finder f) => tester.getTopLeft(f.first).dy;
    expect(top(find.text('Mistake Lab')) < top(find.text('Replay')), isTrue);
    expect(top(find.text('Replay')) < top(find.text(TimeCopy.title)), isTrue);
    // Time and decisions reads the server's sentences.
    final summary = (labContract('replay')['time'] as Map)['summary'] as Map;
    await tester.scrollUntilVisible(find.text(summary['split'] as String), 300, scrollable: _page);
    expect(find.text(summary['split'] as String), findsOneWidget);
  });

  testWidgets('"See it in the replay" lands on the Replay with that chip on', (tester) async {
    await pump(tester, lab: labContract('replay'));
    // The headline's group (under 20 seconds) starts open.
    await tester.scrollUntilVisible(find.text('See it in the replay'), 200, scrollable: _page);
    await tester.tap(find.text('See it in the replay'));
    await tester.pumpAndSettle();
    final replayTop = tester.getTopLeft(find.text('Replay')).dy;
    expect(replayTop >= 0 && replayTop < 200, isTrue, reason: 'the Replay is near the top: $replayTop');
    // The chip's questions are listed under the grid.
    for (final n in [3, 19, 33]) {
      expect(find.descendant(of: find.byType(ReplaySection), matching: find.text('Q$n')), findsOneWidget);
    }
  });

  testWidgets('an opened answer shows the server\'s time and picks, with the trace lines', (tester) async {
    await pump(tester, lab: labContract('replay'), location: '/result/a7?q=22');
    final lines = ((labContract('replay')['time'] as Map)['rows'] as List).firstWhere((r) => r['qid'] == 'q22')['lines'] as List;
    for (final line in lines.cast<String>()) {
      // In the opened answer (a change also reads in Time and decisions' list).
      final inRow = find.descendant(of: find.byType(AnswerRow), matching: find.text(line));
      await tester.scrollUntilVisible(inRow, 200, scrollable: _page);
      expect(inRow, findsOneWidget);
    }
    expect(lines.first, contains('until you submitted at 51:46'));
  });

  testWidgets('a lab without a replay (an older server) shows no Replay and keeps the app\'s own time read', (tester) async {
    await pump(tester, lab: labContract('ready'));
    expect(find.byType(ReplaySection), findsNothing);
    expect(find.text('See it in the replay'), findsNothing);
    expect(MistakeLab.tryParse(labContract('ready'))!.replay, isNull);
  });
}
