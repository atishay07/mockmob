// The practice result (19 Oct, D108): the restored finish moment (FinishStage, as at 68f63c11) with its completion line,
// then the RESULT-1017 layers under it: the one next move, the mistakes with their repair inline, and everything else
// folded under plain names.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart' show attemptDetailProvider;
import 'package:mockmob/core/storage/prefs_store.dart' show MemoryPrefsStore;
import 'package:mockmob/features/insights/ask_mobi.dart' show AskMobiKind;
import 'package:mockmob/features/insights/data/ask_sheet_controller.dart' show askSheetScopeProvider;
import 'package:mockmob/features/paper_reel/data/reel_seen.dart' show reelPrefsStoreProvider;
import 'package:mockmob/features/paper_reel/paper_reel.dart' show PaperReel, PaperReelResultEntry, reelSeenProvider;
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton, MobiCharacter;
import 'package:mockmob/features/credits/data/credit_figures.dart' show CreditFigures;
import 'package:mockmob/features/practice/data/result_actions.dart';
import 'package:mockmob/features/practice/practice_result_screen.dart' show PracticeResultScreen;
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/numbered_sheet.dart' show NumberedSheet;
import 'package:mockmob/features/result/widgets/fold_section.dart' show FoldMemory;
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakeChip, MistakeRepairEntry, MistakeSummary;
import 'package:mockmob/features/practice/widgets/finish_stage.dart' show FinishStage, CompletionLine;
import 'package:mockmob/features/practice/widgets/result_foot.dart' show ResultFoot;

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/today'),
  stubRoute('/practice'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/review/repair/:attemptId/:questionId'),
  stubRoute('/practice/start'),
  stubRoute('/you/credits'),
  stubRoute('/review'),
];

AttemptDetail detailOf(List<(String, V)> questions, {Map<String, dynamic>? reviews, String state = 'ready'}) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
  'answerReviews': reviews ?? <String, dynamic>{},
  'answerReviewState': state,
});

final _mixed = [
  for (var i = 0; i < 8; i++) ('Admission of a partner', V.right),
  ('Admission of a partner', V.wrong),
  ('Admission of a partner', V.blank),
];

Future<GoRouter> pumpResult(WidgetTester tester, List<dynamic> overrides) {
  FoldMemory.instance.reset();
  addTearDown(FoldMemory.instance.reset);
  // A tall phone: the finish moment (20 Oct, I13) adds the marks up on the paper before the layers, and these tests read
  // the layers, not the fold. The moment's own layout at 360 by 760 is held by the reveal goldens.
  return pumpRouted(tester, location: '/practice/result/p1', routes: _routes(), size: const Size(360, 1500), overrides: List.castFrom(overrides));
}

Finder get _page => find.byType(Scrollable).first;

/// Real frames, so a fold or a row that opens has grown to its full height.
Future<void> frames(WidgetTester tester, {int ms = 500}) async {
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// Scrolls [finder] into the middle of the list, clear of the pinned foot.
Future<void> bringIn(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder.first, 200, scrollable: _page);
  await Scrollable.ensureVisible(tester.element(finder.first), alignment: 0.3);
  await tester.pump(const Duration(milliseconds: 100));
}

