import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/mistake_insights.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';
import 'package:mockmob/features/review/widgets/mistake_view.dart' show MistakeView;
import 'package:mockmob/features/review/widgets/outcome_views.dart';
import 'package:mockmob/features/review/widgets/repair_mobi.dart' show RepairWaitLine;
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/repair_v3_fixtures.dart';
import 'support/review_fixtures.dart';

Future<void> pumpRepair(WidgetTester tester, List<Override> overrides, {Size size = const Size(384, 2600), String questionId = 'm7-q0'}) => pumpMockmob(
  tester,
  RepairScreen(attemptId: 'm7', questionId: questionId),
  size: size,
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: overrides,
);

double _y(WidgetTester tester, Finder f) => tester.getTopLeft(f.first).dy;

/// The summed opacity of every fade above [child].
double _opacity(Finder child) {
  var o = 1.0;
  for (final e in find.ancestor(of: child, matching: find.byType(FadeTransition)).evaluate()) {
    o *= (e.widget as FadeTransition).opacity.value;
  }
  return o;
}

/// The explanation alone, in the theme, with the motion setting of [reduced].
Future<void> pumpExplanation(WidgetTester tester, Widget explanation, {bool reduced = false}) async {
  tester.view.physicalSize = const Size(384, 2600) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
        // A new key each pump: every call is a screen of its own, with fresh state.
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: KeyedSubtree(key: UniqueKey(), child: explanation),
          ),
        ),
      ),
    ),
  );
}

