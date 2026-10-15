import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/full/lab_ledger_section.dart';
import 'package:mockmob/features/result/full/replay_section.dart';

import '../core/motion/motion_harness.dart' show RecordingHaptics;
import 'support/lab_fixtures.dart';

/// The Replay (Mistake Lab v4 slice 2, spec 4.5): the server's words at rest, a tap on a bar opening
/// its answer, a drag along a row scrubbing with a segment haptic at each question boundary, Play
/// over 15 seconds, Previous and Next under reduced motion, and the ledger's chips.
void main() {
  late List<int> opened;
  late RecordingHaptics haptics;

  setUp(() {
    opened = [];
    haptics = RecordingHaptics();
    LabLedgerSection.debugResetSeen();
  });

  Future<void> pump(WidgetTester tester, {String name = 'replay', bool reduced = false, ValueNotifier<String>? filter}) async {
    tester.view.physicalSize = const Size(360, 1200) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final lab = labOf(name);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
        child: MaterialApp(
          theme: buildTheme(Brightness.dark),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
          home: Scaffold(
            body: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: ReplaySection(replay: lab.replay!, onOpenQuestion: opened.add, numbersOf: lab.numbersOf, filter: filter),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  String clock(WidgetTester tester) => tester.widget<Text>(find.byKey(const ValueKey('replay-clock'))).data!;

  /// A point on row [row]'s strip at [sec] seconds of the paper.
  Offset at(WidgetTester tester, int row, num sec) {
    final rect = tester.getRect(find.byKey(ValueKey('replay-row-$row')));
    return Offset(rect.left + rect.width * ((sec - row * 600) / 600), rect.top + 22);
  }

  testWidgets('at rest: the end, every row in the server\'s words, the facts and the notes', (tester) async {
    await pump(tester);
    final replay = labOf('replay').replay!;
    expect(find.text('Replay'), findsOneWidget);
    expect(find.text('Your paper, minute by minute'), findsOneWidget);
    expect(clock(tester), '51:46');
    expect(find.text('Submitted at 51:46.'), findsOneWidget);
    for (final row in replay.rows) {
      expect(find.text(row.label), findsOneWidget);
    }
    for (final fact in replay.facts) {
      expect(find.text(fact), findsOneWidget);
    }
    expect(find.text(replay.labels.clockNote), findsOneWidget);
    expect(find.text(replay.labels.evenPaceNote), findsOneWidget);
    expect(find.text('Play'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^47 of 50 questions answered and 50 opened')), findsOneWidget);
  });

  testWidgets('tapping a bar opens that answer', (tester) async {
    await pump(tester);
    await tester.tapAt(at(tester, 0, 237)); // Q5, on screen from 2:42 to 5:12
    expect(opened, [5]);
    await tester.tapAt(at(tester, 1, 1010)); // Q17
    expect(opened, [5, 17]);
  });

  testWidgets('dragging along a row scrubs, with a segment haptic at each question boundary', (tester) async {
    await pump(tester);
    final start = at(tester, 1, 890);
    final end = at(tester, 1, 1060);
    final gesture = await tester.startGesture(start);
    for (var i = 1; i <= 20; i++) {
      await gesture.moveTo(Offset.lerp(start, end, i / 20)!);
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up();
    await tester.pump();
    // Q15 or Q16 at the start, then each question up to Q18: one tick a boundary.
    expect(haptics.count('selection'), greaterThanOrEqualTo(3));
    expect(clock(tester), isNot('51:46'));
    expect(find.text('Q18'), findsOneWidget, reason: 'the question on screen at that moment');
    expect(find.bySemanticsLabel(RegExp(r'^17 of 50 questions answered')), findsOneWidget);
    expect(opened, isEmpty, reason: 'a drag is not a tap');
  });

  testWidgets('Play runs the record in 15 seconds with the clock counting up, then rests', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Play'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 7500));
    expect(find.text('Pause'), findsOneWidget);
    final mid = clock(tester).split(':').map(int.parse).toList();
    final midSec = mid[0] * 60 + mid[1];
    expect(midSec, inInclusiveRange(1500, 1610), reason: 'half the record at half the time');
    await tester.pump(const Duration(milliseconds: 7600));
    await tester.pump();
    expect(clock(tester), '51:46');
    expect(find.text('Play'), findsOneWidget);
    expect(find.text('Submitted at 51:46.'), findsOneWidget);
  });

  testWidgets('Pause holds the moment, and Play carries on from it', (tester) async {
    await pump(tester);
    await tester.tap(find.text('Play'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    await tester.tap(find.text('Pause'));
    await tester.pump();
    final held = clock(tester);
    await tester.pump(const Duration(seconds: 2));
    expect(clock(tester), held);
    await tester.tap(find.text('Play'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(clock(tester), isNot(held));
    await tester.pumpAndSettle();
  });

  testWidgets('reduced motion: Previous and Next step one moment of the record', (tester) async {
    await pump(tester, reduced: true);
    expect(find.text('Play'), findsNothing);
    expect(find.text('Previous'), findsOneWidget);
    await tester.tap(find.text('Next'));
    await tester.pump();
    expect(clock(tester), '0:00');
    await tester.tap(find.text('Next'));
    await tester.pump();
    expect(clock(tester), '0:30', reason: 'the first pick');
    await tester.tap(find.text('Next'));
    await tester.pump();
    expect(clock(tester), '0:50', reason: 'Q2 opens');
    await tester.tap(find.text('Previous'));
    await tester.pump();
    expect(clock(tester), '0:30');
  });

  testWidgets('a chip lists its questions, a tap opens one, and the same chip turns it off', (tester) async {
    await pump(tester);
    expect(find.text('Q6'), findsNothing);
    await tester.ensureVisible(find.byKey(const ValueKey('replay-chip-struck_key')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('replay-chip-struck_key')));
    await tester.pumpAndSettle();
    expect(find.text('Q6'), findsOneWidget);
    expect(find.text('Q16'), findsOneWidget);
    await tester.tap(find.text('Q16'));
    expect(opened, [16]);
    await tester.tap(find.byKey(const ValueKey('replay-chip-struck_key')));
    await tester.pumpAndSettle();
    expect(find.text('Q6'), findsNothing);
  });

  testWidgets('a chip turned on from the ledger is on when the replay shows', (tester) async {
    final filter = ValueNotifier<String>('long_stay');
    addTearDown(filter.dispose);
    await pump(tester, filter: filter);
    for (final n in [5, 12, 28]) {
      expect(find.text('Q$n'), findsOneWidget);
    }
    filter.value = 'quick_wrong';
    await tester.pumpAndSettle();
    for (final n in [3, 19, 33]) {
      expect(find.text('Q$n'), findsOneWidget);
    }
  });

  testWidgets('each visit is a button for a screen reader, in words, and opens its answer', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    expect(find.semantics.byLabel('Question 5, wrong, on screen from 2:42 to 5:12. Open the answer.'), findsOne);
    expect(find.semantics.byLabel('Question 10, right, on screen from 8:17 to 10:00. Away 1m 10s. Open the answer.'), findsOne);
    expect(find.semantics.byLabel('Question 28, left blank, on screen from 24:49 to 26:54. Open the answer.'), findsOne);
    tester.semantics.tap(find.semantics.byLabel('Question 28, left blank, on screen from 24:49 to 26:54. Open the answer.'));
    expect(opened, [28]);
    handle.dispose();
  });

  testWidgets('the ledger sends a row to the replay only where the replay has its chip', (tester) async {
    final sent = <String>[];
    tester.view.physicalSize = const Size(360, 1600) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await pumpLabHost(
      tester,
      LabLedgerSection(attemptId: 'r1', lab: labOf('replay'), onOpenQuestion: (_) {}, onSeeInReplay: sent.add),
      size: const Size(360, 1600),
    );
    await tester.pumpAndSettle();
    // The headline's group (under 20 seconds) starts open, with its link.
    expect(find.text('See it in the replay'), findsOneWidget);
    await tester.tap(find.text('See it in the replay'));
    expect(sent, ['quick_wrong']);
    await tester.tap(find.text('Other wrong answers'));
    await tester.pumpAndSettle();
    expect(find.text('See it in the replay'), findsOneWidget, reason: 'other wrong answers have no chip');
    await tester.tap(find.text('Crossed out the key'));
    await tester.pumpAndSettle();
    expect(find.text('See it in the replay'), findsNWidgets(2));
  });
}