/// Taps the closed face of mistake [number] open.
Future<void> openMistake(WidgetTester tester, int number) async {
  final row = find.byWidgetPredicate((w) => w is MistakeSummary && w.number == number);
  await bringIn(tester, row);
  await tester.tap(row);
  await frames(tester);
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the finish moment: the figure, the counts, the sheet, Mobi, the completion line with the marks, and the costliest chapter under it', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), chapter: 'Admission of a partner'));
    await tester.pump(const Duration(milliseconds: 900));
    // The restored moment (D108): the stamped figure of right answers, the counts and the sheet, with Mobi beside it.
    expect(find.byType(FinishStage), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('8 of 10 correct')), findsWidgets);
    // The counts are the ledger's rows now (20 Oct, I13): each with its marks, +5, -1 and 0 each.
    expect(find.text('8 right'), findsOneWidget);
    expect(find.text('1 wrong'), findsOneWidget);
    expect(find.text('1 not attempted'), findsOneWidget);
    expect(find.text('+40'), findsOneWidget);
    expect(find.text('Accountancy practice, Admission of a partner, finished'), findsOneWidget);
    expect(find.byType(NumberedSheet), findsOneWidget);
    expect(find.byType(MobiCharacter), findsOneWidget);
    // The one receipt is the completion line (F11: said once). Opened again, it says when the paper was saved.
    expect(find.bySemanticsLabel('Saved today at 11:51 PM. You scored 39 of 50 marks.'), findsOneWidget);
    expect(find.textContaining('Recorded'), findsNothing);
    expect(find.textContaining('Your paper is saved'), findsNothing);
    // The bar has no line of its own any more: the ledger says the marks in rows, and the total once.
    expect(find.text('1 wrong answer cost 6 of the 11 marks you missed.'), findsNothing);
    expect(find.textContaining('39 of 50 marks.'), findsNothing);
    // One chapter: no chapter list (the ledger has said it all).
    expect(find.byKey(const ValueKey('finish-chapters')), findsNothing);
    // One chapter lost every missed mark: the bar's line has said it and the panel names the chapter, so the moment is
    // not followed by the same news a second time (one thing at a time).
    expect(find.textContaining('cost 11 of the 11 marks you missed'), findsNothing);
    expect(find.text('Finish for now'), findsWidgets);
    expect(find.text(ResultFoot.seePaperLabel), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('two chapters lost the same marks: under the moment, the tie is said, not broken by paper order (owner I14)', (tester) async {
    final semantics = tester.ensureSemantics();
    final two = [
      for (var i = 0; i < 8; i++) ('Admission of a partner', V.right),
      ('Admission of a partner', V.wrong),
      ('Goodwill', V.wrong),
    ];
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(two)));
    await tester.pump(const Duration(milliseconds: 900));
    // The moment's last beat (I13, I14): the v12 tie line over the chapters, both ranked 1st and marked Tied.
    expect(find.text('Admission of a partner and Goodwill each cost you 6 marks.'), findsOneWidget);
    expect(find.text('Together they cost 12 of the 12 marks you missed.'), findsOneWidget);
    expect(find.text('Tied'), findsNWidgets(2));
    expect(find.bySemanticsLabel('Goodwill, tied first, 6 marks missed'), findsOneWidget);
    expect(find.textContaining('cost 6 of the 12'), findsNothing);
    semantics.dispose();
  });

  testWidgets('two chapters lost different marks: the one that cost the most is named alone', (tester) async {
    final two = [
      for (var i = 0; i < 7; i++) ('Admission of a partner', V.right),
      ('Admission of a partner', V.wrong),
      ('Admission of a partner', V.wrong),
      ('Goodwill', V.wrong),
    ];
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(two)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text('Admission of a partner cost 12 of the 18 marks you missed.'), findsOneWidget);
    // Ranked by marks, no tie: 1 and 2, no Tied tag.
    expect(find.text('Tied'), findsNothing);
    expect(find.text('2'), findsWidgets);
  });

  testWidgets('"Your paper is saved" is said only once the server\'s acknowledgement is held on this phone', (tester) async {
    final semantics = tester.ensureSemantics();
    final gate = Completer<DateTime?>();
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending, receivedLater: gate.future));
    await frames(tester, ms: 2600);
    // Fresh from the submit, but the acknowledgement is not read yet: the marks alone, never "saved".
    expect(find.bySemanticsLabel('You scored 39 of 50 marks.'), findsOneWidget);
    expect(find.textContaining('Your paper is saved'), findsNothing);
    gate.complete(DateTime(2026, 10, 12, 23, 51));
    await tester.pump();
    await frames(tester, ms: 400);
    expect(find.bySemanticsLabel('Your paper is saved. You scored 39 of 50 marks.'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('with no acknowledgement on this phone a fresh moment never claims the paper is saved', (tester) async {
    final semantics = tester.ensureSemantics();
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending, receivedLater: Future.value(null)));
    await frames(tester, ms: 2600);
    expect(find.textContaining('Your paper is saved'), findsNothing);
    expect(find.bySemanticsLabel('You scored 39 of 50 marks.'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('the marks count up from 0 over 720 ms on an ease-out once the figure lands, in tabular figures', (tester) async {
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending));
    await tester.pump();
    await tester.pump();
    Text figure() => tester.widget<Text>(find.byKey(const ValueKey('completion-figure')));
    expect(figure().data, '0');
    // Ten bubbles: 200 ms in place, 720 ms of ink, the stamp lands 240 ms later (1160 ms), the marks are added up from
    // 160 ms after that, and the total starts counting 560 ms into that (about 1880 ms).
    await frames(tester, ms: 1800);
    expect(figure().data, '0');
    await frames(tester, ms: 480);
    final mid = int.parse(figure().data!);
    // An ease-out: well past half the marks a little after half the time.
    expect(mid, greaterThan(19));
    expect(mid, lessThan(39));
    await frames(tester, ms: 700);
    expect(figure().data, '39');
    expect(figure().style!.fontFeatures, contains(const FontFeature.tabularFigures()));
    expect(CompletionLine.figureAt(39, 1), 39);
  });

  testWidgets('"See it in Your papers" opens Your papers on this paper', (tester) async {
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    await tester.tap(find.text(ResultFoot.seePaperLabel));
    await tester.pump(const Duration(milliseconds: 300));
    expect(router.state.uri.path, '/review');
    expect(router.state.uri.queryParameters['paper'], 'p1');
  });

  testWidgets('one next move: the foot key, why, what a repair gives and its cost before paying, and the late hour in words', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), credits: const CreditFigures(ai: 68, practice: 40)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.widgetWithText(KeyButton, 'Repair Q9'), findsOneWidget);
    expect(find.text('Why Q9 first'), findsOneWidget);
    expect(find.text('Admission of a partner. You picked B.'), findsOneWidget);
    // No check question is promised until the Lab says one is ready (RESULT-1017 4.4).
    expect(find.textContaining('A repair gives you why B looked right, the trap'), findsOneWidget);
    // The pinned foot carries the cost on one line (19 Oct walk, finding 28); the promise sits in the panel above.
    expect(find.text('1 credit. You have 68.'), findsOneWidget);
    expect(find.text('No charge if the repair cannot be written.'), findsOneWidget);
    // 11 PM: one plain line, never a sleeping figure.
    expect(find.text('It is late. One repair is enough for tonight.'), findsOneWidget);
    expect(find.text('Practise 10 on Admission of a partner instead'), findsOneWidget);
  });

  testWidgets('the receipt waits for the time the server acknowledged; it never shows the attempt time meanwhile', (tester) async {
    final semantics = tester.ensureSemantics();
    final gate = Completer<DateTime?>();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), receivedLater: gate.future));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('Saved'), findsNothing);
    expect(find.bySemanticsLabel('You scored 39 of 50 marks.'), findsOneWidget);
    gate.complete(DateTime(2026, 10, 12, 23, 53));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.bySemanticsLabel('Saved today at 11:53 PM. You scored 39 of 50 marks.'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('the mistakes: in paper order, priced in marks, each opening to its key, explanation and repair entry', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text('Your 1 mistake'), findsOneWidget);
    expect(find.text('−6 marks'), findsOneWidget);
    expect(find.text('In paper order. Repaired ones say whether the fix held.'), findsOneWidget);
    // A chip says a state, never an action (D15): the volt key's target reads like every other open mistake.
    expect(find.text('Not repaired'), findsOneWidget);
    expect(find.text('Repair first'), findsNothing);
    // Closed until tapped: the key opens it.
    expect(find.text('Your answer'), findsNothing);
    await openMistake(tester, 9);
    expect(find.text('Your answer'), findsOneWidget);
    expect(find.text('Correct answer'), findsOneWidget);
    expect(find.text('Because 8.'), findsOneWidget);
    expect(find.textContaining('then a new question to check it held'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('a held review shows no key, no explanation and no repair, and the head says so once', (tester) async {
    final detail = detailOf(
      _mixed,
      reviews: {
        'p1-q9': {'state': 'under_review'},
      },
    );
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detail));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text("Q9's answer key is being re-checked. It is left out of repairs until the check ends."), findsOneWidget);
    expect(find.text('Key being re-checked'), findsOneWidget);
    expect(find.widgetWithText(KeyButton, 'Repair Q9'), findsNothing);
    await openMistake(tester, 9);
    expect(find.text('The answer for this question is being checked, so it is not shown yet.'), findsOneWidget);
    expect(find.text('Correct answer'), findsNothing);
    expect(find.text('Because 8.'), findsNothing);
  });

  testWidgets('unavailable reviews mean no keys at all', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed, state: 'unavailable')));
    await tester.pump(const Duration(milliseconds: 900));
    await openMistake(tester, 9);
    expect(find.text('Answers and explanations are not available for this result right now.'), findsOneWidget);
    expect(find.text('Correct answer'), findsNothing);
  });

  testWidgets('blanks fold under one priced row, open with Try it again, and never offer a repair', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final blanks = find.text('1 left blank, 5 marks not earned');
    await bringIn(tester, blanks);
    expect(find.text('Question 10, Not attempted'), findsNothing);
    await tester.tap(blanks);
    await frames(tester);
    await bringIn(tester, find.text('Question 10, Not attempted'));
    await tester.tap(find.text('Question 10, Not attempted'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('You did not answer this question.'), findsOneWidget);
    expect(find.byType(MistakeRepairEntry), findsNothing);
    await tester.ensureVisible(find.text('Try it again').first);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Try it again').first);
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('This try stays on your phone.'), findsOneWidget);
  });

  testWidgets('every question right: a harder set is the move, and the mistakes say there are none', (tester) async {
    final all = [for (var i = 0; i < 10; i++) ('Goodwill', V.right)];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(all)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text('10 right'), findsOneWidget);
    expect(find.text('0 wrong'), findsOneWidget);
    expect(find.text('No mistakes to repair'), findsOneWidget);
    expect(find.widgetWithText(KeyButton, 'Practise 10 harder in Accountancy'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Practise 10 harder in Accountancy'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/start');
    expect(router.state.uri.queryParameters['difficulty'], 'hard');
  });

  testWidgets('a weak set: a chapter set before single repairs, with its cost and balance', (tester) async {
    final weak = [
      ('Goodwill', V.right),
      ('Goodwill', V.right),
      for (var i = 0; i < 6; i++) ('Goodwill', V.wrong),
      ('Admission of a partner', V.wrong),
      ('Admission of a partner', V.blank),
    ];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(weak), credits: const CreditFigures(ai: 68, practice: 40)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.widgetWithText(KeyButton, 'Practise 10 on Goodwill'), findsOneWidget);
    expect(find.text('Why this chapter first'), findsOneWidget);
    expect(find.text('Goodwill: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes.'), findsOneWidget);
    expect(find.text('This set uses 10 credits. You have 40.'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Practise 10 on Goodwill'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/start');
    expect(router.state.uri.queryParameters, {'mode': 'chapter', 'subject': 'accountancy', 'count': '10', 'chapter': 'Goodwill'});
  });

  testWidgets('R4: after a weak set the volt key is the chapter set, and "Repair Qn" (v15.2) stays one tap away as a quiet key', (tester) async {
    final weak = [
      ('Goodwill', V.right),
      ('Goodwill', V.right),
      for (var i = 0; i < 6; i++) ('Goodwill', V.wrong),
      ('Admission of a partner', V.wrong),
      ('Admission of a partner', V.blank),
    ];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(weak), credits: const CreditFigures(ai: 68, practice: 40)));
    await tester.pump(const Duration(milliseconds: 900));
    // One dominant move: the chapter set is the only volt key; the repair is a quiet key next to "See it in Your papers".
    final volt = find.widgetWithText(KeyButton, 'Practise 10 on Goodwill');
    expect(volt, findsOneWidget);
    final repair = find.byKey(const ValueKey('result-foot-repair'));
    expect(repair, findsOneWidget);
    expect(find.descendant(of: repair, matching: find.text('Repair Q3')), findsOneWidget);
    expect(tester.getRect(repair).top, greaterThan(tester.getRect(volt).bottom), reason: 'it sits under the volt key');
    expect(tester.getRect(repair).top, tester.getRect(find.widgetWithText(KeyButton, ResultFoot.seePaperLabel)).top, reason: 'on the same row as See it in Your papers');
    await tester.tap(repair);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q3');
    expect(router.state.uri.queryParameters['count'], '1');
  });

  testWidgets('R4: when the next move is the repair itself there is no second repair key in the foot', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), credits: const CreditFigures(ai: 68, practice: 40)));
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.widgetWithText(KeyButton, 'Repair Q9'), findsOneWidget);
    expect(find.byKey(const ValueKey('result-foot-repair')), findsNothing);
  });

  testWidgets('Finish for now ends with one plain line, then returns to Today', (tester) async {
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Finish for now'));
    await tester.pump();
    expect(find.text('Practice finished. Recorded at 11:51 PM.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1700));
    await tester.pump(const Duration(milliseconds: 300));
    expect(router.state.uri.path, '/today');
  });

  testWidgets('the result of another account says so', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        error: const ApiError(kind: ApiErrorKind.notFound, code: 'not_found', status: 404),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('We could not find this result. It may belong to another account.'), findsOneWidget);
  });

  testWidgets('a failed read with nothing cached offers Try again', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        error: const ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('We could not load this result. Try again.'), findsOneWidget);
    expect(find.text('Try again'), findsWidgets);
  });

  testWidgets('a stale cached result says when it was last loaded', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        detail: detailOf(_mixed),
        error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
        fetchedAt: DateTime(2026, 10, 12, 22, 44),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Showing what was last loaded at 10:44 PM.'), findsOneWidget);
  });

  testWidgets('every mistake row is a labelled 48 dp or larger target', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final row = find.bySemanticsLabel(RegExp(r'^Question 9, Admission of a partner, B yours'));
    expect(row, findsOneWidget);
    expect(tester.getSize(row).height, greaterThanOrEqualTo(48));
    semantics.dispose();
  });

  testWidgets('straight after the submit the sheet inks in, the figure counts up and Mobi reacts; the layers below arrive after it', (tester) async {
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending));
    await tester.pump();
    await tester.pump();
    // At the start nothing is inked yet, Mobi has not spoken, and the layers below are not there to give it away.
    expect(find.byKey(const ValueKey('finish-figure')), findsOneWidget);
    expect(find.textContaining('Most of this set'), findsNothing);
    final layers = find.ancestor(of: find.text('Your 1 mistake'), matching: find.byType(AnimatedOpacity));
    expect(tester.widget<AnimatedOpacity>(layers.first).opacity, 0);
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump(const Duration(milliseconds: 420));
    await tester.pump(const Duration(milliseconds: 600));
    await frames(tester, ms: 3000);
    expect(find.bySemanticsLabel(RegExp('8 of 10 correct')), findsWidgets);
    expect(tester.widget<AnimatedOpacity>(layers.first).opacity, 1);
    // Opened once: the result is marked opened only after the moment read that it was fresh.
    expect(pending.opened, ['p1']);
  });

  testWidgets('a tap on the moment skips to the end', (tester) async {
    final semantics = tester.ensureSemantics();
    final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), pending: pending));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('finish-figure')));
    await tester.pump();
    // The end state lands in 200 ms (20 Oct, I13): every value on its final figure, never a jump cut.
    await frames(tester, ms: 240);
    expect(find.bySemanticsLabel('Your paper is saved. You scored 39 of 50 marks.'), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const ValueKey('completion-figure'))).data, '39');
    expect(tester.widget<Text>(find.byKey(const ValueKey('ledger-value-0'))).data, '+40');
    expect(tester.widget<Text>(find.byKey(const ValueKey('ledger-value-1'))).data, '−1');
    semantics.dispose();
  });

  testWidgets('the foot key opens that one repair; the alternative starts the chapter set', (tester) async {
    final questions = <(String, V)>[
      ('Nature of management', V.right),
      ('Principles of management', V.wrong),
      ('Nature of management', V.right),
      ('Planning', V.wrong),
      ('Staffing', V.wrong),
      ('Nature of management', V.right),
      ('Planning', V.wrong),
      ('Staffing', V.wrong),
      ('Nature of management', V.right),
      ('Nature of management', V.right),
    ];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(questions)));
    await tester.pump(const Duration(milliseconds: 900));
    // Planning and Staffing each cost 12: the line says both (owner I14). Planning comes first in the paper, so its first
    // mistake leads the key.
    expect(find.text('Planning and Staffing each cost you 12 marks.'), findsOneWidget);
    expect(find.text('Together they cost 24 of the 30 marks you missed.'), findsOneWidget);
    expect(find.widgetWithText(KeyButton, 'Repair Q4'), findsOneWidget);
    expect(find.text('All 5 repairs take about 15 minutes.'), findsOneWidget);
    expect(find.text('Your 5 mistakes'), findsOneWidget);
    expect(find.byType(MistakeSummary), findsNWidgets(4), reason: 'four show; "Show all 5" opens the last');
    expect(find.text('Show all 5'), findsOneWidget);
    expect(find.text('Practise 10 on Planning instead'), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, 'Repair Q4'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q4');
    expect(router.state.uri.queryParameters['count'], '1');
  });

  testWidgets('a tap on the Repair chip starts that repair, and does not fold the row (v13 walk, finding 5)', (tester) async {
    final questions = <(String, V)>[
      ('Nature of management', V.right),
      ('Principles of management', V.wrong),
      ('Nature of management', V.right),
      ('Planning', V.wrong),
    ];
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(questions)));
    await tester.pump(const Duration(milliseconds: 900));
    // Q2 is a wrong one: its chip (Repair, or Repair first when it leads) is the way to start its repair.
    final row = find.byWidgetPredicate((w) => w is MistakeSummary && w.number == 2);
    await bringIn(tester, row);
    final chip = find.descendant(of: row, matching: find.byType(MistakeChip));
    expect(chip, findsOneWidget);
    expect(find.text('Your answer'), findsNothing);
    await tester.tap(chip);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q2');
    expect(router.state.uri.queryParameters['count'], '1');
  });

  testWidgets('a balance read from the saved copy is not printed: "You have 40" could be from before this set (v13 walk, finding 4)', (tester) async {
    await pumpResult(
      tester,
      resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), credits: const CreditFigures(ai: 68, practice: 40, stale: true)),
    );
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.textContaining('You have'), findsNothing);
    // The foot's repair cost (Mobi's read carries its own "Fix this one" note above it).
    expect(find.descendant(of: find.byType(ResultFoot), matching: find.text('1 credit.')), findsOneWidget);
  });

  testWidgets('with fresh questions ready the proof fold starts 5 in that chapter for this attempt', (tester) async {
    const replay = ReplayInventory(supported: true, chapters: [ReplayChapter(chapter: 'Admission of a partner', available: true)]);
    final router = await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), replay: replay));
    await tester.pump(const Duration(milliseconds: 900));
    final fold = find.text('Your rule and proof it stuck');
    await bringIn(tester, fold);
    expect(find.text('You went wrong on Admission of a partner. Five new questions on it show whether your fix held.'), findsOneWidget);
    await tester.tap(fold);
    await frames(tester);
    await bringIn(tester, find.widgetWithText(KeyButton, 'Try 5 fresh questions'));
    // A key that has just come into view takes taps after its short lock.
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.widgetWithText(KeyButton, 'Try 5 fresh questions').first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/practice/start');
    expect(router.state.uri.queryParameters, {
      'mode': 'chapter',
      'subject': 'accountancy',
      'count': '5',
      'chapter': 'Admission of a partner',
      'recoveryFrom': 'p1',
    });
  });

  testWidgets('no fresh set ready, or an unsupported subject: no proof fold and no promise', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed), replay: const ReplayInventory(supported: false)));
    await tester.pump(const Duration(milliseconds: 900));
    await tester.scrollUntilVisible(find.text('Every answer, all 10'), 200, scrollable: _page);
    expect(find.text('Your rule and proof it stuck'), findsNothing);
  });

  testWidgets('what this set shows sits in its fold, and Show me opens the question it names', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final fold = find.text('Where the marks went');
    await bringIn(tester, fold);
    expect(find.text('8 of 9 answered were right.'), findsOneWidget);
    await tester.tap(fold);
    await frames(tester);
    await tester.scrollUntilVisible(find.text('One question not attempted'), 200, scrollable: _page);
    expect(find.text('What this set shows'), findsOneWidget);
    expect(find.text('BLANKS'), findsNothing);
  });

  testWidgets('every answer: the sheet and the right answers, nothing lost', (tester) async {
    await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(_mixed)));
    await tester.pump(const Duration(milliseconds: 900));
    final fold = find.text('Every answer, all 10');
    await bringIn(tester, fold);
    expect(find.text('8 right, 1 wrong, 1 blank. Tap a bubble to open its question.'), findsOneWidget);
    await tester.tap(fold);
    await frames(tester);
    // The moment's sheet and the fold's.
    expect(find.byType(NumberedSheet), findsNWidgets(2));
    await tester.scrollUntilVisible(find.text('Right answers (8)'), 200, scrollable: _page);
    expect(find.text('Right answers (8)'), findsOneWidget);
  });

  group('the arrival never waits on a blank band (owner: "it is just loading the score")', () {
    /// The attempt as the submit cached it, before any per-question rows are known.
    Attempt countsOnly() {
      final json = attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed)
        ..remove('details')
        ..remove('questionsSnapshot');
      return Attempt.fromJson(json);
    }

    testWidgets('with nothing on the phone yet, a skeleton shaped like the result waits; no Mobi before it exists', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Reading your sheet'), findsOneWidget);
      expect(find.byType(MobiCharacter), findsNothing);
    });

    testWidgets('a fresh result with the rows in the cache plays at once, without waiting for the result read', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: cached, pending: pending));
      await tester.pump();
      await tester.pump();
      expect(find.byType(FinishStage), findsOneWidget);
      expect(find.text('Reading your sheet'), findsNothing);
      await frames(tester, ms: 2600);
      expect(tester.widget<Text>(find.byKey(const ValueKey('completion-figure'))).data, '39');
    });

    testWidgets('a fresh result without rows waits, then counts the real score from 0 when the rows arrive', (tester) async {
      final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: countsOnly(), pending: pending));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byType(FinishStage), findsNothing);
      expect(find.text('Reading your sheet'), findsOneWidget);
      expect(find.textContaining('Most of this set'), findsNothing);

      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      (container.read(attemptDetailProvider('p1').notifier) as FakeDetail).deliver(detailOf(_mixed));
      await tester.pump();
      await tester.pump();
      expect(find.byType(FinishStage), findsOneWidget);
      expect(tester.widget<FinishStage>(find.byType(FinishStage)).cells, hasLength(10));
      expect(tester.widget<Text>(find.byKey(const ValueKey('completion-figure'))).data, '0');
      await frames(tester, ms: 2600);
      expect(tester.widget<Text>(find.byKey(const ValueKey('completion-figure'))).data, '39');
    });

    testWidgets('opened again later with the rows in the cache, the end state shows at once', (tester) async {
      final cached = Attempt.fromJson(attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: _mixed));
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: cached));
      await tester.pump();
      await tester.pump();
      expect(find.byType(FinishStage), findsOneWidget);
      expect(tester.widget<FinishStage>(find.byType(FinishStage)).fresh, isFalse);
      expect(tester.widget<Text>(find.byKey(const ValueKey('completion-figure'))).data, '39');
    });

    testWidgets('opened again before the rows arrive, nothing empty mounts; the full head then shows at once', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', loading: true, cachedAttempt: countsOnly()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(FinishStage), findsNothing);
      expect(find.text('Reading your sheet'), findsOneWidget);

      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      (container.read(attemptDetailProvider('p1').notifier) as FakeDetail).deliver(detailOf(_mixed));
      await tester.pump();
      await tester.pump();
      final stage = tester.widget<FinishStage>(find.byType(FinishStage));
      expect(stage.cells, hasLength(10));
      expect(stage.fresh, isFalse);
      expect(tester.widget<Text>(find.byKey(const ValueKey('completion-figure'))).data, '39');
    });
  });

  // M4 of the v15 emulator walk: the Quick-set result had none of the full result's new pieces.
  group('a set has what a mock has: Ask Mobi, an Ask line per wrong answer, and Play it back', () {
    final twoWrong = [
      for (var i = 0; i < 6; i++) ('Admission of a partner', V.right),
      ('Admission of a partner', V.wrong),
      ('Goodwill', V.wrong),
      ('Goodwill', V.blank),
      ('Goodwill', V.right),
    ];

    testWidgets('one "Ask Mobi about this set" under the marks, free, and one "Play it back" row', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong)));
      await tester.pump(const Duration(milliseconds: 900));
      expect(find.text('Ask Mobi about this set'), findsOneWidget);
      expect(find.text('Free'), findsWidgets);
      // The foot's volt key is still the one action; the link is a quiet line above the next move.
      final link = tester.getTopLeft(find.text('Ask Mobi about this set')).dy;
      final move = tester.getTopLeft(find.textContaining('Why Q')).dy;
      expect(link, lessThan(move));
      await bringIn(tester, find.byType(PaperReelResultEntry));
      expect(find.byType(PaperReelResultEntry), findsOneWidget);
      expect(find.text('Play it back'), findsOneWidget);
    });

    testWidgets('a wrong answer opens to its one action and, under it, one Ask line; right answers and blanks have none', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong)));
      await tester.pump(const Duration(milliseconds: 900));
      await openMistake(tester, 7);
      expect(find.text('Ask Mobi about Q7'), findsOneWidget);
      expect(find.text('Ask Mobi about Q8'), findsNothing, reason: 'a closed row has none');
      await openMistake(tester, 8);
      expect(find.text('Ask Mobi about Q7'), findsOneWidget);
      expect(find.text('Ask Mobi about Q8'), findsOneWidget);
      expect(find.textContaining('Ask Mobi about Q'), findsNWidgets(2), reason: 'one per wrong answer, never two on one');
      // The blank row (Q9) carries none.
      final blanks = find.text('1 left blank, 5 marks not earned');
      await bringIn(tester, blanks);
      await tester.tap(blanks);
      await frames(tester);
      await bringIn(tester, find.text('Question 9, Not attempted'));
      await tester.tap(find.text('Question 9, Not attempted'));
      await frames(tester);
      expect(find.textContaining('Ask Mobi about Q'), findsNWidgets(2));
    });

    testWidgets('the Ask line sits under the mistake\'s action', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong)));
      await tester.pump(const Duration(milliseconds: 900));
      await openMistake(tester, 7);
      final ask = tester.getTopLeft(find.text('Ask Mobi about Q7')).dy;
      final action = find.byType(MistakeRepairEntry);
      expect(action, findsOneWidget);
      expect(ask, greaterThanOrEqualTo(tester.getBottomLeft(action).dy - 1));
    });

    testWidgets('the Ask line hands Mobi this paper\'s own reference, number, chapter, what was picked and the key', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong)));
      await tester.pump(const Duration(milliseconds: 900));
      await openMistake(tester, 7);
      await bringIn(tester, find.text('Ask Mobi about Q7'));
      await tester.tap(find.text('Ask Mobi about Q7'));
      await tester.pump(const Duration(milliseconds: 300));
      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      final about = container.read(askSheetScopeProvider).effective;
      expect(about.kind, AskMobiKind.question);
      expect(about.question?.number, 7);
      expect(about.question?.ref, 'p1:p1-q7');
      expect(about.question?.chapter, 'Admission of a partner');
      expect(about.question?.pickLetter, isNotNull);
      expect(about.question?.keyLetter, isNotNull);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('the set link hands Mobi where this set\'s marks went, by chapter, from its own counts', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong)));
      await tester.pump(const Duration(milliseconds: 900));
      await bringIn(tester, find.text('Ask Mobi about this set'));
      await tester.tap(find.text('Ask Mobi about this set'));
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(tester.element(find.byType(PracticeResultScreen)));
      final about = container.read(askSheetScopeProvider).effective;
      expect(about.kind, AskMobiKind.mock);
      expect(about.attemptId, 'p1');
      expect(about.label, 'Quick 10');
      // One wrong in Admission of a partner (6 marks), one wrong and one blank in Goodwill (6 + 5): 17 marks lost.
      expect(about.lines, ['Goodwill: 11 of the 17 marks lost, 1 wrong and 1 left blank', 'Admission of a partner: 6 of the 17 marks lost, 1 wrong']);
      await tester.pump(const Duration(seconds: 13));
    });

    testWidgets('while a key is held or keys are unavailable there is no set link and no reel', (tester) async {
      final held = detailOf(twoWrong, reviews: {'p1-q7': {'state': 'under_review'}});
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: held));
      await tester.pump(const Duration(milliseconds: 900));
      expect(find.text('Ask Mobi about this set'), findsNothing);
      expect(find.byType(PaperReelResultEntry), findsNothing);
    });

    testWidgets('unavailable keys: no set link', (tester) async {
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong, state: 'unavailable')));
      await tester.pump(const Duration(milliseconds: 900));
      expect(find.text('Ask Mobi about this set'), findsNothing);
    });

    testWidgets('Play it back opens the reel and ends Today\'s card for this paper', (tester) async {
      final store = MemoryPrefsStore();
      await pumpResult(tester, [...resultOverrides(attemptId: 'p1', detail: detailOf(twoWrong)), reelPrefsStoreProvider.overrideWithValue(store)]);
      await tester.pump(const Duration(milliseconds: 900));
      await bringIn(tester, find.byType(PaperReelResultEntry));
      await tester.tap(find.byType(PaperReelResultEntry));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(PaperReel), findsOneWidget);
      final container = ProviderScope.containerOf(tester.element(find.byType(PaperReel)));
      expect(await container.read(reelSeenProvider.future), {'p1'});
    });
  });

  // 19 Oct baseline walk, finding 29: "Your rule and proof it stuck" named a chapter the student only left blank, while the
  // one wrong answer was in another chapter. The proof is now on the chapter a repair fixes.
  group('the proof names the chapter a repair fixes (walk finding 29)', () {
    final wrongAndBlank = [
      for (var i = 0; i < 8; i++) ('Admission of a partner', V.right),
      ('Admission of a partner', V.wrong),
      ('Comparative statements', V.blank),
    ];

    testWidgets('the server lists the blank chapter first: the fold still names the wrong answer\'s chapter', (tester) async {
      const replay = ReplayInventory(
        supported: true,
        chapters: [
          ReplayChapter(chapter: 'Comparative statements', available: true),
          ReplayChapter(chapter: 'Admission of a partner', available: true),
        ],
      );
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(wrongAndBlank), replay: replay));
      await tester.pump(const Duration(milliseconds: 900));
      final fold = find.text('Your rule and proof it stuck');
      await bringIn(tester, fold);
      expect(find.text('You went wrong on Admission of a partner. Five new questions on it show whether your fix held.'), findsOneWidget);
      expect(find.textContaining('Five new questions on Comparative statements'), findsNothing);
    });

    testWidgets('only the blank chapter has a fresh set: the fold says it was left blank, never "proof it stuck"', (tester) async {
      const replay = ReplayInventory(
        supported: true,
        chapters: [
          ReplayChapter(chapter: 'Admission of a partner', available: false),
          ReplayChapter(chapter: 'Comparative statements', available: true),
        ],
      );
      await pumpResult(tester, resultOverrides(attemptId: 'p1', detail: detailOf(wrongAndBlank), replay: replay));
      await tester.pump(const Duration(milliseconds: 900));
      final fold = find.text('Five fresh questions');
      await bringIn(tester, fold);
      expect(find.text('You left Comparative statements blank. Five new questions on it show where you stand.'), findsOneWidget);
      expect(find.text('Your rule and proof it stuck'), findsNothing);
      await tester.tap(fold);
      await frames(tester);
      await bringIn(tester, find.text('Try the chapter you left blank'));
      expect(find.text('Try the chapter you left blank'), findsOneWidget);
      expect(find.text('Prove the repair'), findsNothing);
    });

    test('provePick: a wrong answer\'s chapter first, in repair order, matched whatever the spacing and case', () {
      const inv = ReplayInventory(
        supported: true,
        chapters: [
          ReplayChapter(chapter: 'Cash Flow Statement', available: true),
          ReplayChapter(chapter: 'Partnership  Fundamentals', available: true),
          ReplayChapter(chapter: 'Goodwill', available: true),
        ],
      );
      expect(provePick(inv, wrongInRepairOrder: ['partnership fundamentals', 'Goodwill'], blankChapters: ['Cash Flow Statement']),
          (chapter: 'Partnership  Fundamentals', ofWrong: true));
      expect(provePick(inv, wrongInRepairOrder: ['Accounting Ratios'], blankChapters: ['Cash Flow Statement']), (chapter: 'Cash Flow Statement', ofWrong: false));
      expect(provePick(inv, wrongInRepairOrder: ['Accounting Ratios'], blankChapters: [null, 'Share Capital']), isNull);
      expect(provePick(null, wrongInRepairOrder: ['Goodwill'], blankChapters: const []), isNull);
    });
  });

  testWidgets("Mobi's read: the reach is this paper's arithmetic, and Fix these opens the repair of exactly those answers", (tester) async {
    final router = await pumpResult(
      tester,
      resultOverrides(
        attemptId: 'p1',
        detail: detailOf([
          ('Goodwill', V.wrong),
          ('Admission of a partner', V.right),
          ('Goodwill', V.wrong),
          ('Admission of a partner', V.right),
          ('Admission of a partner', V.wrong),
          ('Goodwill', V.right),
        ]),
      ),
    );
    await frames(tester, ms: 900);
    final reach = find.byKey(const ValueKey('paper-read-reach'));
    await bringIn(tester, reach);
    // 3 right, 3 wrong: 12. Goodwill's 2 wrong fixed: 24.
    expect(tester.widget<Text>(reach).data, 'Fix the 2 wrong answers in Goodwill and this paper is 24, not 12.');
    final fix = find.byKey(const ValueKey('paper-read-fix'));
    await bringIn(tester, fix);
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(fix);
    await tester.pump(const Duration(milliseconds: 500));
    expect(router.state.uri.path, '/review/repair/p1/p1-q1');
    expect(router.state.uri.queryParameters['count'], '2');
  });
}
