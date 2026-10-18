// D101 and G15 (owner, 19 Oct: "visible but locked"): Practice always lists every mode, Quick
// practice, By chapter, Smart practice, Full mock and NTA mode, on a fresh Free account too. A mode Pro
// holds wears a quiet Pro tag; with PLAY_BILLING off a tap opens a calm sheet ("NTA mode is part of
// Pro. Pro opens in the app soon.") with no price and no web link, and the open mode instead; with
// PLAY_BILLING on it opens the Upgrade sheet; a Pro student uses it. Only a server that says a mode is
// not offered takes its tile away. Plus Your papers (G20): the row that opens the Review screen inside
// Practice, on every account.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/router/quick_start.dart' show quickStartNtaProvider;
import 'package:mockmob/features/credits/data/credits_data.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/start_entries.dart';
import 'package:mockmob/features/practice/model/cost_line.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/pro_nudge/data/pro_benefits.dart' show ProFacts;
import 'package:mockmob/features/pro_nudge/data/pro_facts_provider.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart' show proNudgePrefsProvider;
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show ProNudgeCopy, ProReason, proNudgesOnProvider;

import '../../helpers/fonts.dart';
import '../billing/billing_test_support.dart';
import '../core_data/support/fixtures.dart';
import '../you/you_test_support.dart';
import 'support/harness.dart';

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/papers'),
  stubRoute('/exam/nta'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/tools/compass'),
];

/// A Free student's quotes: Smart practice and NTA mode need Pro, the rest are open.
FakeQuoteRepository _freeQuotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta' || m == 'smart') return proGate();
  return dailyFree(count: c ?? 10);
});

AuthSnapshot _pro() => const AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'a@b.co',
  subjects: ['accountancy', 'english'],
  creditBalance: 100,
  isPro: true,
);

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
  await tester.pump(const Duration(seconds: 1));
}

Future<void> _toExamBand(WidgetTester tester) async {
  await tester.scrollUntilVisible(find.text(PracticeCopy.ntaTitle), 200, scrollable: find.byType(Scrollable).first);
  await tester.pump();
}

