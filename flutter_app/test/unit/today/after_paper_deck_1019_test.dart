// 19 Oct, the fresh-account walk's findings for Today. After the first paper the lead card is the
// paper's reel ("Play your paper back") and the deck used to vanish: a student with one paper still
// has at least four real cards, under the reel, and a card picked there replaces the reel in the
// lead while the paper waits in a row under it. The fresh "Weak chapters" block has a key that
// starts where it says to start. The first check's card no longer says "starting point" twice.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/starter_cards.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/also_slots.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';
import 'package:mockmob/features/today/widgets/reel_hero.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';
import 'package:mockmob/features/today/widgets/weak_chapters.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek _week = TodayWeek(
  studied: [false, false, false, false, false, false, false],
  todayIndex: 6,
  label: '0 of 4 study days',
  goal: 4,
  planned: {0, 2, 4, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

/// The walk's account: one Quick 10 in Accountancy (2 right, 1 wrong, 7 blank), three hours ago.
List<Attempt> _onePaper() => [
      paper(
        id: 'q1',
        subject: 'accountancy',
        mode: 'quick',
        completedAt: _sunday.subtract(const Duration(hours: 3)),
        runs: const [('Partnership', V.right, 2), ('Partnership', V.wrong, 1), ('Partnership', V.blank, 7)],
      ),
    ];

const TodayProfile _profile = TodayProfile(
  weakestSubject: 'accountancy',
  weakestRated: 'accountancy',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
);

TodayView _view({required bool reel, List<Attempt>? attempts, bool mob = true}) => buildToday(ashaInputs(
      now: _sunday,
      attempts: attempts ?? _onePaper(),
      week: _week,
      mobInvite: mob,
      profile: _profile,
      unopened: reel ? [(attemptId: 'q1', receivedAt: _sunday.subtract(const Duration(minutes: 3)))] : const [],
    ));

List<String> _keys(TodayView v) => [for (final c in v.choices) c.key];

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

Future<void> _pump(WidgetTester tester, TodayView view, {Size size = const Size(412, 2400)}) async {
  await pumpMockmob(
    tester,
    TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
    size: size,
    disableAnimations: true,
    overrides: _overrides,
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    debugResetTodayPicks();
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = MemoryPrefsStore();
    DeckMemoryStore.store = MemoryPrefsStore();
    DeckMemoryStore.clock = () => _sunday;
    DeckCoach.debugRun = DeckCoachRun.taught();
  });
  tearDown(() {
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = null;
    DeckMemoryStore.store = null;
  });

  group('the deck after the first paper (the walk\'s HIGH: it disappeared)', () {
    test('with the reel in the lead card, one paper still gives at least four real cards, none twice', () {
      final v = _view(reel: true);
      expect(v.hero, isA<SealedHero>());
      expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: _keys(v).join(', '));
      expect(_keys(v).toSet().length, v.choices.length, reason: 'no kind twice: ${_keys(v).join(', ')}');
      expect(v.choices.every((c) => c.hero != null || c.action != null), isTrue);
      final deck = buildSuggestedDeck(v.choices, glance: v.glance);
      expect(deck.length, v.choices.length);
      expect(deck.length, lessThanOrEqualTo(deckSize));
    });

    test('the reel played or put off: the move leads and its deck still has at least four cards', () {
      final v = _view(reel: false);
      expect(v.hero, isA<MoveHero>());
      expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: _keys(v).join(', '));
      expect(_keys(v).toSet().length, v.choices.length);
    });

    test('one paper, all right: no repair and no weak chapter, and the deck is still four or more', () {
      final one = [paper(id: 'q1', subject: 'english', mode: 'quick', completedAt: _sunday.subtract(const Duration(hours: 3)), runs: const [('Reading', V.right, 10)])];
      for (final reel in [true, false]) {
        final v = _view(reel: reel, attempts: one);
        expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: 'reel $reel: ${_keys(v).join(', ')}');
      }
    });

    test('a record with plenty of its own cards keeps them, first and in order', () {
      final v = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), reviseDue: 6, mobInvite: true));
      expect(_keys(v).take(3), ['revise', 'weakest', 'other']);
      expect(v.choices.length, greaterThanOrEqualTo(deckMinimum));
    });

    testWidgets('the deck is on screen under the reel, with its count and its first card', (tester) async {
      final view = _view(reel: true);
      await _pump(tester, view);
      expect(find.byType(ReelHeroCard), findsOneWidget);
      expect(find.text(SuggestedCopy.title), findsOneWidget);
      expect(find.byKey(SuggestedStack.topKey), findsOneWidget);
      expect(find.text(SuggestedCopy.upNext), findsWidgets);
    });

    testWidgets('Do this next on a card puts it where the reel stood, and the paper waits in a row under it; Undo brings the reel back', (tester) async {
      final view = _view(reel: true);
      await _pump(tester, view);
      expect(find.byType(MoveHeroCard), findsNothing);
      expect(find.text(TodayCopy.openSheet), findsNothing);
      await tester.tap(find.byKey(SuggestedStack.upNextKey));
      await tester.pumpAndSettle();
      expect(find.byType(ReelHeroCard), findsNothing, reason: 'the card took the lead from the reel');
      expect(find.byType(MoveHeroCard), findsOneWidget);
      // Nothing silently disappears: the paper is a row under the lead, with its own key.
      expect(find.byType(AlsoSlots), findsOneWidget);
      expect(find.text(TodayCopy.openSheet), findsWidgets);
      // The picked card left the deck, and the others stayed.
      expect(find.text(SuggestedCopy.title), findsOneWidget);
      final undo = find.text(SuggestedCopy.undo);
      expect(undo, findsWidgets);
      await tester.tap(undo.first);
      await tester.pumpAndSettle();
      expect(find.byType(ReelHeroCard), findsOneWidget);
      expect(find.text(TodayCopy.openSheet), findsNothing);
    });

    testWidgets('every card seen under the reel: the end card says the paper is still waiting, not that the card above is a pick', (tester) async {
      final view = _view(reel: true);
      await _pump(tester, view);
      for (var k = 0; k < view.choices.length; k++) {
        await tester.tap(find.byKey(SuggestedStack.notNowKey));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 600));
      }
      await tester.pumpAndSettle();
      expect(find.text(SuggestedCopy.endReel), findsOneWidget);
      expect(find.text(SuggestedCopy.endOurPick), findsNothing);
      expect(find.text(SuggestedCopy.endYourPick), findsNothing);
    });
  });

  group('the fresh "Weak chapters" block has an action', () {
    TodayView fresh({String subject = 'accountancy'}) => buildToday(ashaInputs(
          now: _sunday,
          attempts: const [],
          week: _week,
          subjects: [subject],
          profile: TodayProfile(weakestSubject: subject, subjects: [subject]),
        ));

    test('day one names where to start and carries the route that starts there', () {
      final w = fresh().glance!.weak;
      expect(w.dayOne, isTrue);
      expect(w.startChapters.first, 'Partnership');
      final target = w.startPractise! as GoTo;
      final uri = Uri.parse(target.location);
      expect(uri.queryParameters['mode'], 'chapter');
      expect(uri.queryParameters['subject'], 'accountancy');
      expect(uri.queryParameters['chapter'], 'Partnership');
      expect(uri.queryParameters['count'], '10');
      expect(GlanceCopy.weakDayOneKey('Partnership'), 'Practise Partnership, 10 questions');
    });

    test('a subject MockMob does not rank has no key to offer', () {
      final w = fresh(subject: 'history').glance!.weak;
      expect(w.startChapters, isEmpty);
      expect(w.startPractise, isNull);
    });

    for (final (scale, width) in [(1.0, 360.0), (1.3, 360.0), (1.3, 412.0)]) {
      testWidgets('the key shows, whole, and starts the chapter at ${width.toInt()} dp, ${scale}x', (tester) async {
        final targets = <TodayTarget>[];
        await pumpMockmob(
          tester,
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: WeakChaptersBlock(weak: fresh().glance!.weak, onOpen: targets.add),
          ),
          size: Size(width, 700),
          textScale: scale,
          disableAnimations: true,
        );
        await tester.pumpAndSettle();
        expect(find.text(GlanceCopy.weakDayOneStart(const ['Partnership', 'Company Accounts'])), findsOneWidget);
        final key = find.byKey(WeakChaptersBlock.dayOneKey);
        expect(key, findsOneWidget);
        expect(find.text('Practise Partnership, 10 questions'), findsOneWidget);
        expect(tester.getSize(key).width, lessThanOrEqualTo(width - 32));
        await tester.tap(key);
        expect(targets, hasLength(1));
        expect((targets.single as GoTo).location, contains('chapter=Partnership'));
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('a long chapter name wraps inside the key instead of overflowing at 360 dp and 1.3x', (tester) async {
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: WeakChaptersBlock(
            weak: const WeakChapters(
              dayOne: true,
              startChapters: ['Biotechnology and its Applications', 'Human Health and Disease'],
              startPractise: GoTo('/practice/start?mode=chapter'),
            ),
            onOpen: (_) {},
          ),
        ),
        size: const Size(360, 700),
        textScale: 1.3,
        disableAnimations: true,
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byKey(WeakChaptersBlock.dayOneKey)).width, lessThanOrEqualTo(360 - 32));
    });
  });

  group('the first check and the after-sign-in sheet', () {
    test('the fresh lead says "starting point" once: the title has it, the number\'s label names the subject', () {
      final v = buildToday(ashaInputs(
        now: _sunday,
        attempts: const [],
        week: _week,
        profile: _profile,
      ));
      final lead = v.hero! as MoveHero;
      expect(lead.title, GlanceCopy.titleStart);
      expect(lead.numberLabel, 'questions in\nAccountancy');
      expect('${lead.title} ${lead.numberLabel}'.toLowerCase().split('starting point').length - 1, 1);
    });

    test('the deck line on the sheet after sign-in tells the student what to do, in whole sentences', () {
      final line = OnboardingCopy.swipePreviewCaption;
      expect(line, 'Swipe a card right to do it next, or left to skip it for now. The buttons do the same.');
      expect(OnboardingCopy.swipePreviewRight, SuggestedCopy.upNext, reason: 'the preview stamps the deck\'s own words');
      expect(OnboardingCopy.swipePreviewLeft, SuggestedCopy.notNow);
    });
  });
}
