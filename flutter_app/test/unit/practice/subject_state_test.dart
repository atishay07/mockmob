import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/insights/ask_mobi.dart' show AskMobiCard;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/subject_tiles.dart';
import 'package:mockmob/features/practice/widgets/suggestion_card.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

/// L08, one subject state: the lit tile, the card's overline and the card's object always name the
/// same subject, and the tab opens on the subject the student's record points to.
List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/result/:attemptId'),
  stubRoute('/result/:attemptId'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/tools/compass'),
];

/// An evening, before the late-night overline takes over.
final DateTime _evening = DateTime(2026, 10, 12, 19);

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUpAll(loadAppFonts);

  group('the default subject', () {
    const catalog = [
      Subject(id: 'english', internalId: 'english', name: 'English', practice: 'supported'),
      Subject(id: 'accountancy', internalId: 'accountancy', name: 'Accountancy', practice: 'supported'),
      Subject(id: 'physics', internalId: 'physics', name: 'Physics', practice: 'supported'),
    ];

    test('is the latest paper\'s subject when it is one of the saved subjects', () {
      final latest = Attempt.fromJson({'id': 'a', 'subject': 'accountancy', 'completedAt': 2000, 'total': 10});
      final older = Attempt.fromJson({'id': 'b', 'subject': 'english', 'completedAt': 1000, 'total': 10});
      expect(defaultPracticeSubject(saved: ['english', 'accountancy'], attempts: [older, latest], catalog: catalog), 'accountancy');
    });

    test('falls back to the first saved subject when the latest paper is in a subject not saved', () {
      final latest = Attempt.fromJson({'id': 'a', 'subject': 'physics', 'completedAt': 2000, 'total': 10});
      expect(defaultPracticeSubject(saved: ['english', 'accountancy'], attempts: [latest], catalog: catalog), 'english');
    });
  });

  testWidgets('with no pick, the lit tile and the card name the subject of the latest paper', (tester) async {
    final mock = attemptOf(
      id: 'm1',
      subject: 'accountancy',
      completedAt: _evening.subtract(const Duration(days: 1)).millisecondsSinceEpoch,
      questions: chapterOf('Goodwill', wrong: 3),
    );
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(now: _evening, auth: signedIn(subjects: const ['english', 'accountancy']), attempts: [mock]),
    );
    await _settle(tester);

    final tiles = tester.widget<SubjectTiles>(find.byType(SubjectTiles));
    expect(tiles.selectedId, 'accountancy');
    final card = tester.widget<SuggestionCard>(find.byType(SuggestionCard));
    expect(card.subjectId, 'accountancy');
    expect(card.overline, isNull, reason: 'one title: the card names the subject once, with no "Up next in" line over it');
  });

  testWidgets('picking another tile moves the card to that subject; the modes stay and do not rise again', (tester) async {
    final mock = attemptOf(
      id: 'm1',
      subject: 'accountancy',
      completedAt: _evening.subtract(const Duration(days: 1)).millisecondsSinceEpoch,
      questions: chapterOf('Goodwill', wrong: 3),
    );
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(now: _evening, auth: signedIn(subjects: const ['accountancy', 'english']), attempts: [mock]),
    );
    await _settle(tester);
    // Let the page's one entrance finish.
    await tester.pump(const Duration(seconds: 2));

    final quickBefore = find.text(PracticeCopy.quickTitle).evaluate().single;
    await tester.tap(find.text('English').first);
    await _settle(tester);
    await tester.pump(const Duration(seconds: 1));

    final cards = tester.widgetList<SuggestionCard>(find.byType(SuggestionCard)).toList();
    expect(cards.last.subjectId, 'english');
    expect(cards.last.overline, isNull);
    // The same Quick practice element: the deck was not rebuilt for the new subject.
    expect(find.text(PracticeCopy.quickTitle).evaluate().single, same(quickBefore));
    expect(tester.widget<SubjectTiles>(find.byType(SubjectTiles)).selectedId, 'english');
  });

  testWidgets('reading order: subjects, up next, ways to practise, the exam band, more ways in', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(now: _evening, attempts: const []),
      size: const Size(360, 800),
    );
    await _settle(tester);

    double top(Finder f) => tester.getTopLeft(f.first).dy;
    final strip = top(find.text(PracticeCopy.practiseIn));
    final hero = top(find.byType(SuggestionCard));
    final ways = top(find.text(PracticeCopy.waysHeading));
    final quick = top(find.text(PracticeCopy.quickTitle));
    expect(strip, lessThan(hero));
    expect(hero, lessThan(ways));
    expect(ways, lessThan(quick));
    // The first screen at 360x800 shows the subject choice and Up next (L08), above the 64 dp bar; Ask Mobi's
    // card (ASK-MOBI-1019 B) starts there too, and the first mode is one short scroll under it.
    expect(top(find.byType(AskMobiCard)), lessThan(800 - 64));
    expect(quick, lessThan(800 - 64 + 260));

    await tester.scrollUntilVisible(find.text(PracticeCopy.moreHeading), 200, scrollable: find.byType(Scrollable).first);
    await tester.pump();
    expect(top(find.text(PracticeCopy.fullMockTitle)), lessThan(top(find.text(PracticeCopy.moreHeading))));
    expect(find.text(PracticeCopy.toolsTitle), findsOneWidget);
  });
}
