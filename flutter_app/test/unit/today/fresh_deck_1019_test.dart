// 19 Oct (G12, G7, rule R1: fresh account first). The suggested deck of a brand-new account is
// built from its subjects alone, so it never shows one lonely card: at least four real cards for one,
// three or five subjects, in the planned order (the weakest subject's quick 10, a full mock in the
// first domain subject, English, the Mob, another subject). Its words are whole sentences. Today's
// colleges are the three hardest to get into, labelled "Your top 3 of N", with "See all N" opening a
// sheet that lists every one.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/glance_builder.dart';
import 'package:mockmob/features/today/logic/starter_cards.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/colleges_sheet.dart';
import 'package:mockmob/features/today/widgets/today_rows.dart';
import 'package:mockmob/features/tools/estimate/estimate.dart';
import 'package:mockmob/features/tools/estimate/estimate_providers.dart';

import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

/// A brand-new account: no paper, the setup's subjects (weakest first) and the weakest's check.
TodayView _fresh(List<String> subjects, {bool mob = false, String? weakest, String? rated, List<String>? ranked}) => buildToday(ashaInputs(
      now: _sunday,
      attempts: const [],
      subjects: subjects,
      mobInvite: mob,
      profile: TodayProfile(weakestSubject: weakest ?? subjects.firstOrNull, subjects: ranked ?? subjects, weakestRated: rated),
    ));

List<String> _keys(TodayView v) => [for (final c in v.choices) c.key];

