// D17 (owner, 18 Oct dawn): the replay is sized to the paper, it can be read on one line or row by row, and a record with
// too few answers to say anything ("only grey boxes going and going") is left out.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/full/replay_section.dart';

import '../core/motion/motion_harness.dart' show RecordingHaptics;
import 'support/lab_fixtures.dart';

void main() {
  Future<void> pump(WidgetTester tester, LabReplay replay) async {
    tester.view.physicalSize = const Size(360, 1400) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: RecordingHaptics()))],
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: Scaffold(
            body: SingleChildScrollView(
              child: Padding(padding: const EdgeInsets.all(16), child: ReplaySection(replay: replay, onOpenQuestion: (_) {})),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('the lines', () {
    test('a record within one row is fitted to the width: a 58 s paper fills the line, not its first tenth', () {
      final lines = ReplayLine.of(shortReplay());
      expect(lines, hasLength(1));
      expect(lines.single.span, 58);
    });

    test('a longer record is the server\'s rows, or the whole paper on one line under the last row\'s words', () {
      final replay = labOf('replay').replay!;
      final rows = ReplayLine.of(replay);
      expect(rows, hasLength(replay.rows.length));
      expect(rows.every((l) => l.span == replay.rowSec), isTrue);
      final one = ReplayLine.of(replay, oneLine: true);
      expect(one, hasLength(1));
      expect(one.single.span, greaterThanOrEqualTo(replay.recordSec));
      expect(one.single.row.bars, hasLength(replay.bars.length), reason: 'every visit is on the one line');
      expect(one.single.row.label, replay.rows.last.label);
    });

    test('a record with fewer than three answers is not worth replaying; one with answers is', () {
      expect(ReplaySection.worthShowing(shortReplay(answered: 0)), isFalse);
      expect(ReplaySection.worthShowing(shortReplay(answered: 2)), isFalse);
      expect(ReplaySection.worthShowing(shortReplay(answered: 3)), isTrue);
      expect(ReplaySection.worthShowing(labOf('replay').replay!), isTrue);
    });
  });

  testWidgets('a long paper reads row by row and folds to one line, and back, with one toggle', (tester) async {
    final replay = labOf('replay').replay!;
    await pump(tester, replay);
    expect(find.byKey(ValueKey('replay-row-${replay.rows.length - 1}')), findsOneWidget);
    await tester.tap(find.text(ResultCopy.replayOneLine));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('replay-row-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('replay-row-1')), findsNothing);
    expect(find.text(replay.rows.last.label), findsOneWidget);
    await tester.tap(find.text(ResultCopy.replayByRows(10)));
    await tester.pumpAndSettle();
    expect(find.byKey(ValueKey('replay-row-${replay.rows.length - 1}')), findsOneWidget);
  });

  testWidgets('a short paper has one fitted line and no toggle', (tester) async {
    await pump(tester, shortReplay());
    expect(find.byKey(const ValueKey('replay-row-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('replay-lines-toggle')), findsNothing);
  });
}
