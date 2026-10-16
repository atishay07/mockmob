import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/models/mistake_lab_traps.dart' show ReviseAnswer;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/insights/screens/saved_screen.dart';
import 'package:mockmob/features/learn/widgets/feedback_mobi.dart';
import 'package:mockmob/features/review/revise/revise_screen.dart';
import 'package:mockmob/features/review/revise/revise_data.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../insights/support/insights_fixtures.dart' show question;
import '../review/revise_test.dart' show FakeReviseApi, answerBody, keyLabelled, settle;

/// Every living Mobi that is laid out and on screen (a full character or a head; a character's
/// own parts are not counted twice).
List<MobiCharacter> visibleMobis(WidgetTester tester) {
  final screen = Offset.zero & tester.view.physicalSize / tester.view.devicePixelRatio;
  final out = <MobiCharacter>[];
  for (final e in find.byType(MobiCharacter).evaluate()) {
    final box = e.renderObject;
    if (box is! RenderBox || !box.attached || !box.hasSize) continue;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    if (rect.overlaps(screen)) out.add(e.widget as MobiCharacter);
  }
  return out;
}

/// The Save controller with a way for the test to land a server answer.
class _LiveSave extends SaveController {
  @override
  SaveMarks build() => const SaveMarks();

  void land(SaveMarks marks) => state = marks;
}

SavedList _list() => SavedList(
      ids: const ['q1', 'q2'],
      questions: [question('q1', saved: true), question('q2', saved: true, subject: 'economics', chapter: 'Money and banking')],
      count: 2,
    );

