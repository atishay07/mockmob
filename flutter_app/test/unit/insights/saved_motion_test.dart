import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmChip;
import 'package:mockmob/features/insights/copy.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/insights/screens/saved_screen.dart';
import 'package:mockmob/features/insights/widgets/gesture_motion.dart';
import 'package:mockmob/features/insights/widgets/saved_bits.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/golden_harness.dart';
import 'support/insights_fixtures.dart';

/// A save controller the test answers by hand: [set] waits on [gate], then the server "says" the
/// outcome.
class _HandSave extends SaveController {
  Completer<void>? gate;
  final List<(String, bool)> calls = [];

  @override
  SaveMarks build() => const SaveMarks();

  void ack(String id, bool saved) => state = SaveMarks(acked: {...state.acked, id: saved}, pending: {...state.pending}..remove(id), count: 3, limit: 25);

  @override
  Future<SaveOutcome> set(String questionId, {required bool saved, String source = 'explore'}) async {
    calls.add((questionId, saved));
    state = SaveMarks(acked: state.acked, pending: {...state.pending, questionId}, count: state.count, limit: state.limit);
    await (gate ??= Completer<void>()).future;
    ack(questionId, saved);
    return SaveDone(saved: saved, count: 3, limit: 25);
  }
}

SavedList _list() => SavedList(
      ids: const ['q1', 'q2', 'q3'],
      questions: [
        question('q1', saved: true, body: 'First saved question body'),
        question('q2', saved: true, subject: 'economics', chapter: 'Money and banking', body: 'Second saved question body'),
        question('q3', saved: true, body: 'Third saved question body'),
      ],
      count: 3,
    );

Future<_HandSave> _pump(WidgetTester tester, {SavedList? list, bool pro = false, bool reduced = false}) async {
  final hand = _HandSave();
  await pumpMockmob(
    tester,
    // The hand-answered save controller sits in a scope of its own, inside the one the
    // fixtures' overrides make, so the two never override the same provider twice.
    ProviderScope(overrides: [saveControllerProvider.overrideWith(() => hand)], child: const SavedScreen()),
    brightness: Brightness.dark,
    disableAnimations: reduced,
    wrapInScaffold: false,
    overrides: insightsOverrides(saved: RemoteState(value: list ?? _list()), pro: pro),
  );
  return hand;
}