void main() {
  group('the deck from an empty history (G12)', () {
    for (final mob in [true, false]) {
      final m = mob ? 'with the Mob on' : 'with the Mob off';
      test('one subject: at least four real cards, $m', () {
        final v = _fresh(const ['accountancy'], mob: mob);
        expect((v.hero! as MoveHero).kind, MoveKind.dayOne);
        expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: _keys(v).join(', '));
        expect(_keys(v), containsAllInOrder(['mock']));
        expect(_keys(v).toSet().length, v.choices.length, reason: 'no kind twice');
        final deck = buildSuggestedDeck(v.choices, glance: v.glance);
        expect(deck.length, v.choices.length);
      });

      test('three subjects: at least four real cards, $m', () {
        final v = _fresh(const ['accountancy', 'economics', 'english'], mob: mob);
        expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: _keys(v).join(', '));
        expect(_keys(v).take(3), ['quick', 'mock', 'language']);
        if (mob) expect(_keys(v)[3], 'mob');
      });

      test('five subjects: the planned order, a fifth card when there is room, $m', () {
        final v = _fresh(const ['accountancy', 'economics', 'business_studies', 'english', 'mathematics'], mob: mob);
        expect(_keys(v), mob ? ['quick', 'mock', 'language', 'mob', 'other'] : ['quick', 'mock', 'language', 'other']);
        expect(v.choices.length, lessThanOrEqualTo(starterDeckSize));
      });
    }

    test('the cards: the weakest subject the lead does not already practise, a mock in the first domain subject, English, the Mob, another subject', () {
      // Asha rated Maths her weakest, but the setup's first check is Accountancy (Maths has no free check).
      final v = _fresh(
        const ['english', 'accountancy', 'mathematics', 'economics'],
        ranked: const ['mathematics', 'accountancy', 'economics', 'english'],
        weakest: 'accountancy',
        rated: 'mathematics',
        mob: true,
      );
      final lead = v.hero! as MoveHero;
      expect(lead.subjectId, 'accountancy');
      final byKey = {for (final c in v.choices) c.key: c};
      expect(byKey['quick']!.hero!.subjectId, 'mathematics');
      expect(byKey['quick']!.hero!.title, StarterCopy.titleWeakest);
      expect(byKey['quick']!.hero!.meaning, startsWith('You rated Mathematics as your weakest subject.'));
      expect(byKey['mock']!.hero!.subjectId, 'accountancy', reason: 'the first domain subject on the account (English is the language)');
      expect(byKey['language']!.hero!.subjectId, 'english');
      expect(byKey['mob']!.action, isNotNull, reason: 'the Mob card opens the Mob page; nothing starts from the deck');
      expect(byKey['mob']!.hero, isNull);
      expect(byKey['other']!.hero!.subjectId, 'economics');
      final deck = buildSuggestedDeck(v.choices, glance: v.glance);
      expect([for (final c in deck) c.title], [
        StarterCopy.titleWeakest,
        SuggestedCopy.titleMock,
        'Practise English',
        StarterCopy.titleMob,
        'Practise Economics',
      ]);
      expect(deck.firstWhere((c) => c.key == 'mob').cost, StarterCopy.mobCost);
      for (final c in deck) {
        expect(c.swipeable, isTrue, reason: '${c.key}: a swipe never starts a session');
        expect(c.line, isNot(isEmpty));
        expect(c.line.trim().endsWith('.'), isTrue, reason: '${c.key}: "${c.line}" is a whole sentence');
      }
    });

    test('a subject the setup did not rate weakest is never called "your weakest"', () {
      final v = _fresh(const ['accountancy', 'economics', 'english']);
      final quick = v.choices.firstWhere((c) => c.key == 'quick');
      expect(quick.hero!.title, 'Practise Economics');
      expect(quick.hero!.meaning, isNot(contains('weakest')));
    });

    test('before the account list syncs, the setup sheet\'s subjects build the deck (his fresh account saw one card)', () {
      final v = buildToday(ashaInputs(
        now: _sunday,
        attempts: const [],
        subjects: const [],
        profile: const TodayProfile(weakestSubject: 'english', subjects: ['english', 'accountancy', 'business_studies', 'economics']),
      ));
      expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: _keys(v).join(', '));
    });

    test('a light record (one paper) is topped up to four from the starter cards, never repeating a kind', () {
      // A quick 10 in English, all right: no repair, no weak chapter, so the record alone makes two cards.
      final one = [paper(id: 'q1', subject: 'english', mode: 'quick', completedAt: _sunday.subtract(const Duration(hours: 3)), runs: const [('Reading', V.right, 10)])];
      final v = buildToday(ashaInputs(now: _sunday, attempts: one, mobInvite: true));
      expect(v.choices.length, greaterThanOrEqualTo(deckMinimum), reason: _keys(v).join(', '));
      expect(_keys(v).toSet().length, v.choices.length);
    });

    test('a heavy record keeps its approved deck as it is (three cards of its own: nothing added, nothing lost)', () {
      final v = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), reviseDue: 6, mobInvite: true));
      expect(_keys(v), ['revise', 'weakest', 'other']);
    });

    test('a test builds the deck from an empty history directly', () {
      final i = ashaInputs(now: _sunday, attempts: const [], subjects: const ['economics', 'english', 'accountancy'], profile: const TodayProfile(weakestSubject: 'economics'));
      final lead = buildToday(i).hero! as MoveHero;
      final choices = buildChoices(i, lead);
      expect(choices.length, greaterThanOrEqualTo(deckMinimum));
      expect(choices.every((c) => c.hero != null || c.action != null), isTrue);
    });
  });

  group('the deck\'s words (G12, R6)', () {
    test('the end says what is true for one card, two, or more; the again key fits the count', () {
      expect(SuggestedCopy.allSeen(1), 'That was the only card.');
      expect(SuggestedCopy.allSeen(2), "You've seen both cards.");
      expect(SuggestedCopy.allSeen(4), "You've seen all four.");
      expect(SuggestedCopy.allSeen(5), "You've seen all five.");
      expect(SuggestedCopy.againFor(1), 'See it again');
      expect(SuggestedCopy.againFor(4), 'Go through them again');
      expect(SuggestedCopy.noneLeft, 'All seen');
      expect(SuggestedCopy.learnedLeft, "It's at the back now. You can see it again after the others.");
    });

    test('no line is a clipped fragment: every sentence has its subject and verb, no "passed", no "waits here"', () {
      final lines = [
        for (final n in [1, 2, 3, 4, 5]) SuggestedCopy.allSeen(n),
        SuggestedCopy.learnedLeft,
        SuggestedCopy.endOurPick,
        SuggestedCopy.endYourPick,
        StarterCopy.weakestWhy('Economics', 10),
        StarterCopy.quickWhy('Economics', 10),
        StarterCopy.languageWhy('English', 10),
        StarterCopy.chapterWhy('Partnership fundamentals', 'Accountancy', 10),
        StarterCopy.nextChapterWhy('Goodwill', 10),
        StarterCopy.mobLine,
        StarterCopy.subjectsLine,
      ];
      for (final l in lines) {
        expect(l, isNot(contains('passed')), reason: l);
        expect(l, isNot(contains('waits here')), reason: l);
        expect(l, isNot(startsWith('At the back')), reason: l);
        expect(l, isNot(contains('!')), reason: l);
        expect(l, isNot(contains('·')), reason: l);
        expect(l.trim().endsWith('.'), isTrue, reason: l);
        expect(l[0], l[0].toUpperCase(), reason: l);
      }
    });
  });

  group('your colleges on Today (G7, D104)', () {
    LadderPick pick(String name, num? score) => LadderPick(college: name, course: 'B.Com (Hons)', closingScore: score, outOf: score == null ? null : 1000);
    const names = ['Hansraj College', 'Shri Ram College of Commerce', 'Lady Shri Ram College for Women', 'Hindu College', 'Kirori Mal College', 'Ramjas College', 'Deshbandhu College', 'Gargi College'];
    const scores = [912.4, 924.3, 915.0, 919.9, 905.2, 900.1, 763.0, null];

    TodayView view(int n) => buildToday(ashaInputs(
          now: _sunday,
          profile: TodayProfile(ladder: [for (var k = 0; k < n; k++) pick(names[k], scores[k])], weakestSubject: 'accountancy'),
        ));

    for (final n in [2, 3, 5, 8]) {
      test('$n colleges: Today keeps the ${n > 3 ? 3 : n} hardest to get into, and the road holds all $n, hardest first', () {
        final road = view(n).road!;
        expect(road.ladderSaved, n);
        expect(road.colleges.length, n);
        expect(road.ladder.length, n > 3 ? 3 : n);
        final figures = [for (final c in road.colleges) double.tryParse(c.score)];
        final known = [for (final f in figures) ?f];
        expect(known, [...known]..sort((a, b) => b.compareTo(a)), reason: 'hardest first');
        if (figures.contains(null)) expect(figures.last, isNull, reason: 'a college without a figure goes last, never dropped');
        expect(road.ladder, road.colleges.take(3).toList());
      });
    }

    test('the order is stable: a list already ordered hardest first comes back the same', () {
      final picks = [pick('A', 920), pick('B', 920), pick('C', 900), pick('D', null), pick('E', null)];
      expect([for (final p in hardestFirst(picks)) p.college], ['A', 'B', 'C', 'D', 'E']);
      expect([for (final p in hardestFirst(picks.reversed.toList())) p.college], ['B', 'A', 'C', 'E', 'D']);
    });

    test('the label says what "top" means', () {
      expect(TodayCopy.collegesTop(5), 'Your top 3 of 5: the three that need the most marks.');
      expect(TodayCopy.seeAllCount(5), 'See all 5 colleges');
    });

    Future<List<String>> pumpRows(WidgetTester tester, RoadModel road) async {
      final events = <String>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: TodayRows(
            colleges: road.ladder,
            collegesSaved: road.ladderSaved,
            onColleges: () => events.add('colleges'),
            onSeeAll: () => events.add('all'),
            headed: true,
          ),
        ),
        size: const Size(360, 800),
        disableAnimations: true,
      );
      await tester.pumpAndSettle();
      return events;
    }

    testWidgets('with 5 colleges Today shows 3 plus "See all 5", which opens the sheet', (tester) async {
      final road = view(5).road!;
      final events = await pumpRows(tester, road);
      expect(find.text('Shri Ram College of Commerce'), findsOneWidget);
      expect(find.text('Hindu College'), findsOneWidget);
      expect(find.text('Lady Shri Ram College for Women'), findsOneWidget);
      expect(find.text('Hansraj College'), findsNothing, reason: 'the fourth hardest is in the sheet');
      expect(find.text('See all 5 colleges'), findsOneWidget);
      await tester.tap(find.text('See all 5 colleges'));
      expect(events, ['all']);
    });

    testWidgets('with 3 colleges all three show and no See all row', (tester) async {
      await pumpRows(tester, view(3).road!);
      expect(find.textContaining('See all'), findsNothing);
      expect(find.text('Hansraj College'), findsOneWidget);
    });

    for (final withEstimate in [false, true]) {
      testWidgets('the See all sheet lists every college, hardest first${withEstimate ? ', with the gap to the estimate' : ''}', (tester) async {
        final road = view(8).road!;
        await pumpMockmob(
          tester,
          Builder(
            builder: (context) => Center(
              child: TextButton(
                onPressed: () => showTodayCollegesSheet(context, colleges: road.colleges, category: road.category),
                child: const Text('open'),
              ),
            ),
          ),
          size: const Size(360, 1600),
          disableAnimations: true,
          overrides: [
            estimateProvider.overrideWithValue(withEstimate ? const Estimate(source: EstimateSource.typed, low: 900, high: 920) : null),
          ],
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expect(find.text(TodayCollegesSheet.titleFor(8)), findsOneWidget);
        for (var k = 0; k < 8; k++) {
          expect(find.byKey(TodayCollegesSheet.rowKey(k)), findsOneWidget, reason: 'row ${k + 1}');
        }
        for (final name in names) {
          expect(find.text(name), findsOneWidget, reason: name);
        }
        if (withEstimate) {
          expect(find.text('Needs 4.3 more'), findsOneWidget, reason: 'SRCC 924.3 against a high end of 920');
          expect(find.textContaining('which you typed'), findsOneWidget);
        } else {
          expect(find.textContaining('Add your estimate'), findsWidgets);
        }
      });
    }
  });
}