void main() {
  setUpAll(loadAppFonts);
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  group('Saved: Mobi only at the real moment', () {
    late _LiveSave save;

    Future<void> open(WidgetTester tester) async {
      save = _LiveSave();
      await pumpMockmob(
        tester,
        const SavedScreen(),
        brightness: Brightness.dark,
        size: kInsightsSize,
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: [
          ...insightsOverrides(saved: RemoteState(value: _list())).where((o) => !identical(o.origin, saveControllerProvider)),
          saveControllerProvider.overrideWith(() => save),
        ],
      );
    }

    testWidgets('the list opens with no Mobi parked beside the meter', (tester) async {
      await open(tester);
      expect(find.text('Saved questions'), findsWidgets);
      expect(visibleMobis(tester), isEmpty);
      expect(find.byKey(SavedBody.mobiKey), findsNothing);
    });

    testWidgets('a save the server confirmed brings him in once, nodding, and he is the only one', (tester) async {
      await open(tester);
      save.land(const SaveMarks(acked: {'q3': true}));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      final mobis = visibleMobis(tester);
      expect(mobis, hasLength(1));
      expect(mobis.single.key, SavedBody.mobiKey);
      expect(mobis.single.entrance, MobiMoments.act(MobiEvent.saveConfirmed));
      // A second confirmed save does not bring a second Mobi.
      save.land(const SaveMarks(acked: {'q3': true, 'q4': true}));
      await tester.pump(const Duration(milliseconds: 300));
      expect(visibleMobis(tester), hasLength(1));
    });

    testWidgets('a removal the server confirmed is not a moment for him', (tester) async {
      await open(tester);
      save.land(const SaveMarks(acked: {'q1': false}));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byKey(SavedBody.mobiKey), findsNothing);
    });

    testWidgets('the slot is kept, so the meter does not move when he arrives', (tester) async {
      await open(tester);
      final meter = find.textContaining('free slots used');
      expect(meter, findsOneWidget);
      final before = tester.getRect(meter);
      save.land(const SaveMarks(acked: {'q3': true}));
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.getRect(meter), before);
    });
  });

  group('the record shows Mobi once', () {
    testWidgets('one Mobi on the whole record page, Night and Day', (tester) async {
      for (final b in [Brightness.dark, Brightness.light]) {
        await pumpMockmob(
          tester,
          const InsightsScreen(),
          brightness: b,
          size: const Size(384, 3300),
          disableAnimations: true,
          wrapInScaffold: false,
          overrides: insightsOverrides(pro: true),
        );
        expect(visibleMobis(tester), hasLength(1), reason: '$b');
        await tester.pumpWidget(const SizedBox());
      }
    });
  });

  group('Revise: the graded recall and the end of a run', () {
    test('the act for a finished run follows what the server graded', () {
      expect(ReviseEnd.actFor(right: 4, wrong: 0), MobiAct.cheer);
      expect(ReviseEnd.actFor(right: 3, wrong: 1), MobiAct.correct);
      expect(ReviseEnd.actFor(right: 1, wrong: 1), MobiAct.correct);
      expect(ReviseEnd.actFor(right: 1, wrong: 3), MobiAct.encourage);
      expect(ReviseEnd.actFor(right: 0, wrong: 2), MobiAct.encourage);
    });

    Future<void> pumpEnd(WidgetTester tester, {required int right, required int wrong, MobiCelebrationLevel level = MobiCelebrationLevel.full}) async {
      await pumpMockmob(
        tester,
        MobiCelebrations(
          level: level,
          child: SingleChildScrollView(child: ReviseEnd(line: '$right recalled', next: null, right: right, wrong: wrong)),
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
    }

    testWidgets('Full: one Mobi, cheering a run where every recall held', (tester) async {
      await pumpEnd(tester, right: 4, wrong: 0);
      final mobis = visibleMobis(tester);
      expect(mobis, hasLength(1));
      expect(mobis.single.entrance, MobiAct.cheer);
      expect(mobis.single.size, ReviseEnd.mobiSize);
    });

    testWidgets('Full: the "come on" lean when more came back than held', (tester) async {
      await pumpEnd(tester, right: 1, wrong: 3);
      expect(visibleMobis(tester).single.entrance, MobiAct.encourage);
    });

    testWidgets('Quiet seats him instead of the cheer', (tester) async {
      await pumpEnd(tester, right: 4, wrong: 0, level: MobiCelebrationLevel.quiet);
      expect(visibleMobis(tester).single.entrance, MobiAct.rest);
    });

    testWidgets('Off keeps the words and the plain check ring, no Mobi', (tester) async {
      await pumpEnd(tester, right: 4, wrong: 0, level: MobiCelebrationLevel.off);
      expect(visibleMobis(tester), isEmpty);
      expect(find.text('4 recalled'), findsOneWidget);
    });

    Future<FakeReviseApi> pumpRun(WidgetTester tester, {MobiCelebrationLevel level = MobiCelebrationLevel.full, double textScale = 1}) async {
      final api = FakeReviseApi();
      await pumpMockmob(
        tester,
        MobiCelebrations(level: level, child: const ReviseScreen()),
        brightness: Brightness.dark,
        size: const Size(390, 1800),
        disableAnimations: true,
        textScale: textScale,
        wrapInScaffold: false,
        overrides: [
          reviseApiProvider.overrideWithValue(api),
          revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        ],
      );
      await settle(tester);
      return api;
    }

    testWidgets('before an answer there is no Mobi on Revise', (tester) async {
      await pumpRun(tester);
      expect(visibleMobis(tester), isEmpty);
    });

    for (final (which, right, act) in [('right', true, MobiAct.correct), ('wrong', false, MobiAct.encourage)]) {
      testWidgets('a $which recall the server graded gets one Mobi, ${act.name}', (tester) async {
        final api = await pumpRun(tester);
        api.queue.add(ReviseAnswer.tryParse(answerBody(which, correct: right))!);
        await tester.tap(find.text('B. Illustrative option 5b'));
        await settle(tester);
        final mobis = visibleMobis(tester);
        expect(mobis, hasLength(1));
        expect(mobis.single.entrance, act);
        expect(find.byType(FeedbackMobi), findsOneWidget);
      });
    }

    testWidgets('Quiet and Off keep the line and drop the per-answer Mobi', (tester) async {
      for (final mode in [MobiCelebrationLevel.quiet, MobiCelebrationLevel.off]) {
        MobiRation.reset();
        final api = await pumpRun(tester, level: mode);
        api.queue.add(ReviseAnswer.tryParse(answerBody('right'))!);
        await tester.tap(find.text('B. Illustrative option 5b'));
        await settle(tester);
        expect(visibleMobis(tester), isEmpty, reason: '$mode');
        expect(keyLabelled('Next question'), findsOneWidget, reason: '$mode');
        await tester.pumpWidget(const SizedBox());
      }
    });
  });
}
