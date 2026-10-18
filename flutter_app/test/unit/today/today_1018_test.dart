// Today 1018 (TODAY-1018 sections 3 to 6, and D26 to D29): the swap, the week's readout and its
// one sliding indicator, Road to CUET at a glance, weak chapters to their mistakes with See repair
// (F17), Change plan's saves, the price line, the paper reel's card, and the D28 fixes.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/logic/move_price.dart';
import 'package:mockmob/features/today/logic/road_board.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/plan_flow_sheet.dart';
import 'package:mockmob/features/today/widgets/reel_hero.dart';
import 'package:mockmob/features/today/widgets/road_glance.dart';
import 'package:mockmob/features/today/widgets/road_section.dart' show RoadActions;
import 'package:mockmob/features/today/widgets/weak_chapters.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

/// Sunday 18 October 2026, 7:40 PM IST.
final DateTime sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek sundayWeek = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

TodayInputs _inputs({List<({String attemptId, DateTime receivedAt})> unopened = const [], Map<String, Set<String>> repaired = const {}, int? reviseDue = 6}) =>
    ashaInputs(now: sunday, attempts: ashaRecord(sunday), week: sundayWeek, reviseDue: reviseDue, unopened: unopened, repaired: repaired);

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

Future<void> _pump(WidgetTester tester, Widget child, {Size size = const Size(412, 2400)}) =>
    pumpMockmob(tester, child, size: size, disableAnimations: true, overrides: _overrides);

Widget _onGround(Widget child) => SingleChildScrollView(padding: const EdgeInsets.all(16), child: child);

