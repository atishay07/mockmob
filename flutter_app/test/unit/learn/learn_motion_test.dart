import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/study.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/models/run_item.dart';
import 'package:mockmob/features/learn/screens/run_done_screen.dart';
import 'package:mockmob/features/learn/widgets/card_stack.dart';
import 'package:mockmob/features/learn/widgets/due_card.dart';
import 'package:mockmob/features/learn/widgets/lesson_list.dart';
import 'package:mockmob/features/learn/widgets/lesson_ring.dart';
import 'package:mockmob/features/learn/widgets/offline_packs.dart';

import '../../helpers/golden_harness.dart';

LearnUnit _unit(String id, StudyUnitStatus status, {int? step, int? steps, int due = 0}) => LearnUnit(
      id: id,
      title: 'Lesson $id',
      status: status,
      subject: 'accountancy',
      step: step,
      steps: steps,
      dueCards: due,
    );

List<ReviewedCard> _rated(List<int> ratings) => [for (final r in ratings) ReviewedCard(title: 'Card $r', rating: r)];

LessonRingPainter _ring(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.descendant(of: find.byType(LessonStateRing), matching: find.byType(CustomPaint))).map((p) => p.painter).whereType<LessonRingPainter>().first;

StackPainter _stack(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.descendant(of: find.byType(CardStackMark), matching: find.byType(CustomPaint))).map((p) => p.painter).whereType<StackPainter>().first;

