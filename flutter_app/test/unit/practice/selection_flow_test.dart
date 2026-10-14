import 'package:flutter/material.dart' show Scrollable;
import 'package:flutter/painting.dart' show Size;
// The owner's bug (13 October): "Even when I'm starting from Business Studies ... it's just
// redirecting me to the accounting page", and a 5-question practice that did not start 5. These
// tests drive the real screens and prove the chosen subject and length reach the quote and the
// start exactly, and that nothing defaults to Accountancy.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart' show AuthSnapshot;
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/you'),
];

/// Auth whose snapshot a test can replace, as a credit refresh after a start does.
class _LiveAuth extends FakeAuth {
  _LiveAuth(super.snapshot);

  void replace(AuthSnapshot next) => state = next;
}

FakeQuoteRepository _quotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta' || m == 'smart') return proGate();
  return dailyFree(count: c ?? 10);
});

Future<void> _settle(WidgetTester tester, [int frames = 6]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('Business Studies with 5 questions, from the Practice tab, quotes and starts exactly that', (tester) async {
    final quotes = _quotes();
    final starter = FakeStarter();
    final router = await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, starter: starter, attempts: const [], auth: signedIn(subjects: ['accountancy', 'business_studies'])),
    );
    await _settle(tester);

    await tester.tap(find.bySemanticsLabel(RegExp(r'^Business Studies')).first);
    await _settle(tester, 2);
    final quick = find.text('Quick practice').first;
    // The modes sit below the suggestion and the tiles: scroll the page (not the tile strip) to them.
    await tester.scrollUntilVisible(quick, 200, scrollable: find.byType(Scrollable).first);
    await tester.pump();
    await tester.tap(quick);
    await _settle(tester);
    expect(find.bySemanticsLabel('Quick practice, Business Studies'), findsOneWidget);

    await tester.tap(find.text('5').last);
    await _settle(tester);
    final start = find.widgetWithText(KeyButton, 'Start practice');
    await tester.ensureVisible(start);
    await tester.tap(start);
    await _settle(tester);

    expect(quotes.calls.last, (subject: 'business_studies', mode: 'quick', count: 5, purpose: null));
    expect(starter.started.single.subjectId, 'business_studies');
    expect(starter.started.single.effectiveCount, 5);
    expect(router.state.uri.path, '/run/sess-1');
  });

  testWidgets('a link that names Business Studies, 5 questions and two chapters starts exactly that', (tester) async {
    final starter = FakeStarter();
    await pumpRouted(
      tester,
      location: '/practice/start?mode=chapter&subject=business_studies&count=5&chapters=Staffing&chapters=Controlling',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), starter: starter, attempts: const []),
    );
    await _settle(tester);
    final s = starter.started.single;
    expect(s.subjectId, 'business_studies');
    expect(s.effectiveCount, 5);
    expect(s.effectiveChapters, ['Staffing', 'Controlling']);
    expect(s.sessionFields['chapters'], 'Staffing,Controlling');
  });

  testWidgets('the setup page keeps the subject, length and difficulty a link names', (tester) async {
    final quotes = _quotes();
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=economics&count=15&difficulty=hard',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, attempts: const []),
    );
    await _settle(tester);
    expect(find.bySemanticsLabel('Quick practice, Economics'), findsOneWidget);
    expect(quotes.calls.last.subject, 'economics');
    expect(quotes.calls.last.count, 15);
  });

  testWidgets('at 1.3x text the difficulty choice is a wrapped row of chips with every name whole, not cut segments', (tester) async {
    await pumpRouted(
      tester,
      location: '/practice/setup/quick?subject=economics&count=10',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _quotes(), attempts: const []),
      size: const Size(360, 640),
      textScale: 1.3,
    );
    await _settle(tester);
    expect(find.byType(MmSegmented<PracticeDifficulty>), findsNothing);
    for (final name in ['Balanced', 'Easy', 'Medium', 'Hard']) {
      expect(find.text(name, skipOffstage: false), findsOneWidget, reason: name);
    }
  });

  test('a link is read without dropping anything', () {
    final link = PracticeLink.of(Uri.parse('/practice/setup/chapter?subject=business_studies&count=5&chapter=Staffing&difficulty=easy'));
    final s = link.selectionFor(PracticeMode.chapter)!;
    expect(s.subjectId, 'business_studies');
    expect(s.count, 5);
    expect(s.chapters, ['Staffing']);
    expect(s.difficulty, PracticeDifficulty.easy);
    // Smart starts at 10: a link asking for 5 gets the nearest length Smart offers.
    expect(PracticeLink.of(Uri.parse('/x?subject=english&count=5')).selectionFor(PracticeMode.smart)!.count, 10);
  });

  group('the default subject comes from the student, never a constant', () {
    const catalog = [
      Subject(id: 'english', internalId: 'english', name: 'English', practice: 'supported'),
      Subject(id: 'business_studies', internalId: 'business_studies', name: 'Business Studies', practice: 'supported'),
      Subject(id: 'physics', internalId: 'physics', name: 'Physics', practice: 'supported'),
    ];

    test('the first saved subject that practice can start in', () {
      expect(defaultPracticeSubject(saved: ['agriculture', 'physics'], catalog: catalog), 'physics');
    });

    test('then the subjects ranked in onboarding', () {
      expect(defaultPracticeSubject(saved: const [], onboarding: ['business_studies', 'english'], catalog: catalog), 'business_studies');
    });

    test('then the latest paper', () {
      final a = Attempt.fromJson({'id': 'a', 'subject': 'physics', 'completedAt': 2000, 'total': 10});
      final b = Attempt.fromJson({'id': 'b', 'subject': 'english', 'completedAt': 1000, 'total': 10});
      expect(defaultPracticeSubject(saved: const [], attempts: [b, a], catalog: catalog), 'physics');
    });

    test('then the catalogue, and only with nothing at all the first launch subject', () {
      expect(defaultPracticeSubject(saved: const [], catalog: catalog), 'english');
      expect(defaultPracticeSubject(saved: const []), launchSubjectIds.first);
      expect(defaultPracticeSubject(saved: const []), isNot('accountancy'));
    });
  });

  test('a picked subject survives the credit refresh that follows a start', () async {
    final auth = _LiveAuth(signedIn(subjects: ['accountancy', 'business_studies'], credits: 100));
    final container = ProviderContainer(
      overrides: practiceOverrides(attempts: const [], authNotifier: auth),
    );
    addTearDown(container.dispose);
    final sub = container.listen(practiceSubjectProvider, (_, _) {});
    addTearDown(sub.close);
    expect(container.read(practiceSubjectProvider), 'accountancy');

    container.read(practiceSubjectProvider.notifier).select('business_studies');
    expect(container.read(practiceSubjectProvider), 'business_studies');

    // Credits spent: a new snapshot with a fresh (equal) subjects list.
    auth.replace(signedIn(subjects: ['accountancy', 'business_studies'], credits: 90));
    await container.pump();
    expect(container.read(practiceSubjectProvider), 'business_studies');

    // Removing the picked subject from the account still keeps the explicit pick while the
    // catalogue says practice can start in it; the default only applies with no pick.
    auth.replace(signedIn(subjects: ['economics'], credits: 90));
    await container.pump();
    expect(container.read(practiceSubjectProvider), 'business_studies');
  });
}