void main() {
  setUpAll(loadAppFonts);
  setUp(debugResetTodayPicks);

  group('the lead card and its Suggested stack (6.1, 6.2, D51)', () {
    Finder onTop(String text) => find.descendant(of: find.byKey(SuggestedStack.topKey), matching: find.text(text));

    testWidgets('a suggested card swaps the card in place; the recommended move comes back as Suggested; the week readout follows', (tester) async {
      final view = buildToday(_inputs());
      final events = <Object>[];
      await _pump(tester, TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: events.add, onTarget: events.add)));
      expect(find.text(GlanceCopy.titleRepair), findsOneWidget);
      expect(find.text(GlanceCopy.suggested), findsNothing);
      // Revise is on top; Skip sends it to the back and the weakest chapter comes up.
      expect(onTop(SuggestedCopy.titleRevise), findsOneWidget);
      await tester.tap(onTop(SuggestedCopy.skip));
      await tester.pumpAndSettle();
      expect(onTop(SuggestedCopy.titleWeakest), findsOneWidget);
      await tester.tap(onTop(SuggestedCopy.doThis));
      await tester.pumpAndSettle();
      // The swap writes nothing and starts nothing.
      expect(events, isEmpty);
      expect(find.text(GlanceCopy.titleWeakest), findsOneWidget);
      expect(find.text(GlanceCopy.suggested), findsOneWidget);
      expect(find.textContaining('Up next, your pick'), findsOneWidget);
      expect(find.textContaining('Up next: practise your weakest chapter'), findsOneWidget);
      // The way back is one tap: the recommended move is on top of the deck.
      expect(onTop(GlanceCopy.suggested), findsOneWidget);
      await tester.tap(onTop(SuggestedCopy.doThis));
      await tester.pumpAndSettle();
      expect(find.text(GlanceCopy.titleRepair), findsOneWidget);
      expect(find.text(GlanceCopy.suggested), findsNothing);
    });

    test('the choices are of a different kind from the lead, each with a number in its line', () {
      final view = buildToday(_inputs());
      final lead = view.hero! as MoveHero;
      expect(lead.kind, MoveKind.repair);
      expect(view.choices, hasLength(greaterThanOrEqualTo(2)));
      for (final c in view.choices.take(2)) {
        expect(c.key, isNot('repair'));
        expect(c.hero, isNotNull);
      }
      expect(view.choices.first.line, '6 due, about 10 min');
    });
  });

  group('the week (6.3)', () {
    testWidgets('a day is a button: one indicator slides to it and the readout says that day', (tester) async {
      final view = buildToday(_inputs());
      await _pump(tester, TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})));
      AnimatedAlign indicator() => tester.widget<AnimatedAlign>(find.byType(AnimatedAlign).first);
      expect(indicator().alignment, const Alignment(1, 0), reason: 'today, Sunday, is selected by default');
      expect(find.text('Today, Sunday 18 Oct, planned'), findsOneWidget);
      await tester.ensureVisible(find.text('Thu'));
      await tester.tap(find.text('Thu'));
      await tester.pumpAndSettle();
      expect(find.byType(AnimatedAlign), findsOneWidget, reason: 'one indicator, not seven boxes');
      expect((indicator().alignment as Alignment).x, closeTo(-1 + 2 * 3 / 6, 1e-9));
      expect(find.text('Thursday 15 Oct'), findsOneWidget);
    });
  });

  group('Road to CUET at a glance (D26)', () {
    test('due today leads with what to do, then the study day; the goal agrees with its pace', () {
      final l = buildToday(_inputs()).glance!.road!;
      expect(l.today.first.label, 'Repair 4 mistakes from Mock 7');
      expect(l.today.last.label, GlanceCopy.itemStudyDay);
      expect(l.mockTarget, fortnightTarget(weeks: l.weeks, taken: l.mocksTaken));
      expect(l.mockTarget, l.mocksTaken + (l.weeks / 2).ceil());
      expect(l.pace, 'one a fortnight');
      expect(l.targetSuggested, isTrue);
    });

    testWidgets('it shows due today, due this week and the overall goal in words and numbers', (tester) async {
      final view = buildToday(_inputs());
      await _pump(tester, _onGround(RoadGlance(layers: view.glance!.road!, road: view.road!, onOpen: (_) {})));
      expect(find.text('27'), findsOneWidget);
      expect(find.text(TodayCopy.roadWeeksTo(own: false, n: 27)), findsOneWidget);
      expect(find.text('Expected from Sat 1 May 2027'), findsOneWidget);
      expect(find.text(GlanceCopy.layerToday), findsOneWidget);
      expect(find.text('0 of 3 done'), findsOneWidget);
      expect(find.text('Next: repair 4 mistakes from Mock 7.'), findsOneWidget);
      expect(find.text(GlanceCopy.layerWeek), findsOneWidget);
      expect(find.text('Left: 1 study day by Sun.'), findsOneWidget);
      expect(find.text(GlanceCopy.layerGoal), findsOneWidget);
      final l = view.glance!.road!;
      expect(find.text('${l.mocksTaken} of ${l.mockTarget} full mocks'), findsOneWidget);
      expect(find.textContaining('study days left at 4 a week'), findsOneWidget);
    });

    testWidgets('a layer opens to its items, each a tap from its screen', (tester) async {
      final view = buildToday(_inputs());
      final opened = <TodayTarget>[];
      await _pump(tester, _onGround(RoadGlance(layers: view.glance!.road!, road: view.road!, onOpen: opened.add)));
      await tester.tap(find.byKey(const ValueKey('road-layer-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Repair 4 mistakes from Mock 7'));
      await tester.pumpAndSettle();
      expect(opened, hasLength(1));
      expect((opened.single as GoTo).location, startsWith('/review/repair/m7/'));
    });

    testWidgets('mocks not read yet are said, never shown as 0', (tester) async {
      final inputs = TodayInputs(now: sunday, firstName: 'Asha', attemptsFailed: true, week: sundayWeek);
      final view = buildToday(inputs);
      await _pump(tester, _onGround(RoadGlance(layers: view.glance!.road!, road: view.road!)));
      expect(find.text(GlanceCopy.mocksUnknown), findsOneWidget);
      expect(find.textContaining(RegExp(r'^\d+ of \d+ full mocks')), findsNothing);
    });

    testWidgets('a week that did not load is said, never "0 study days"', (tester) async {
      final view = buildToday(ashaInputs(now: sunday, attempts: ashaRecord(sunday), weekFailed: true));
      await _pump(tester, _onGround(RoadGlance(layers: view.glance!.road!, road: view.road!)));
      expect(find.text(TodayCopy.weekNotRead), findsOneWidget);
      expect(find.textContaining('0 study days'), findsNothing);
    });

    test('one week and one day are said in the singular', () {
      expect(TodayCopy.roadWeeksTo(own: false, n: 1), 'week to CUET UG');
      expect(TodayCopy.roadDaysTo(own: true, n: 1), 'day to your date');
    });
  });

  group('weak chapters (6.5, F17)', () {
    /// Every wrong answer repaired except Mock 7's Q3: the chapter shows one open, two repaired.
    Map<String, Set<String>> mostlyRepaired() {
      final all = repairedAll(ashaRecord(sunday));
      return {...all, 'm7': {...all['m7']!}..remove('m7-q3')};
    }

    test('a repaired mistake opens its saved repair, never a new (paid) one', () {
      final view = buildToday(_inputs(repaired: mostlyRepaired()));
      final rows = view.glance!.weak.rows;
      final mistakes = rows.first.mistakes;
      final repaired = mistakes.firstWhere((m) => m.repaired);
      expect((repaired.target as GoTo).location, AppRoutes.reviewRepair('m7', 'm7-q5'));
      expect(mistakes.where((m) => m.repaired), hasLength(2));
      expect((repaired.target as GoTo).location, isNot(contains('count=')));
      final open = mistakes.firstWhere((m) => !m.repaired);
      expect((open.target as GoTo).location, contains('count=1'));
      // Open ones first, then the repaired one; every stem in full.
      expect(mistakes.first.repaired, isFalse);
      expect(mistakes.every((m) => m.stem.length > 20), isTrue);
    });

    testWidgets('a row opens to its mistakes: Repair for an open one, Repaired and See repair for a repaired one', (tester) async {
      final view = buildToday(_inputs(repaired: mostlyRepaired()));
      await _pump(tester, _onGround(WeakChaptersBlock(weak: view.glance!.weak, onOpen: (_) {})));
      expect(find.text(GlanceCopy.seeRepair), findsNothing);
      await tester.tap(find.text('Partnership fundamentals'));
      await tester.pumpAndSettle();
      expect(find.text(GlanceCopy.repair), findsOneWidget);
      expect(find.text(GlanceCopy.seeRepair), findsNWidgets(2));
      expect(find.text(GlanceCopy.repaired), findsNWidgets(2));
    });
  });

  group('Change plan (6.4, D3)', () {
    TodayView view() => buildToday(_inputs());

    testWidgets('a pace saves its total and says Saved only after the save returns', (tester) async {
      final save = Completer<void>();
      final targets = <int?>[];
      final v = view();
      final actions = RoadActions(
        savePace: (_) async {},
        setExamDate: (_) async {},
        setMockTarget: (n) {
          targets.add(n);
          return save.future;
        },
      );
      await _pump(tester, _onGround(PlanFlowBody(layers: v.glance!.road!, road: v.road!, actions: actions, initialStep: 2, onClose: (_) {})));
      await tester.tap(find.byKey(const ValueKey('plan-pace-week')));
      await tester.pump();
      final l = v.glance!.road!;
      expect(targets, [paceTarget(weeks: l.weeks, taken: l.mocksTaken, weeksPerMock: 1)]);
      expect(find.text(GlanceCopy.saving), findsOneWidget);
      expect(find.text(GlanceCopy.saved), findsNothing);
      save.complete();
      await tester.pumpAndSettle();
      expect(find.text(GlanceCopy.saved), findsOneWidget);
    });

    testWidgets('a failed save says so, keeps the answer unchanged and offers Try again', (tester) async {
      final v = view();
      final actions = RoadActions(savePace: (_) async {}, setExamDate: (_) async {}, setMockTarget: (_) async => throw StateError('offline'));
      await _pump(tester, _onGround(PlanFlowBody(layers: v.glance!.road!, road: v.road!, actions: actions, initialStep: 2, onClose: (_) {})));
      await tester.tap(find.byKey(const ValueKey('plan-pace-month')));
      await tester.pumpAndSettle();
      expect(find.text(GlanceCopy.notSavedMocks), findsOneWidget);
      expect(find.text(GlanceCopy.tryAgain), findsOneWidget);
      expect(find.text(GlanceCopy.saved), findsNothing);
    });

    testWidgets('a saved date leads on to the next question by itself', (tester) async {
      final v = view();
      await _pump(tester, _onGround(PlanFlowBody(layers: v.glance!.road!, road: v.road!, actions: RoadActions(savePace: (_) async {}, setExamDate: (_) async {}, setMockTarget: (_) async {}), onClose: (_) {})));
      expect(find.text(GlanceCopy.askDate), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('plan-date-expected')));
      await tester.pumpAndSettle();
      expect(find.text(GlanceCopy.askDays), findsOneWidget);
    });

    testWidgets('no radio marks: the answers are tiles and the days are bubbles of 44 dp', (tester) async {
      final v = view();
      await _pump(tester, _onGround(PlanFlowBody(layers: v.glance!.road!, road: v.road!, initialStep: 1, onClose: (_) {})));
      expect(find.byType(Radio<Object>), findsNothing);
      expect(find.byType(Checkbox), findsNothing);
      for (final day in TodayCopy.weekdayShort) {
        expect(tester.getSize(find.text(day).first).width, lessThanOrEqualTo(44));
      }
    });

    test('the three paces are what is taken plus what each pace still needs', () {
      expect(paceTarget(weeks: 27, taken: 7, weeksPerMock: 2), 21);
      expect(paceTarget(weeks: 27, taken: 7, weeksPerMock: 1), 34);
      expect(paceTarget(weeks: 27, taken: 7, weeksPerMock: 4.35), 14);
      expect(paceTarget(weeks: 0, taken: 7, weeksPerMock: 2), 8, reason: 'never below taken + 1');
      expect(paceTarget(weeks: 100, taken: 50, weeksPerMock: 1), mockTargetMax);
    });
  });

  group('the price line (section 5, W-060)', () {
    test('a repair says the wallet, Revise is free, practice asks its quote, unknown says nothing', () {
      final view = buildToday(_inputs());
      final lead = view.hero! as MoveHero;
      const credits = AiCredits(state: 'active', wallet: AiWallet(known: true, total: 38));
      expect(priceLine(lead, credits: credits), 'Each repair uses 1 AI credit. You have 38.');
      expect(priceLine(lead), isNull, reason: 'an unknown wallet is not zero');
      final revise = view.choices.firstWhere((c) => c.key == 'revise').hero!;
      expect(priceLine(revise), TodayCopy.priceFree);
      final weakest = view.choices.firstWhere((c) => c.key == 'weakest').hero!;
      final q = quoteQueryFor(weakest)!;
      expect(q.subject, 'accountancy');
      expect(q.apiMode, 'quick');
      expect(priceLine(weakest), isNull, reason: 'no quote yet, no line');
      expect(quoteQueryFor(lead), isNull, reason: 'a repair has no practice quote');
    });

    testWidgets('the line has its place from the first frame, so a late price never moves the key', (tester) async {
      final view = buildToday(_inputs());
      final lead = view.hero! as MoveHero;
      Future<double> keyTop(Map<String, String> prices) async {
        await _pump(tester, TodayBody(view: view, prices: prices, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})));
        return tester.getTopLeft(find.text(SuggestedCopy.title)).dy;
      }

      final without = await keyTop(const {});
      final withPrice = await keyTop({priceKeyOf(lead): TodayCopy.priceRepair(38)});
      expect(find.text(TodayCopy.priceRepair(38)), findsOneWidget);
      expect(withPrice, without);
    });
  });

  group('the paper reel on Today (D29)', () {
    final unopened = [(attemptId: 'm7', receivedAt: sunday.subtract(const Duration(minutes: 3)))];

    test('a fresh paper is the reel card, with its sheet size and no move row under it', () {
      final view = buildToday(_inputs(unopened: unopened));
      final hero = view.hero;
      expect(hero, isA<SealedHero>());
      final sealed = hero! as SealedHero;
      expect(sealed.questions, 50);
      expect(sealed.subject, 'Accountancy');
      expect(sealed.line, isNot(contains('Received')));
      expect(view.also, isEmpty, reason: 'the reel stands alone; the Up next card returns after it');
    });

    testWidgets('one volt key plays it, Not now is one tap, and nothing says marking or opens results directly', (tester) async {
      final view = buildToday(_inputs(unopened: unopened));
      final played = <String>[], skipped = <String>[];
      await _pump(
        tester,
        TodayBody(
          view: view,
          skeletonDelay: Duration.zero,
          callbacks: TodayCallbacks(
            onAction: (_) {},
            onTarget: (_) {},
            onPlayReel: (p) async => played.add(p.attemptId),
            onSkipReel: (p) async => skipped.add(p.attemptId),
          ),
        ),
      );
      expect(find.byType(ReelHeroCard), findsOneWidget);
      expect(find.text(TodayCopy.reelTitle), findsOneWidget);
      expect(find.textContaining('marking'), findsNothing);
      expect(find.text(TodayCopy.openDirectly), findsNothing);
      await tester.tap(find.byKey(const ValueKey('reel-play')));
      await tester.pumpAndSettle();
      expect(played, ['m7']);
      await tester.tap(find.byKey(const ValueKey('reel-later')));
      await tester.pumpAndSettle();
      expect(skipped, ['m7']);
    });
  });

  group('D28', () {
    test('after midnight the greeting never says evening', () {
      for (final h in [0, 1, 2, 3, 4]) {
        expect(TodayCopy.greeting(h, 'Asha'), 'Hello, Asha', reason: '$h');
      }
      expect(TodayCopy.greeting(5, 'Asha'), 'Good morning, Asha');
      expect(TodayCopy.greeting(23, 'Asha'), 'Good evening, Asha');
    });
  });
}