void main() {
  group('how a finished run went', () {
    test('five or more cards that all stuck is a celebration', () {
      expect(runMood(_rated([3, 4, 3, 4, 4])), RunMood.celebrate);
      expect(runMood(_rated([3, 4, 3, 4])), RunMood.cheer, reason: 'four cards is not enough to make a fuss');
    });

    test('a good run with a few misses is a cheer; a third or more Forgot or Hard is a warm nod', () {
      expect(runMood(_rated([3, 4, 3, 4, 3, 2])), RunMood.cheer);
      expect(runMood(_rated([3, 1, 2, 4, 3])), RunMood.encourage);
    });

    test('one card kept stuck; one card missed is a nod, never a line', () {
      expect(runMood(_rated([4])), RunMood.stuck);
      expect(runMood(_rated([3])), RunMood.stuck);
      expect(runMood(_rated([1])), RunMood.encourage);
    });

    test('a run with no ratings (a lesson) is the plain cheer', () {
      expect(runMood(const []), RunMood.cheer);
    });
  });

  group('the lesson state ring', () {
    test('each status draws its own state, from the server\'s own step and total', () {
      expect(LessonRingState.of(_unit('a', StudyUnitStatus.newUnit)).kind, LessonRingKind.fresh);
      final half = LessonRingState.of(_unit('b', StudyUnitStatus.inProgress, step: 2, steps: 4));
      expect(half.kind, LessonRingKind.partial);
      expect(half.fraction, 0.5);
      expect(LessonRingState.of(_unit('c', StudyUnitStatus.inProgress)).fraction, isNull, reason: 'no step from the server means no invented arc');
      expect(LessonRingState.of(_unit('d', StudyUnitStatus.due, due: 3)).kind, LessonRingKind.due);
      expect(LessonRingState.of(_unit('e', StudyUnitStatus.learned)).kind, LessonRingKind.done);
    });

    testWidgets('a lesson that moves from In progress to Done animates old to new, inking the tick', (tester) async {
      final state = ValueNotifier<LessonRingState>(const LessonRingState(LessonRingKind.partial, fraction: 0.5));
      await pumpMockmob(
        tester,
        ValueListenableBuilder<LessonRingState>(valueListenable: state, builder: (context, s, _) => LessonStateRing(state: s)),
        brightness: Brightness.dark,
      );
      expect(_ring(tester).arc, 0.5);
      expect(_ring(tester).tick, 0);

      state.value = const LessonRingState(LessonRingKind.done);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 160));
      final mid = _ring(tester);
      expect(mid.arc, inExclusiveRange(0.5, 1.0));
      expect(mid.tick, inExclusiveRange(0.0, 1.0));
      await tester.pump(const Duration(milliseconds: 600));
      expect(_ring(tester).tick, 1);
      expect(_ring(tester).arc, 1);
    });

    testWidgets('a lesson that becomes due pulses once, and rests with its mark', (tester) async {
      final state = ValueNotifier<LessonRingState>(const LessonRingState(LessonRingKind.done));
      await pumpMockmob(
        tester,
        ValueListenableBuilder<LessonRingState>(valueListenable: state, builder: (context, s, _) => LessonStateRing(state: s)),
        brightness: Brightness.dark,
      );
      expect(_ring(tester).pulse, 1);
      state.value = const LessonRingState(LessonRingKind.due);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(_ring(tester).pulse, inExclusiveRange(0.0, 1.0));
      await tester.pump(const Duration(seconds: 1));
      expect(_ring(tester).pulse, 1);
      expect(_ring(tester).mark, 1);
      expect(_ring(tester).tick, 0);
    });

    testWidgets('under reduced motion the new state is simply there', (tester) async {
      final state = ValueNotifier<LessonRingState>(const LessonRingState(LessonRingKind.fresh));
      await pumpMockmob(
        tester,
        ValueListenableBuilder<LessonRingState>(valueListenable: state, builder: (context, s, _) => LessonStateRing(state: s)),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      state.value = const LessonRingState(LessonRingKind.done);
      await tester.pump();
      expect(_ring(tester).tick, 1);
    });
  });

  group('lesson rows', () {
    Future<void> pump(WidgetTester tester, {Set<String> onPhone = const {}, bool offline = false}) => pumpMockmob(
          tester,
          SingleChildScrollView(
            child: SubjectLessons(
              subject: const LearnSubject(id: 'accountancy', title: 'Accountancy'),
              units: [_unit('a', StudyUnitStatus.newUnit), _unit('b', StudyUnitStatus.learned)],
              onOpen: (_) {},
              onPhone: onPhone,
              offline: offline,
            ),
          ),
          brightness: Brightness.dark,
          disableAnimations: true,
          size: const Size(384, 900),
        );

    testWidgets('a kept lesson says it is on this phone, and each row has its ring', (tester) async {
      await pump(tester, onPhone: {'b'});
      expect(find.textContaining(LearnCopy.onThisPhone), findsOneWidget);
      expect(find.textContaining(LearnCopy.needsConnection), findsNothing);
      expect(find.byType(LessonStateRing), findsNWidgets(2));
    });

    testWidgets('with no connection, a lesson that is not kept says it needs one', (tester) async {
      await pump(tester, onPhone: {'b'}, offline: true);
      expect(find.textContaining(LearnCopy.onThisPhone), findsOneWidget);
      expect(find.textContaining(LearnCopy.needsConnection), findsOneWidget);
    });

    testWidgets('online and not kept says nothing about where it lives', (tester) async {
      await pump(tester);
      expect(find.textContaining(LearnCopy.onThisPhone), findsNothing);
      expect(find.textContaining(LearnCopy.needsConnection), findsNothing);
    });
  });

  group('the card stack', () {
    testWidgets('the cards fan out once, the top card breathes three times and rests', (tester) async {
      await pumpMockmob(tester, const CardStackMark(count: 12), brightness: Brightness.dark);
      // pumpMockmob has already run a little; the fan is a 500 ms run from the first frame.
      final seen = <double>[];
      for (var i = 0; i < 6; i++) {
        seen.add(_stack(tester).breath);
        await tester.pump(const Duration(milliseconds: 1500));
      }
      await tester.pump(const Duration(seconds: 6));
      expect(_stack(tester).fan, 1);
      expect(_stack(tester).breath, 0, reason: 'after three breaths the pile rests');
      expect(seen.any((b) => b != 0), isTrue, reason: 'it did breathe');
    });

    testWidgets('Start sends the top card off, and it comes back if Start did not go through', (tester) async {
      final leaving = ValueNotifier<bool>(false);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<bool>(valueListenable: leaving, builder: (context, l, _) => CardStackMark(count: 12, leaving: l)),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(_stack(tester).leave, 0);
      leaving.value = true;
      await tester.pump();
      expect(_stack(tester).leave, 1);
      leaving.value = false;
      await tester.pump();
      expect(_stack(tester).leave, 0);
    });

    testWidgets('and slides over time when motion is on', (tester) async {
      final leaving = ValueNotifier<bool>(false);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<bool>(valueListenable: leaving, builder: (context, l, _) => CardStackMark(count: 12, leaving: l)),
        brightness: Brightness.dark,
      );
      await tester.pump(const Duration(seconds: 1));
      leaving.value = true;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      expect(_stack(tester).leave, inExclusiveRange(0.0, 1.0));
      await tester.pump(const Duration(milliseconds: 400));
      expect(_stack(tester).leave, 1);
    });
  });

  group('the due card and Mobi', () {
    Future<void> pump(WidgetTester tester, StudyQueueView queue, {bool cleared = false}) => pumpMockmob(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: DueCard(queue: queue, recallEnabled: true, onStart: () {}, primary: true, cleared: cleared),
          ),
          brightness: Brightness.dark,
          size: const Size(384, 900),
        );

    testWidgets('above 20 due, Mobi says so gently', (tester) async {
      await pump(tester, const StudyQueueView(due: 25, newReady: 0, pausedNew: false));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text(LearnCopy.aLotWaiting), findsOneWidget);
    });

    testWidgets('at 20 or fewer, he does not', (tester) async {
      await pump(tester, const StudyQueueView(due: 20, newReady: 0, pausedNew: false));
      expect(find.text(LearnCopy.aLotWaiting), findsNothing);
    });

    testWidgets('nothing due and nothing new: he reads quietly, or is proud only once a fresh catalog said so', (tester) async {
      await pump(tester, const StudyQueueView(due: 0, newReady: 0, pausedNew: false));
      expect(tester.takeException(), isNull);
      await pump(tester, const StudyQueueView(due: 0, newReady: 0, pausedNew: false), cleared: true);
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
      expect(find.text(LearnCopy.nothingDue), findsOneWidget);
    });

    testWidgets('pressing Start sends the top card off', (tester) async {
      final starting = ValueNotifier<bool>(false);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<bool>(
          valueListenable: starting,
          builder: (context, s, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: DueCard(queue: const StudyQueueView(due: 8, newReady: 0, pausedNew: false), recallEnabled: true, onStart: () {}, primary: true, starting: s),
          ),
        ),
        brightness: Brightness.dark,
        size: const Size(384, 900),
      );
      await tester.pump(const Duration(seconds: 1));
      starting.value = true;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(_stack(tester).leave, 1);
    });
  });

  group('the offline packs', () {
    const subjects = [LearnSubject(id: 'accountancy', title: 'Accountancy'), LearnSubject(id: 'economics', title: 'Economics')];
    const state = OfflineLearnState(kept: {'accountancy', 'economics'}, sizes: {'accountancy': 4000000, 'economics': 1000000});

    Future<List<String>> pump(WidgetTester tester) async {
      final removed = <String>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: OfflinePacks(subjects: subjects, state: state, onChanged: (_, _) {}, onRemove: removed.add),
        ),
        brightness: Brightness.dark,
        size: const Size(384, 900),
      );
      return removed;
    }

    double share(WidgetTester tester, int i) => tester.widgetList<TweenAnimationBuilder<double>>(find.byType(TweenAnimationBuilder<double>)).elementAt(i).tween.end!;

    testWidgets('each kept pack has a bar against the biggest pack, not against a number made up', (tester) async {
      await pump(tester);
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(PackSizeBar), findsNWidgets(2));
      expect(share(tester, 0), 1.0);
      expect(share(tester, 1), 0.25);
    });

    testWidgets('Remove waits for its Undo window, then deletes; nothing is deleted before', (tester) async {
      final removed = await pump(tester);
      await tester.tap(find.bySemanticsLabel(RegExp('Remove kept lessons from this phone, Economics')));
      await tester.pump();
      expect(find.text(LearnCopy.packUndo), findsOneWidget);
      expect(find.text(LearnCopy.packRemoved), findsOneWidget);
      expect(removed, isEmpty);
      await tester.pump(OfflinePacks.undoWindow - const Duration(seconds: 1));
      expect(removed, isEmpty);
      await tester.pump(const Duration(seconds: 2));
      expect(removed, ['economics']);
    });

    testWidgets('Undo inside the window keeps the lessons', (tester) async {
      final removed = await pump(tester);
      await tester.tap(find.bySemanticsLabel(RegExp('Remove kept lessons from this phone, Economics')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));
      await tester.tap(find.text(LearnCopy.packUndo));
      await tester.pump();
      await tester.pump(OfflinePacks.undoWindow);
      expect(removed, isEmpty);
      expect(find.text(LearnCopy.packUndo), findsNothing);
    });

    testWidgets('leaving the screen inside the window keeps the lessons', (tester) async {
      final removed = await pump(tester);
      await tester.tap(find.bySemanticsLabel(RegExp('Remove kept lessons from this phone, Economics')));
      await tester.pump();
      await tester.pumpWidget(const SizedBox());
      await tester.pump(OfflinePacks.undoWindow * 2);
      expect(removed, isEmpty);
    });
  });
}
