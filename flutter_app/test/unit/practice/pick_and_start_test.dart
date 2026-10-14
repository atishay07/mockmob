import 'dart:ui' show Size;
import 'package:flutter/widgets.dart' show Scrollable;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/features/practice/widgets/length_dial.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/data/practice_prefs.dart';
import 'package:mockmob/features/practice/model/finish_reaction.dart';
import 'package:mockmob/features/practice/practice_routes.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

/// Owner feedback 13 October: "Even when I'm starting from Business Studies ... it's just
/// redirecting me to the accounting page". The subject picked on the tiles is the subject the
/// card offers, the confirm sheet names and Start launches; it survives a restart; links with
/// no subject start in it; and the confirm sheet's keys are never cut off.
List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  stubRoute('/practice/result/:attemptId'),
  stubRoute('/result/:attemptId'),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
];

FakeQuoteRepository _quotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta') return proGate();
  return creditsQuote(count: c ?? 10, mode: m);
});

/// Quotes that cost nothing today: an auto-start link only starts straight away on these.
FakeQuoteRepository _freeQuotes() => FakeQuoteRepository((s, m, c, p) => dailyFree(count: c ?? 10));

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 500));
}

/// Picking a tile scrolls it into view; the suggestion card sits above it, so scroll back up.
Future<void> _toTop(WidgetTester tester) async {
  await tester.drag(find.byType(Scrollable).first, const Offset(0, 2000));
  await _settle(tester);
}