Future<void> _open(WidgetTester tester, String title) async {
  await tester.scrollUntilVisible(find.text(title), 200, scrollable: find.byType(Scrollable).first);
  await tester.pump();
  await tester.tap(find.text(title));
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('practiceModeAccess: listed, locked or not offered', () {
    test('before the quote answers, the plan decides: locked for Free, open for Pro', () {
      expect(practiceModeAccess(null, isPro: false), ModeAccess.locked);
      expect(practiceModeAccess(null, isPro: true), ModeAccess.open);
    });

    test('a quote that needs Pro is locked; an open quote is open; a mode the server does not offer is not listed', () {
      expect(practiceModeAccess(proGate(), isPro: false), ModeAccess.locked);
      expect(practiceModeAccess(creditsQuote(mode: 'nta', count: 50), isPro: false), ModeAccess.open);
      expect(practiceModeAccess(modeUnavailable(), isPro: false), ModeAccess.notOffered);
    });
  });

  group('the Practice tab on a fresh Free account (DONE WHEN: every mode shows)', () {
    testWidgets('Quick practice, By chapter, Smart practice, Full mock and NTA mode all show, the Pro ones tagged', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), attempts: const []),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _toExamBand(tester);
      for (final title in [PracticeCopy.quickTitle, PracticeCopy.chapterTitle, PracticeCopy.smartTitle, PracticeCopy.fullMockTitle, PracticeCopy.ntaTitle]) {
        expect(find.text(title), findsOneWidget, reason: '$title is always listed');
      }
      expect(find.text(PracticeCopy.proTag), findsNWidgets(2), reason: 'a quiet Pro tag on Smart practice and NTA mode');
      expect(find.text(PracticeCopy.ntaGatedLine), findsOneWidget);
      expect(find.text(PracticeCopy.smartGatedLine), findsOneWidget);
      expect(find.textContaining('Rs'), findsNothing, reason: 'no price');
      expect(find.textContaining('₹'), findsNothing, reason: 'no price');
    });

    testWidgets('every mode shows from the first frame, before any quote answers', (tester) async {
      final never = Completer<PracticeQuote>();
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => never.future), attempts: const []),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _toExamBand(tester);
      expect(find.text(PracticeCopy.smartTitle), findsOneWidget);
      expect(find.text(PracticeCopy.ntaTitle), findsOneWidget);
      expect(find.text(PracticeCopy.proTag), findsNWidgets(2), reason: "on the Free plan they are Pro's");
    });

    testWidgets('a mode the server says it does not offer is the only one that leaves', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(
          quotes: FakeQuoteRepository((s, m, c, p) => m == 'nta' ? modeUnavailable() : (m == 'smart' ? proGate() : dailyFree(count: c ?? 10))),
        ),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await tester.scrollUntilVisible(find.text(PracticeCopy.fullMockTitle), 200, scrollable: find.byType(Scrollable).first);
      expect(find.text(PracticeCopy.ntaTitle), findsNothing);
      expect(find.text(PracticeCopy.smartTitle), findsOneWidget);
    });

    testWidgets('a Pro student sees both open, with no Pro tag', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(
          auth: _pro(),
          quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(mode: m, count: c ?? 10)),
        ),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _toExamBand(tester);
      expect(find.text(PracticeCopy.smartTitle), findsOneWidget);
      expect(find.text(PracticeCopy.ntaTitle), findsOneWidget);
      expect(find.text(PracticeCopy.proTag), findsNothing);
      expect(find.text(PracticeCopy.ntaLine), findsOneWidget);
    });
  });

  group('a tap on a locked mode', () {
    testWidgets('PLAY_BILLING off: NTA mode opens the calm sheet, with no price and no link, and a Full mock instead', (tester) async {
      final router = await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), extra: [proNudgesOnProvider.overrideWithValue(false)]),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _open(tester, PracticeCopy.ntaTitle);
      expect(find.text('NTA mode is part of Pro'), findsOneWidget);
      expect(find.text('Pro opens in the app soon.'), findsOneWidget);
      expect(find.text(PracticeCopy.lockedNtaInstead), findsOneWidget);
      expect(find.text(PracticeCopy.takeFullInstead), findsOneWidget);
      expect(find.textContaining('mockmob.in'), findsNothing, reason: 'no web link (anti-steering)');
      expect(find.textContaining('Rs'), findsNothing, reason: 'no price');
      expect(router.state.uri.path, '/practice', reason: 'the exam-day page did not open');
      // Not now closes it and leaves the student where they were.
      await tester.tap(find.text(PracticeCopy.lockedNotNow));
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 150));
      }
      expect(find.text('NTA mode is part of Pro'), findsNothing);
      expect(router.state.uri.path, '/practice');
    });

    testWidgets('PLAY_BILLING off: Smart practice opens the calm sheet with Quick practice instead', (tester) async {
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), extra: [proNudgesOnProvider.overrideWithValue(false)]),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _open(tester, PracticeCopy.smartTitle);
      expect(find.text('Smart practice is part of Pro'), findsOneWidget);
      expect(find.text('Pro opens in the app soon.'), findsOneWidget);
      expect(find.text(PracticeCopy.takeQuickInstead), findsOneWidget);
    });

    testWidgets('PLAY_BILLING on: NTA mode opens the Upgrade sheet', (tester) async {
      final rig = BillingRig();
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: [
          ...practiceOverrides(quotes: _freeQuotes()),
          // The Upgrade sheet reads the plan from the credits overview, which would open the phone's database.
          meCreditsProvider.overrideWith(() => FakeMeCredits(creditsState())),
          creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
          ...rig.overrides,
          // The nudges remember what they showed in the phone's preferences: in memory here.
          proNudgePrefsProvider.overrideWithValue(MemoryPrefsStore()),
          proFactsProvider.overrideWithValue(ProFacts.empty),
        ],
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _open(tester, PracticeCopy.ntaTitle);
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text(ProNudgeCopy.head(ProReason.ntaMode).title), findsWidgets);
      expect(find.text('NTA mode is part of Pro'), findsNothing, reason: 'the calm sheet is for billing off only');
    });

    testWidgets('a Pro student goes straight to the exam-day page', (tester) async {
      final router = await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(auth: _pro(), quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote(mode: m, count: c ?? 10))),
        size: const Size(360, 800),
      );
      await _settle(tester);
      await _open(tester, PracticeCopy.ntaTitle);
      expect(router.state.uri.path, '/exam/nta');
    });
  });

  group("the Start sheet's NTA row (always listed)", () {
    test('a Free student gets a locked row before and after the quote; a mode not offered gets none', () async {
      Future<QuickNtaProbe> probe(FakeQuoteRepository quotes, {bool pro = false}) async {
        final container = ProviderContainer(
          overrides: practiceOverrides(quotes: quotes, auth: pro ? _pro() : signedIn()),
        );
        addTearDown(container.dispose);
        final sub = container.listen(practiceQuickNtaProvider, (_, _) {});
        addTearDown(sub.close);
        final before = container.read(practiceQuickNtaProvider);
        await Future<void>.delayed(const Duration(milliseconds: 50));
        final after = container.read(practiceQuickNtaProvider);
        return (before: before?.proOnly, after: after?.proOnly, shown: after != null);
      }

      final free = await probe(_freeQuotes());
      expect(free.before, isTrue, reason: 'listed locked from the first frame');
      expect(free.after, isTrue);
      final unavailable = await probe(FakeQuoteRepository((s, m, c, p) => modeUnavailable()));
      expect(unavailable.shown, isFalse);
      final pro = await probe(FakeQuoteRepository((s, m, c, p) => creditsQuote(mode: m, count: c ?? 10)), pro: true);
      expect(pro.after, isFalse);
      expect(quickStartNtaProvider, isNotNull);
    });
  });

  group('Your papers (G20): the Review screen lives inside Practice', () {
    testWidgets('a fresh account sees the row and what it will hold; a tap opens Your papers', (tester) async {
      final router = await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), attempts: const []),
        size: const Size(360, 800),
      );
      await _settle(tester);
      // With nothing to repair yet it leads "More ways in", so the first screen stays the subjects, the start and the
      // modes (v15.2's layout); it is on the page for every account (R3).
      await tester.scrollUntilVisible(find.text(PracticeCopy.papersTitle), 200, scrollable: find.byType(Scrollable).first);
      await tester.pump();
      expect(find.text(PracticeCopy.papersTitle), findsOneWidget);
      expect(find.text(PracticeCopy.papersNote(papers: 0, open: 0)), findsOneWidget);
      expect(tester.getTopLeft(find.text(PracticeCopy.papersTitle)).dy, greaterThan(tester.getTopLeft(find.text(PracticeCopy.moreHeading)).dy));
      await tester.tap(find.text(PracticeCopy.papersTitle));
      await tester.pump(const Duration(milliseconds: 600));
      expect(router.state.uri.path, '/practice/papers');
    });

    testWidgets('with papers, the row counts them and the open mistakes', (tester) async {
      final mock = attemptOf(id: 'm1', subject: 'accountancy', completedAt: DateTime(2026, 10, 18, 19).millisecondsSinceEpoch, questions: chapterOf('Goodwill', wrong: 3));
      await pumpRouted(
        tester,
        location: '/practice',
        routes: _routes(),
        overrides: practiceOverrides(quotes: _freeQuotes(), attempts: [mock], openRepairs: 3),
        size: const Size(360, 800),
      );
      await _settle(tester);
      expect(find.text(PracticeCopy.papersNote(papers: 1, open: 3)), findsOneWidget);
    });

    test('the line reads as plain sentences', () {
      expect(PracticeCopy.papersNote(papers: 0, open: 0), 'Every paper you sit is kept here, newest first, with its answers.');
      expect(PracticeCopy.papersNote(papers: 1, open: 0), '1 paper so far, with its answers.');
      expect(PracticeCopy.papersNote(papers: 4, open: 1), '4 papers so far, newest first. 1 mistake still to repair.');
      expect(PracticeCopy.papersNote(papers: 4, open: 6), '4 papers so far, newest first. 6 mistakes still to repair.');
    });
  });
}

typedef QuickNtaProbe = ({bool? before, bool? after, bool shown});
