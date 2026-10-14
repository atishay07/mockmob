import 'package:flutter/semantics.dart' show SemanticsAction;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/nta/nta_status_strip.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// "Not saved yet. Tap to retry" in NTA mode must retry, as it does on the Night Sheet runner:
/// the only other ways to clear the syncer's stop are a pause (a warning strike) or a submit.
void main() {
  setUpAll(loadAppFonts);

  FakeRunnerSession session() => FakeRunnerSession(
    mode: 'nta',
    answers: {'q1': 0, 'q2': 1},
    visited: {'q1', 'q2'},
    unsynced: {'q2'},
    save: const SaveSnapshot(state: SaveState.notSaved, unsyncedAnswers: 1),
  );

  int retries(FakeRunnerSession s) => s.calls.where((c) => c == 'restored').length;

  testWidgets('a tap on the NTA save pill asks the server again', (tester) async {
    final s = session();
    await pumpRunner(tester, session: s);
    await settle(tester);

    final pill = find.textContaining(RunnerCopy.notSavedYet.substring(0, 12));
    expect(pill, findsOneWidget);
    await tester.tap(pill);
    expect(retries(s), 1);
  });

  testWidgets('the retry takes a 48 dp band while the strip stays 44 dp', (tester) async {
    final handle = tester.ensureSemantics();
    final s = session();
    await pumpRunner(tester, session: s);
    await settle(tester);

    final strip = tester.getRect(find.byType(NtaStatusStrip));
    expect(strip.height, NtaStatusStrip.height, reason: 'the strip keeps its height: nothing below moves');
    final x = tester.getCenter(find.textContaining(RunnerCopy.notSavedYet.substring(0, 12))).dx;
    await tester.tapAt(Offset(x, strip.top - 3));
    expect(retries(s), 1, reason: 'the band reaches into the bar margin above');

    final node = tester.getSemantics(find.bySemanticsLabel(RunnerCopy.notSavedYet));
    expect(node.rect.height, greaterThanOrEqualTo(48));
    expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
    handle.dispose();
  });
}
