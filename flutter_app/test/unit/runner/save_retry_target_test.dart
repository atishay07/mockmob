import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/runner_meta_row.dart';
import 'package:mockmob/features/runner/widgets/timing_track.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// "Not saved yet. Tap to retry" sits on the 32 dp meta line. It must take a 48 dp finger
/// (review round 3, pkg-04 #3) without growing the line, so nothing under it moves.
void main() {
  setUpAll(loadAppFonts);

  FakeRunnerSession session() => FakeRunnerSession(
    questions: accountancyQuestions(10),
    mode: 'quick',
    mockNumber: null,
    chapter: 'Goodwill',
    currentIndex: 5,
    answers: {for (var i = 1; i <= 5; i++) 'q$i': i % 4},
    visited: {for (var i = 1; i <= 6; i++) 'q$i'},
    unsynced: {'q4', 'q5'},
    save: const SaveSnapshot(state: SaveState.notSaved, unsyncedAnswers: 2),
  );

  int retries(FakeRunnerSession s) => s.calls.where((c) => c == 'restored').length;

  testWidgets('the retry takes taps from a 48 dp band while the line stays 32 dp', (tester) async {
    final s = session();
    await pumpRunner(tester, session: s);
    await settle(tester);

    final line = tester.getRect(find.byType(RunnerMetaRow));
    expect(line.height, RunnerMetaRow.height, reason: 'the line keeps its height: nothing below moves');
    final x = tester.getCenter(find.text(RunnerCopy.notSavedYet)).dx;

    await tester.tapAt(Offset(x, line.center.dy));
    await tester.tapAt(Offset(x, line.top - 7));
    await tester.tapAt(Offset(x, line.bottom + 7));
    expect(retries(s), 3);

    // Outside the band the tap is not the retry's.
    await tester.tapAt(Offset(x, line.bottom + 12));
    expect(retries(s), 3);
  });

  testWidgets('the track below keeps its cells: a tap on a bubble in the band jumps', (tester) async {
    final s = session();
    await pumpRunner(tester, session: s);
    await settle(tester);

    final line = tester.getRect(find.byType(RunnerMetaRow));
    final track = tester.getRect(find.byType(TimingTrack));
    expect(track.top, closeTo(line.bottom, 0.5));
    // The first bubble's centre is 5 dp in from the strip's start.
    await tester.tapAt(Offset(track.left + TrackGeometry.bubble / 2, line.bottom + 6));
    await settle(tester);
    expect(s.calls, contains('goTo 0'));
    expect(retries(s), 0);
  });

  testWidgets('the retry meets the tap target guidelines with a 48 dp node', (tester) async {
    final handle = tester.ensureSemantics();
    final s = session();
    await pumpRunner(tester, session: s);
    await settle(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    final node = tester.getSemantics(find.bySemanticsLabel(RunnerCopy.notSavedYet));
    expect(node.rect.height, greaterThanOrEqualTo(48));
    handle.dispose();
  });
}