void main() {
  group('merging the list with what the server acknowledged', () {
    test('a removal the server confirmed stays in place as a row that is not shown', () {
      final qs = _list().questions;
      var rows = mergeSavedRows([], qs, {}, built: false);
      expect(rows.map((r) => r.question.id), ['q1', 'q2', 'q3']);
      expect(rows.every((r) => r.shown && !r.fresh), isTrue);

      rows = mergeSavedRows(rows, qs, {'q2': false}, built: true);
      expect(rows.map((r) => r.question.id), ['q1', 'q2', 'q3'], reason: 'it keeps its place while it folds');
      expect(rows.map((r) => r.shown), [true, false, true]);
    });

    test('an Undo brings the same row back, and a row new to a shown list is fresh', () {
      final qs = _list().questions;
      var rows = mergeSavedRows([], qs, {}, built: false);
      rows = mergeSavedRows(rows, qs, {'q2': false}, built: true);
      rows = mergeSavedRows(rows, qs, {'q2': true}, built: true);
      expect(rows.map((r) => r.shown), [true, true, true]);
      expect(rows[1].fresh, isFalse, reason: 'the row still exists, so it reverses its fold instead of unfolding anew');

      final more = [...qs, question('q9', saved: true)];
      rows = mergeSavedRows(rows, more, {}, built: true);
      expect(rows.last.question.id, 'q9');
      expect(rows.last.fresh, isTrue);
    });

    test('a row the refreshed list no longer has stays until it has folded', () {
      final qs = _list().questions;
      var rows = mergeSavedRows([], qs, {}, built: false);
      rows = mergeSavedRows(rows, [qs[0], qs[2]], {'q2': false}, built: true);
      expect(rows.map((r) => (r.question.id, r.shown)), [('q1', true), ('q2', false), ('q3', true)]);
    });
  });

  group('removing a saved question', () {
    testWidgets('pending shows the dipping bookmark and a fully readable row; the ack folds it away and the rows below glide up', (tester) async {
      final hand = await _pump(tester);
      expect(find.text('Second saved question body'), findsOneWidget);
      final before = tester.getTopLeft(find.text('Third saved question body')).dy;

      // The quiet key at the end of the second row.
      await tester.tap(find.bySemanticsLabel('Remove this question from saved').at(1));
      await tester.pump();
      expect(hand.calls, [('q2', false)]);
      expect(find.byType(PendingBookmark), findsOneWidget);
      expect(find.text('Second saved question body'), findsOneWidget);
      // No half-faded row: nothing wraps the list in a 0.5 opacity any more.
      expect(find.byWidgetPredicate((w) => w is AnimatedOpacity && w.opacity == 0.5), findsNothing);

      hand.gate!.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 120));
      expect(find.text('Second saved question body'), findsOneWidget, reason: 'folding, not gone');
      await tester.pump(FoldExit.duration);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Second saved question body'), findsNothing);
      expect(tester.getTopLeft(find.text('Third saved question body')).dy, lessThan(before), reason: 'the neighbour moved up into the space');
    });

    testWidgets('an Undo during the fold reverses it', (tester) async {
      final hand = await _pump(tester);
      await tester.tap(find.bySemanticsLabel('Remove this question from saved').at(0));
      await tester.pump();
      hand.gate!.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      hand.ack('q1', true);
      await tester.pump();
      await tester.pump(FoldExit.duration + const Duration(milliseconds: 50));
      expect(find.text('First saved question body'), findsOneWidget);
      expect(find.byType(FoldExit), findsNWidgets(3));
    });

    testWidgets('under reduced motion the row is simply gone once the server confirms', (tester) async {
      final hand = await _pump(tester, reduced: true);
      await tester.tap(find.bySemanticsLabel('Remove this question from saved').at(0));
      await tester.pump();
      hand.gate!.complete();
      await tester.pump();
      await tester.pump();
      expect(find.text('First saved question body'), findsNothing);
    });

    testWidgets('removing the last row folds it, then Mobi\'s empty state takes over', (tester) async {
      final hand = await _pump(
        tester,
        list: SavedList(ids: const ['q1'], questions: [question('q1', saved: true, body: 'Only question body')], count: 1),
      );
      await tester.tap(find.bySemanticsLabel('Remove this question from saved'));
      await tester.pump();
      hand.gate!.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(InsightsCopy.savedEmptyTitle), findsNothing, reason: 'the fold finishes first');
      await tester.pump(FoldExit.duration);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(InsightsCopy.savedEmptyTitle), findsOneWidget);
    });
  });

  group('swiping a saved row', () {
    testWidgets('left past 45 percent removes, with the same call as the key', (tester) async {
      final hand = await _pump(tester);
      await tester.drag(find.text('First saved question body'), const Offset(-250, 0));
      await tester.pump();
      expect(hand.calls, [('q1', false)]);
      await tester.pump(const Duration(milliseconds: 600));
    });

    testWidgets('a short swipe springs back and does nothing', (tester) async {
      final hand = await _pump(tester);
      await tester.drag(find.text('First saved question body'), const Offset(-60, 0));
      await tester.pump(const Duration(milliseconds: 600));
      expect(hand.calls, isEmpty);
      expect(tester.getTopLeft(find.text('First saved question body')).dx, lessThan(120));
    });

    testWidgets('a swipe in flight reveals the coral Remove and the volt Practise', (tester) async {
      await _pump(tester);
      final gesture = await tester.startGesture(tester.getCenter(find.text('First saved question body')));
      await gesture.moveBy(const Offset(-60, 0));
      await gesture.moveBy(const Offset(-60, 0));
      await tester.pump();
      expect(find.text(InsightsCopy.swipeRemove), findsOneWidget);
      await gesture.moveBy(const Offset(120, 0));
      await gesture.moveBy(const Offset(120, 0));
      await tester.pump();
      expect(find.text(InsightsCopy.swipePractise), findsOneWidget);
      // Back to the middle before letting go, so nothing commits (Practise needs a router).
      await gesture.moveBy(const Offset(-230, 0));
      await gesture.moveBy(const Offset(-130, 0));
      await gesture.up();
      await tester.pump(const Duration(milliseconds: 600));
    });

    testWidgets('TalkBack gets Practise and Remove as custom actions on the row', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester);
      final node = tester.getSemantics(find.bySemanticsLabel(RegExp('Practise this question: First')));
      final data = node.getSemanticsData();
      final labels = [for (final id in data.customSemanticsActionIds!) CustomSemanticsAction.getAction(id)!.label];
      expect(labels, containsAll([InsightsCopy.practiseThisAction, InsightsCopy.removeThisAction]));
      handle.dispose();
    });
  });

  group('the header', () {
    testWidgets('free shows one pip per slot with the used count in words; Pro shows only the count', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester);
      expect(find.byType(SlotMeter), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('3 of 25 free save slots used')), findsOneWidget);
      handle.dispose();
    });

    testWidgets('Pro has no pips', (tester) async {
      await _pump(tester, pro: true);
      expect(find.byType(SlotMeter), findsNothing);
      expect(find.text('3 saved'), findsOneWidget);
    });

    testWidgets('subject chips come from the subjects present, and filter the rows', (tester) async {
      await _pump(tester);
      expect(find.text(InsightsCopy.allSubjects), findsOneWidget);
      expect(find.widgetWithText(MmChip, 'Economics'), findsOneWidget);
      // On a 360 dp phone the chips scroll sideways; the last one is brought into view first.
      await tester.ensureVisible(find.widgetWithText(MmChip, 'Economics'));
      await tester.pump();
      await tester.tap(find.widgetWithText(MmChip, 'Economics'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Second saved question body'), findsOneWidget);
      expect(find.text('First saved question body'), findsNothing);
      await tester.ensureVisible(find.widgetWithText(MmChip, InsightsCopy.allSubjects));
      await tester.pump();
      await tester.tap(find.widgetWithText(MmChip, InsightsCopy.allSubjects));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('First saved question body'), findsOneWidget);
    });

    testWidgets('with one subject there are no chips', (tester) async {
      await _pump(
        tester,
        list: SavedList(ids: const ['q1', 'q3'], questions: [question('q1', saved: true), question('q3', saved: true)], count: 2),
      );
      expect(find.text(InsightsCopy.allSubjects), findsNothing);
    });
  });

  group('the slot meter', () {
    testWidgets('only the changed pip pops when the count moves', (tester) async {
      final count = ValueNotifier<int>(3);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<int>(valueListenable: count, builder: (context, n, _) => SlotMeter(count: n, limit: 25)),
        brightness: Brightness.dark,
      );
      await tester.pump(const Duration(milliseconds: 800));
      count.value = 4;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      final painter = tester.widget<CustomPaint>(find.descendant(of: find.byType(SlotMeter), matching: find.byType(CustomPaint))).painter! as SlotMeterPainter;
      expect(painter.changed, 3, reason: 'inking the fourth slot pops pip index 3');
      expect(painter.pop, inExclusiveRange(0.0, 1.0));
      await tester.pump(const Duration(milliseconds: 400));
    });
  });

  group('the empty state', () {
    testWidgets('Mobi reads and the way to the stream is there; pointing after 1.2 s does not throw', (tester) async {
      await _pump(tester, list: const SavedList());
      expect(find.text(InsightsCopy.savedEmptyAction), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 1300));
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.takeException(), isNull);
    });
  });
}