void main() {
  setUpAll(loadAppFonts);

  group('the payloads parse', () {
    test('a v3 payload carries every new field', () {
      final r = RepairResponse.fromJson(v3Json());
      final e = r.explanation!;
      expect(e.version, 3);
      expect(e.isV3, isTrue);
      expect(e.trapType, 'partly_true');
      expect(e.whyTempting, 'A names the right total sacrifice.');
      expect(e.whyRight, 'Each partner gives up 1/10, so the new ratio is 5:3:2.');
      expect(e.contrast, isNotNull);
      expect(e.others.map((o) => o.index), [2, 3]);
      expect(e.rule, 'Split the sacrifice before you subtract.');
      expect(e.memoryHook, 'Sacrifice first, ratio second.');
      expect(e.anotherWay, isNotNull);
      expect(r.pattern!.line, startsWith('2 of your 3 repaired mistakes'));
      expect(r.pattern!.scope, 'chapter');
      expect((r.pattern!.k, r.pattern!.n, r.pattern!.trapType), (2, 3, 'partly_true'));
    });

    test('a v3 payload without key_idea but with rule parses, and the rule is the idea', () {
      final repair = {...v3Bare()};
      expect(repair.containsKey('key_idea'), isFalse);
      final r = RepairResponse.fromJson({'status': 'explained', 'repair': repair, 'charged': 1});
      expect(r.explanation!.keyIdea, 'Say who gives and who takes before you work.');
      expect(r.explanation!.isV3, isTrue);
    });

    test('a v2 payload reads as version 2 and a v1 payload as version 1', () {
      final v2 = RepairExplanation.fromJson({
        'trap_type': 'partly_true',
        'trap': 'A names the right total.',
        'why_wrong': 'It takes the whole sacrifice.',
        'rule': 'Split before you subtract.',
        'another_way': 'Split first.',
      });
      expect(v2.version, 2);
      expect(v2.isV3, isFalse);
      expect(v2.isV2, isTrue);
      expect(v2.others, isEmpty);
      expect(v2.whyRight, isNull);
      final v1 = RepairResponse.fromJson(explainedJson()).explanation!;
      expect(v1.version, 1);
      expect(v1.isV2, isFalse);
      expect(v1.keyIdea, startsWith('Subtract each partner'));
    });

    test('why_right without a rule is not half a v3 layout', () {
      final e = RepairExplanation.fromJson({'why_tempting': 'a', 'why_wrong': 'b', 'key_idea': 'c', 'why_right': 'd'});
      expect(e.isV3, isFalse);
      expect(e.version, 1);
    });

    test('invalid entries of others are ignored and the rest come in served order', () {
      final e = RepairExplanation.fromJson({
        ...v3Bare(),
        'others': [
          {'index': 3, 'why': 'Last.'},
          'not a map',
          {'why': 'No index.'},
          {'index': -1, 'why': 'Negative.'},
          {'index': 2, 'why': '   '},
          {'index': 2},
          {'index': 0, 'why': 'First.'},
          {'index': 0, 'why': 'Repeats the index.'},
          {'index': 'x', 'why': 'Not a number.'},
        ],
      });
      expect(e.others.map((o) => (o.index, o.why)), [(0, 'First.'), (3, 'Last.')]);
    });

    test('others that is not a list, or is absent, is empty', () {
      expect(RepairExplanation.fromJson({...v3Bare(), 'others': 'nope'}).others, isEmpty);
      expect(RepairExplanation.fromJson(v3Bare()).others, isEmpty);
    });

    test('the pattern is optional and never half a line', () {
      expect(RepairResponse.fromJson(v3Json(pattern: null)).pattern, isNull);
      expect(RepairResponse.fromJson(v3Json(pattern: 'x')).pattern, isNull);
      expect(RepairResponse.fromJson(v3Json(pattern: {'line': '  ', 'scope': 'chapter'})).pattern, isNull);
      expect(RepairResponse.fromJson(v3Json(pattern: {'k': 2})).pattern, isNull);
      final lineOnly = RepairResponse.fromJson(v3Json(pattern: {'line': '3 of your 8 repaired English mistakes had the same trap: a look-alike term.'}));
      expect(lineOnly.pattern!.line, startsWith('3 of your 8'));
      expect(lineOnly.pattern!.scope, isNull);
    });

    test('a stored v3 payload parses the same way, with no charge', () {
      final r = RepairResponse.fromJson({
        ...v3Json(status: 'stored', charged: 0),
        'wallet': null,
      });
      expect(r.status, RepairStatus.stored);
      expect(r.explanation!.isV3, isTrue);
      expect(r.charged, 0);
      expect(r.wallet, isNull);
    });
  });

  group('the fine print', () {
    String? fine(Map<String, dynamic> json, {bool reopened = false}) => MistakeView.finePrint(RepairResponse.fromJson(json), reopened: reopened);

    test('a fresh repair says what it cost and what is left', () {
      expect(fine(v3Json()), '1 credit used. 43 left.');
    });

    test('a saved repair opened again is free', () {
      expect(fine(v3Json(status: 'stored', charged: 0)), 'Saved repair. No credit used.');
      expect(fine(v3Json(), reopened: true), 'Saved repair. No credit used.');
    });

    test('a charge with no balance leaves the balance out, and an unknown charge says nothing', () {
      expect(fine({...v3Json(), 'wallet': null}), '1 credit used.');
      expect(fine(v3Json(charged: 0)), 'No credit used.');
      expect(fine(v3Json(charged: null)), isNull, reason: 'a missing charge is unknown, never "none"');
    });

    test('a wallet that does not know its balance is not shown as a number', () {
      final r = RepairResponse.fromJson({
        ...v3Json(),
        'wallet': {'known': false, 'spendable': 0},
      });
      expect(MistakeView.finePrint(r, reopened: false), '1 credit used.');
    });
  });

  group('the v3 layout', () {
    final insights = v3Insights();

    testWidgets('every block is there, in the order of the screen spec', (tester) async {
      final api = NoCallRepairApi();
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json()), insights: insights, api: api));
      final order = <String>[
        'A partly true option',
        'Explained from the answer key (B).',
        'Why A looked right',
        'Where it breaks',
        'Why B is right',
        'If C took 1/5 from A alone, A would fit. Here both give, so B.',
        'The other options (2)',
        'Keep this',
        'To remember it: Sacrifice first, ratio second.',
        'Explain it another way',
        'From your record',
        'You first chose B here, then changed to A.',
        '41s on this question. Your median in this paper was 55s over 48 timed questions.',
        'Partnership so far: 7 right of 12 answered across 3 papers, this one included.',
        '2 of your 3 repaired mistakes in Partnership had the same trap: a partly true option.',
        'This answer cost 6 marks in this session: 5 not earned and 1 penalty.',
        'Practise 5 on Partnership',
        '1 credit used. 43 left.',
      ];
      var last = -1.0;
      for (final text in order) {
        expect(find.text(text), findsOneWidget, reason: text);
        final y = _y(tester, find.text(text));
        expect(y, greaterThan(last), reason: '"$text" comes after the block before it');
        last = y;
      }
      // The v1 words and the model's own next step are gone from a v3 repair.
      expect(find.text('What happened here'), findsNothing);
      expect(find.text('Next time'), findsNothing);
      expect(find.text('Another way to see it'), findsNothing, reason: 'the second explanation waits for its button');
      expect(api.calls, 0);
    });

    testWidgets('the other options are closed until asked for, in served order, none of them the pick or the key', (tester) async {
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json())));
      expect(find.text('It hands C the wrong share.'), findsNothing);
      expect(find.text('C.'), findsNothing);
      expect(find.bySemanticsLabel('The other options (2), collapsed'), findsOneWidget);
      await tester.tap(find.text('The other options (2)'));
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('The other options (2), expanded'), findsOneWidget);
      expect(find.text('C.'), findsOneWidget);
      expect(find.text('D.'), findsOneWidget);
      expect(find.text('A.'), findsNothing, reason: 'A is the pick');
      expect(find.text('B.'), findsNothing, reason: 'B is the key');
      expect(find.text('It hands C the wrong share.'), findsOneWidget);
      expect(_y(tester, find.text('C.')), lessThan(_y(tester, find.text('D.'))));
      expect(find.bySemanticsLabel('Option C. It hands C the wrong share.'), findsOneWidget);
      // And closes again.
      await tester.tap(find.text('The other options (2)'));
      await tester.pumpAndSettle();
      expect(find.text('It hands C the wrong share.'), findsNothing);
    });

    testWidgets('a row for the pick or the key, or for a letter the question does not have, is not shown', (tester) async {
      final repair = {
        ...(v3Json()['repair'] as Map<String, dynamic>),
        'others': [
          {'index': 0, 'why': 'This is the pick.'},
          {'index': 1, 'why': 'This is the key.'},
          {'index': 2, 'why': 'It hands C the wrong share.'},
          {'index': 9, 'why': 'There is no tenth option.'},
        ],
      };
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json(repair: repair))));
      expect(find.text('The other options (4)'), findsNothing, reason: 'the count is of the rows that can be shown');
      expect(find.text('The other options (1)'), findsOneWidget);
      await tester.tap(find.text('The other options (1)'));
      await tester.pumpAndSettle();
      expect(find.text('It hands C the wrong share.'), findsOneWidget);
      expect(find.text('This is the pick.'), findsNothing);
      expect(find.text('This is the key.'), findsNothing);
      expect(find.text('There is no tenth option.'), findsNothing);
    });

    testWidgets('"Explain it another way" shows the second explanation in place, free, with no call', (tester) async {
      final api = NoCallRepairApi();
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json()), api: api));
      const second = 'Picture C paying each partner one tenth of the firm.';
      expect(find.text(second), findsNothing);
      expect(find.text('Another way to see it'), findsNothing);
      final recordY = _y(tester, find.text('From your record'));
      await tester.tap(find.widgetWithText(KeyButton, 'Explain it another way'));
      await tester.pumpAndSettle();
      expect(api.calls, 0, reason: 'the second explanation came with the first: no call, no credit');
      expect(find.text('Another way to see it'), findsOneWidget);
      expect(find.text(second), findsOneWidget);
      expect(find.text('Explain it another way'), findsNothing, reason: 'the button goes away once it has been used');
      // It opened where the button was: above what follows, below the rule.
      expect(_y(tester, find.text('Another way to see it')), greaterThan(_y(tester, find.text('Keep this'))));
      expect(_y(tester, find.text('Another way to see it')), lessThan(_y(tester, find.text('1 credit used. 43 left.'))));
      expect(tester.takeException(), isNull);
      // Focus went to the heading that replaced the button.
      expect(FocusManager.instance.primaryFocus?.debugLabel, 'another way heading');
      expect(recordY, isNotNull);
    });

    testWidgets('the optional blocks that are absent render nothing, not an empty heading', (tester) async {
      await pumpRepair(tester, v3Overrides(v3Outcome({...v3Json(repair: v3Bare(), pattern: null), 'charged': 1})));
      expect(find.text('A turns the relation around.'), findsOneWidget);
      expect(find.text('The relation turned around'), findsOneWidget);
      expect(find.text('Explained from the answer key (B).'), findsOneWidget);
      expect(find.text('Why B is right'), findsOneWidget);
      expect(find.text('Keep this'), findsOneWidget);
      // No contrast, no other options, no memory hook, no second explanation, no record.
      expect(find.textContaining('The other options'), findsNothing);
      expect(find.textContaining('To remember it'), findsNothing);
      expect(find.text('Explain it another way'), findsNothing);
      expect(find.text('Another way to see it'), findsNothing);
      expect(find.text('From your record'), findsNothing);
      expect(find.text('Next time'), findsNothing);
    });

    testWidgets('From your record lists the server lines in order, then the pattern', (tester) async {
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json(pattern: null)), insights: insights));
      expect(find.text('From your record'), findsOneWidget);
      expect(find.textContaining('first chose B'), findsOneWidget);
      expect(find.textContaining('same trap'), findsNothing, reason: 'no pattern in this answer');
    });

    testWidgets('the pattern alone is a record line', (tester) async {
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json())));
      expect(find.text('From your record'), findsOneWidget);
      expect(find.textContaining('same trap'), findsOneWidget);
    });

    testWidgets('with no lines and no pattern there is no From your record', (tester) async {
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json(pattern: null))));
      expect(find.text('From your record'), findsNothing);
    });

    testWidgets('the pattern is not said twice when a record line already says it', (tester) async {
      const line = '2 of your 3 repaired mistakes in Partnership had the same trap: a partly true option.';
      final dup = {
        'm7-q0': MistakeInsights.fromJson({
          'lines': [
            {'kind': 'pattern', 'text': line},
          ],
        }),
      };
      await pumpRepair(tester, v3Overrides(v3Outcome(v3Json()), insights: dup));
      expect(find.text(line), findsOneWidget);
    });

    testWidgets('a saved repair is shown at once with its record and "Saved repair. No credit used."', (tester) async {
      final second = runOf().steps[1].item.questionId;
      final stored = v3Outcome(v3Json(status: 'stored', charged: 0), reopened: true);
      await pumpRepair(
        tester,
        v3Overrides(
          stored,
          before: [explained],
          insights: {
            second: MistakeInsights.fromJson({
              'lines': [
                {'kind': 'repeat_same', 'text': 'You chose the same option when you missed this in Mock 2 on 9 Oct.'},
              ],
            }),
          },
        ),
        questionId: second,
      );
      expect(find.text('Saved repair. No credit used.'), findsOneWidget);
      expect(find.text('From your record'), findsOneWidget);
      expect(find.text('You chose the same option when you missed this in Mock 2 on 9 Oct.'), findsOneWidget);
      expect(find.text('Explained from the answer key (B).'), findsOneWidget);
      expect(_opacity(find.text('Where it breaks')), 1, reason: 'a saved repair is not staggered in');
    });

    testWidgets('a v1 repair keeps its layout, with the fine print and no chip', (tester) async {
      await pumpRepair(tester, v3Overrides(explained));
      expect(find.text('What happened here'), findsOneWidget);
      expect(find.text('The idea'), findsOneWidget);
      expect(find.text('Next time'), findsOneWidget);
      expect(find.textContaining('Explained from the answer key'), findsNothing);
      expect(find.textContaining('The other options'), findsNothing);
      expect(find.text('Explain it another way'), findsNothing);
      expect(find.text('1 credit used. 8 left.'), findsOneWidget);
    });

    testWidgets('a v2 repair keeps its layout and gains the chip', (tester) async {
      final v2 = v3Outcome({
        'status': 'explained',
        'repair': {
          'trap_type': 'partly_true',
          'trap': 'A names the right total sacrifice.',
          'why_wrong': 'It takes the whole sacrifice from each partner.',
          'another_way': 'Split the sacrifice first, then subtract.',
          'contrast': 'If C took 1/5 from A alone, A would be right. Here both give, so B.',
          'rule': 'Split the sacrifice before you subtract.',
        },
        'charged': 1,
        'chosenIndex': 0,
        'keyIndex': 1,
      });
      await pumpRepair(tester, v3Overrides(v2));
      expect(find.text('A partly true option'), findsOneWidget);
      expect(find.text('Explained from the answer key (B).'), findsOneWidget);
      expect(find.text('Another way to see it'), findsOneWidget, reason: 'a v2 repair shows it, as before');
      expect(find.text('Explain it another way'), findsNothing);
      expect(find.text('Why B is right'), findsNothing);
      expect(find.text('What happened here'), findsNothing);
    });

    testWidgets('lays out at 200% text on a 360 by 640 phone, closed and open', (tester) async {
      await pumpMockmob(
        tester,
        const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
        size: const Size(360, 640),
        textScale: 2,
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: v3Overrides(v3Outcome(v3Json()), insights: insights),
      );
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('The other options (2)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('The other options (2)'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('the arrival', () {
    final explanation = RepairResponse.fromJson(v3Json()).explanation!;

    Widget shown({bool animate = true}) => WorkedExplanation(
      explanation: explanation,
      chosenLetter: 'A',
      keyLetter: 'B',
      letterOf: (i) => const ['A', 'B', 'C', 'D'][i],
      recordLines: const ['41s on this question. Your median in this paper was 55s over 48 timed questions.'],
      animate: animate,
    );

    testWidgets('a fresh repair arrives block by block and the rule card settles once', (tester) async {
      await pumpExplanation(tester, shown());
      await tester.pump();
      // At the first frame the first block is on its way in and the last has not begun.
      expect(_opacity(find.text('Where it breaks')), lessThan(1));
      expect(_opacity(find.text('From your record')), lessThan(0.05));
      final scale = (find.ancestor(of: find.text('Keep this'), matching: find.byType(ScaleTransition)).evaluate().first.widget as ScaleTransition);
      expect(scale.scale.value, closeTo(0.98, 0.001));
      // The blocks land in order: an earlier one is further along than a later one.
      await tester.pump(const Duration(milliseconds: 200));
      expect(_opacity(find.text('Where it breaks')), greaterThan(_opacity(find.text('From your record'))));
      await tester.pump(const Duration(milliseconds: 1500));
      expect(_opacity(find.text('Where it breaks')), 1);
      expect(_opacity(find.text('From your record')), 1);
      expect(scale.scale.value, closeTo(1, 0.001));
    });

    testWidgets('a saved repair and a reduced-motion repair are simply there', (tester) async {
      await pumpExplanation(tester, shown(animate: false));
      await tester.pump();
      expect(_opacity(find.text('Where it breaks')), 1);
      expect(_opacity(find.text('From your record')), 1);
      expect(find.ancestor(of: find.text('Keep this'), matching: find.byType(ScaleTransition)), findsNothing);

      await pumpExplanation(tester, shown(), reduced: true);
      await tester.pump();
      expect(_opacity(find.text('Where it breaks')), 1);
      expect(_opacity(find.text('From your record')), 1);
      final scale = (find.ancestor(of: find.text('Keep this'), matching: find.byType(ScaleTransition)).evaluate().first.widget as ScaleTransition);
      expect(scale.scale.value, 1);
    });

    testWidgets('a repair that has arrived is not staggered in again when it is shown again', (tester) async {
      resetRepairArrivals();
      addTearDown(resetRepairArrivals);
      Widget again() => WorkedExplanation(
        explanation: explanation,
        chosenLetter: 'A',
        keyLetter: 'B',
        letterOf: (i) => const ['A', 'B', 'C', 'D'][i],
        arrivalKey: 'm7/m7-q0/req-v3',
      );
      await pumpExplanation(tester, again());
      await tester.pump();
      expect(_opacity(find.text('Where it breaks')), lessThan(1), reason: 'the first time it arrives');
      await tester.pump(const Duration(seconds: 2));
      // Gone from the screen (another mistake) and back: it is simply there.
      await pumpExplanation(tester, const SizedBox());
      await pumpExplanation(tester, again());
      await tester.pump();
      expect(_opacity(find.text('Where it breaks')), 1);
      expect(find.ancestor(of: find.text('Keep this'), matching: find.byType(ScaleTransition)), findsNothing);
    });

    testWidgets('opening the other options and the second explanation move nothing under reduced motion', (tester) async {
      await pumpExplanation(tester, shown(), reduced: true);
      await tester.pump();
      await tester.tap(find.text('The other options (2)'));
      await tester.pump();
      expect(find.text('It hands C the wrong share.'), findsOneWidget, reason: 'there at once, with no frame of growth');
      await tester.tap(find.widgetWithText(KeyButton, 'Explain it another way'));
      await tester.pump();
      expect(find.text('Explain it another way'), findsNothing);
      expect(find.text('Another way to see it'), findsOneWidget);
    });
  });

  group('the wait', () {
    const writing = 'Writing the repair for Q1.';
    const still = 'Still writing. You are charged only if it arrives.';
    const longer = 'Taking longer than usual. Still trying.';

    /// The visible wait words on screen: there is only ever one.
    List<String> waitWords() => [
      for (final s in [writing, still, longer])
        if (find.text(s).evaluate().isNotEmpty) s,
    ];

    Future<void> pumpWait(WidgetTester tester, {List<Override> extra = const []}) => pumpMockmob(
      tester,
      const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
      size: const Size(384, 2400),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: [...reviewOverrides(records: [repairedRecord], run: runOf(outcomes: [const OutcomeLoading()])), ...extra],
    );

    testWidgets('is ONE line that changes, with the website\'s words at 8 and 45 seconds', (tester) async {
      await pumpWait(tester);
      expect(waitWords(), [writing]);
      expect(find.text('Working out the explanation'), findsNothing);
      await tester.pump(const Duration(seconds: 7));
      expect(waitWords(), [writing]);
      await tester.pump(const Duration(seconds: 1, milliseconds: 100));
      expect(waitWords(), [still], reason: 'replaced at 8 s, not added under a label');
      expect(find.text('Still working on this one'), findsNothing);
      await tester.pump(const Duration(seconds: 36));
      expect(waitWords(), [still], reason: '44 seconds in');
      await tester.pump(const Duration(seconds: 2));
      expect(waitWords(), [longer], reason: 'replaced again at 45 s');
      expect(find.byType(RepairWaitLine), findsOneWidget);
    });

    testWidgets('the line is a live region and the placeholder says nothing of its own', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpWait(tester);
      expect(find.bySemanticsLabel(writing), findsOneWidget, reason: 'heard once, from the line, not again from the skeleton');
      expect(tester.getSemantics(find.byType(RepairWaitLine)), isSemantics(label: writing, isLiveRegion: true));
      await tester.pump(const Duration(seconds: 8, milliseconds: 100));
      expect(find.bySemanticsLabel(writing), findsNothing, reason: 'no stale "Writing" label left behind');
      expect(find.bySemanticsLabel(still), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('changes the same way with Mobi hidden (celebration off): the words are not Mobi\'s', (tester) async {
      await pumpMockmob(
        tester,
        const RepairScreen(attemptId: 'm7', questionId: 'm7-q0'),
        size: const Size(384, 2400),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(records: [repairedRecord], run: runOf(outcomes: [const OutcomeLoading()]), celebration: CelebrationMode.off),
      );
      expect(waitWords(), [writing]);
      await tester.pump(const Duration(seconds: 8, milliseconds: 100));
      expect(waitWords(), [still]);
      await tester.pump(const Duration(seconds: 37));
      expect(waitWords(), [longer]);
    });

    test('lineFor matches the website\'s repairLoadingLine and REPAIR_LOADING timings', () {
      expect(RepairWaitLine.slowAfter, const Duration(milliseconds: 8000), reason: 'REPAIR_LOADING.slowAfterMs');
      expect(RepairWaitLine.longAfter, const Duration(milliseconds: 45000), reason: 'REPAIR_LOADING.longAfterMs');
      expect(RepairWaitLine.lineFor(Duration.zero, 7), 'Writing the repair for Q7.');
      expect(RepairWaitLine.lineFor(const Duration(milliseconds: 7999), 7), 'Writing the repair for Q7.');
      expect(RepairWaitLine.lineFor(const Duration(seconds: 8), 7), still);
      expect(RepairWaitLine.lineFor(const Duration(milliseconds: 44999), 7), still);
      expect(RepairWaitLine.lineFor(const Duration(seconds: 45), 7), longer);
      // The website's own source holds the same strings and timings.
      final web = File('../../wt-web-refine/data/repair_presentation.mjs');
      if (web.existsSync()) {
        final source = web.readAsStringSync();
        expect(source, contains('slowAfterMs: 8000'));
        expect(source, contains('longAfterMs: 45000'));
        expect(source, contains("`Writing the repair for Q\${number}.`"));
        expect(source, contains("slow: '$still'"));
        expect(source, contains("long: '$longer'"));
      }
    });
  });

  group('the words', () {
    // Every string this build adds, in the shapes the screen uses.
    final spoken = <String>[
      ReviewCopy.explainedFromKey('D'),
      ReviewCopy.explainedFromKey(null),
      ReviewCopy.whyRight('D'),
      ReviewCopy.whyRight(null),
      ReviewCopy.otherOptions,
      ReviewCopy.otherOptionsCount(2),
      ReviewCopy.otherOptionsOpen(2),
      ReviewCopy.otherOptionsClosed(2),
      ReviewCopy.otherOptionSpoken('A', 'It reverses the ratio.'),
      ReviewCopy.toRememberIt('Sacrifice first.'),
      ReviewCopy.explainAnotherWay,
      ReviewCopy.fromYourRecord,
      ReviewCopy.savedRepairNoCredit,
      ReviewCopy.noCreditUsed,
      ReviewCopy.creditsUsed(1, 43),
      ReviewCopy.creditsUsed(1, null),
      ReviewCopy.writingRepair(7),
      ReviewCopy.stillWriting,
      ReviewCopy.takingLonger,
    ];

    test('say what the website says', () {
      expect(ReviewCopy.explainedFromKey('D'), 'Explained from the answer key (D).');
      expect(ReviewCopy.writingRepair(7), 'Writing the repair for Q7.');
      expect(ReviewCopy.stillWriting, 'Still writing. You are charged only if it arrives.');
      expect(ReviewCopy.takingLonger, 'Taking longer than usual. Still trying.');
      expect(ReviewCopy.creditsUsed(1, 43), '1 credit used. 43 left.');
      expect(ReviewCopy.savedRepairNoCredit, 'Saved repair. No credit used.');
    });

    test('have no exclamation mark, em or en dash, or middle dot', () {
      for (final s in spoken) {
        expect(s, isNot(contains('!')), reason: s);
        expect(s, isNot(contains('—')), reason: s);
        expect(s, isNot(contains('–')), reason: s);
        expect(s, isNot(contains('·')), reason: s);
      }
    });

    test('no string in copy.dart has an exclamation mark, an em dash, an en dash or a middle dot', () {
      final source = File('lib/features/review/copy.dart').readAsStringSync();
      final code = source.split('\n').where((l) => !l.trimLeft().startsWith('//')).join('\n');
      final literal = RegExp('\'(?:[^\'\\\\\\n]|\\\\.)*\'|"(?:[^"\\\\\\n]|\\\\.)*"');
      final literals = literal.allMatches(code).map((m) => m.group(0)!).toList();
      expect(literals.length, greaterThan(100), reason: 'the scan found the strings');
      for (final s in literals) {
        expect(s, isNot(contains('!')), reason: s);
        expect(s, isNot(contains('—')), reason: s);
        expect(s, isNot(contains('–')), reason: s);
        expect(s, isNot(contains('·')), reason: s);
      }
    });
  });
}