Future<void> _rise(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

int _ms(Duration ago) => testNow.subtract(ago).millisecondsSinceEpoch;

/// The latest paper is an Accountancy mock; an older Business Studies practice lost marks in
/// Planning.
final _accountancyMock = attemptOf(
  id: 'm1',
  completedAt: _ms(const Duration(hours: 3)),
  questions: [...chapterOf('Admission of a partner', right: 1, wrong: 3), ...chapterOf('Goodwill', right: 4)],
);
final _businessPractice = attemptOf(
  id: 'b1',
  subject: 'business_studies',
  mode: 'quick',
  completedAt: _ms(const Duration(days: 2)),
  questions: [...chapterOf('Planning', right: 1, wrong: 2), ...chapterOf('Staffing', right: 2)],
);

final AuthSnapshot _twoSubjects = signedIn(subjects: ['accountancy', 'business_studies']);

void main() {
  setUpAll(loadAppFonts);

  group('the card follows the subject picked on the tiles', () {
    testWidgets('pick Business Studies: the card, the confirm sheet and Start all say Business Studies', (tester) async {
      final starter = FakeStarter();
      final semantics = tester.ensureSemantics();
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(
          quotes: _quotes(),
          starter: starter,
          auth: _twoSubjects,
          attempts: [_accountancyMock, _businessPractice],
        ),
      );
      await _settle(tester);
      // Before a pick the card follows the latest paper (Accountancy).
      expect(find.text('Admission of a partner'), findsOneWidget);

      await tester.ensureVisible(find.text('Business Studies').first);
      await tester.tap(find.text('Business Studies').first);
      await _settle(tester);
      await _toTop(tester);
      // Its weakest chapter in its own latest paper.
      expect(find.text('Planning'), findsOneWidget);
      expect(find.text('You missed 2 here in your last practice.'), findsOneWidget);
      expect(find.text('Admission of a partner'), findsNothing);

      await tester.ensureVisible(find.widgetWithText(KeyButton, 'Start').first);
      await tester.pump();
      await tester.tap(find.widgetWithText(KeyButton, 'Start').first);
      await _rise(tester);
      expect(find.bySemanticsLabel('By chapter, Business Studies'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'^(Quick practice|By chapter), Accountancy')), findsNothing);

      await tester.tap(find.text('Start chapter practice'));
      await _settle(tester);
      expect(starter.started, hasLength(1));
      expect(starter.started.single.subjectId, 'business_studies');
      expect(starter.started.single.chapter, 'Planning');
      semantics.dispose();
    });

    testWidgets('a picked subject with no paper yet offers ten questions in it, said plainly', (tester) async {
      final starter = FakeStarter();
      final semantics = tester.ensureSemantics();
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _quotes(), starter: starter, auth: _twoSubjects, attempts: [_accountancyMock]),
      );
      await _settle(tester);
      await tester.ensureVisible(find.text('Business Studies').first);
      await tester.tap(find.text('Business Studies').first);
      await _settle(tester);
      await _toTop(tester);
      expect(find.text('Business Studies, quick practice'), findsOneWidget);
      expect(find.text('No Business Studies paper yet. Ten questions shows where you stand.'), findsOneWidget);

      await tester.ensureVisible(find.widgetWithText(KeyButton, 'Start').first);
      await tester.pump();
      await tester.tap(find.widgetWithText(KeyButton, 'Start').first);
      await _rise(tester);
      expect(find.bySemanticsLabel('Quick practice, Business Studies'), findsOneWidget);
      await tester.tap(find.text('Start practice'));
      await _settle(tester);
      expect(starter.started.single.subjectId, 'business_studies');
      expect(starter.started.single.count, 10);
      semantics.dispose();
    });
  });

  group('the pick is remembered on the phone, per account', () {
    test('restart, then open: the pick is still Business Studies', () async {
      final prefs = MemoryPrefsStore();
      final first = ProviderContainer(overrides: practiceOverrides(prefs: prefs, auth: _twoSubjects, attempts: const []));
      final sub = first.listen(practiceSubjectProvider, (_, _) {});
      await first.pump();
      first.read(practiceSubjectProvider.notifier).select('business_studies');
      await first.pump();
      expect(prefs.values[pickedSubjectKey('u1')], 'business_studies');
      sub.close();
      first.dispose();

      // A cold start: a new container over the same phone storage.
      final second = ProviderContainer(overrides: practiceOverrides(prefs: prefs, auth: _twoSubjects, attempts: const []));
      addTearDown(second.dispose);
      final sub2 = second.listen(practiceSubjectProvider, (_, _) {});
      addTearDown(sub2.close);
      await second.read(pickedPracticeSubjectProvider.notifier).restored;
      await second.pump();
      expect(second.read(practiceSubjectProvider), 'business_studies');
    });

    test('a stored id the catalogue does not offer falls back to the default, and is forgotten', () async {
      for (final bad in ['applied_mathematics', 'DROP TABLE', '']) {
        final prefs = MemoryPrefsStore()..values[pickedSubjectKey('u1')] = bad;
        final container = ProviderContainer(overrides: practiceOverrides(prefs: prefs, auth: _twoSubjects, attempts: const []));
        final sub = container.listen(practiceSubjectProvider, (_, _) {});
        await container.read(pickedPracticeSubjectProvider.notifier).restored;
        await container.pump();
        expect(container.read(practiceSubjectProvider), 'accountancy', reason: bad);
        expect(prefs.values.containsKey(pickedSubjectKey('u1')), isFalse, reason: bad);
        sub.close();
        container.dispose();
      }
    });

    test('another account on the same phone does not inherit the pick', () async {
      final prefs = MemoryPrefsStore()..values[pickedSubjectKey('u1')] = 'business_studies';
      const other = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2', subjects: ['accountancy', 'business_studies']);
      final container = ProviderContainer(overrides: practiceOverrides(prefs: prefs, auth: other, attempts: const []));
      addTearDown(container.dispose);
      final sub = container.listen(practiceSubjectProvider, (_, _) {});
      addTearDown(sub.close);
      await container.read(pickedPracticeSubjectProvider.notifier).restored;
      await container.pump();
      expect(container.read(practiceSubjectProvider), 'accountancy');
    });
  });

  group('a start link with no subject', () {
    testWidgets('/practice/start?mode=quick&count=10 starts 10 Quick questions in the default subject', (tester) async {
      final starter = FakeStarter();
      final router = await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), starter: starter, attempts: const []),
      );
      await _settle(tester);
      await _settle(tester);
      expect(starter.started, hasLength(1));
      expect(starter.started.single.subjectId, 'accountancy');
      expect(starter.started.single.count, 10);
      expect(starter.started.single.mode.name, 'quick');
      expect(router.state.uri.path, '/run/sess-1');
    });

    testWidgets('a picked subject while the attempts have not loaded claims nothing about papers', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _quotes(), auth: _twoSubjects, attempts: null),
      );
      await _settle(tester);
      await tester.ensureVisible(find.text('Business Studies').first);
      await tester.tap(find.text('Business Studies').first);
      await _settle(tester);
      await _toTop(tester);
      expect(find.text('Business Studies, quick practice'), findsOneWidget);
      expect(find.textContaining('paper yet'), findsNothing);
      expect(find.text('Ten questions shows where you stand.'), findsOneWidget);
    });

    testWidgets('it starts in the subject the student picked last time', (tester) async {
      final starter = FakeStarter();
      final prefs = MemoryPrefsStore()..values[pickedSubjectKey('u1')] = 'business_studies';
      await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), starter: starter, prefs: prefs, auth: _twoSubjects, attempts: const []),
      );
      await _settle(tester);
      await _settle(tester);
      expect(starter.started.single.subjectId, 'business_studies');
    });

    testWidgets('a length the mode does not offer goes to the confirm step, which says so before Start', (tester) async {
      final starter = FakeStarter();
      final router = await pumpRouted(
        tester,
        location: '/practice/start?mode=smart&subject=accountancy&count=5',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _quotes(), starter: starter),
      );
      await _settle(tester);
      await _settle(tester);
      expect(starter.started, isEmpty);
      expect(router.state.uri.path, '/practice/setup/smart');
      expect(find.text('Smart practice starts at 10. You asked for 5.'), findsOneWidget);
      // Choosing a length themselves answers it.
      await tester.tap(find.descendant(of: find.byType(LengthDial), matching: find.text('15')));
      await _settle(tester);
      expect(find.text('Smart practice starts at 10. You asked for 5.'), findsNothing);
    });
  });

  testWidgets('offline, the start says the work is safe and starts by itself when the network returns', (tester) async {
    final starter = FakeStarter();
    final net = FakeNetwork(NetworkStatus.offline);
    final router = await pumpRouted(
      tester,
      location: '/practice/start?mode=quick&subject=accountancy&count=10',
      routes: _routes(),
      overrides: practiceOverrides(quotes: _freeQuotes(), starter: starter, networkNotifier: net),
    );
    await _settle(tester);
    expect(find.text(PracticeCopy.offlineAutoStart), findsOneWidget);
    expect(starter.started, isEmpty);

    net.change(NetworkStatus.online);
    await _settle(tester);
    await _settle(tester);
    expect(starter.started, hasLength(1));
    expect(router.state.uri.path, '/run/sess-1');
  });

  for (final (size, scale) in [(const Size(360, 640), 1.0), (const Size(360, 640), 1.3)]) {
    testWidgets('on a ${size.width.toInt()}x${size.height.toInt()} phone at ${scale}x text, Start and Not now are pinned and reachable', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        size: size,
        textScale: scale,
        overrides: practiceOverrides(quotes: _quotes()),
      );
      await _settle(tester);
      await tester.ensureVisible(find.text('Quick practice'));
      await tester.pump();
      await tester.tap(find.text('Quick practice'));
      await _rise(tester);
      final start = tester.getRect(find.text('Start practice'));
      final notNow = tester.getRect(find.text('Not now'));
      expect(start.bottom, lessThanOrEqualTo(size.height));
      expect(notNow.bottom, lessThanOrEqualTo(size.height));
      expect(notNow.top, greaterThan(start.bottom));
      // Not now is on top (nothing covers it) and closes the sheet.
      await tester.tapAt(notNow.center);
      await _rise(tester);
      expect(find.text('What you get'), findsNothing);
    });
  }

  test('Mobi names wrong answers and blanks apart, so the line matches "Repair these 3"', () {
    const m = FinishMarks(correct: 1, wrong: 3, blank: 1, total: 5);
    final line = PracticeCopy.finishLine(FinishTone.mixed, m);
    expect(line, 'Let’s look at the 3 wrong answers and 1 not attempted. The reasons are below.');
    expect(line.contains('4'), isFalse);
    expect(PracticeCopy.repairThese(m.wrong), 'Repair these 3');
    expect(
      PracticeCopy.finishLine(FinishTone.good, const FinishMarks(correct: 7, wrong: 0, blank: 3, total: 10)),
      'Most of this set is right. 3 not attempted to look at below.',
    );
  });

  test('the NTA card is built from the NTA rules, and the start failure promises nothing it cannot know', () {
    expect(PracticeCopy.ntaChips.take(2), ['50 questions', '60 minutes']);
    expect(PracticeCopy.startFailed.contains('Nothing was charged'), isFalse);
    expect(PracticeCopy.startFailed.contains('will not charge'), isFalse);
    expect(PracticeCopy.lengthAdjusted('Smart practice', const [10, 15, 20], 5), 'Smart practice starts at 10. You asked for 5.');
    expect(PracticeCopy.lengthAdjusted('Quick practice', const [5, 10, 15, 20], 25), 'Quick practice goes up to 20. You asked for 25.');
    expect(PracticeCopy.practiceAnotherChapter, 'Practice another chapter');
  });
}
