import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/repositories.dart' show SignedOutException;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/suggestion_card.dart';

import '../../helpers/fonts.dart';
import '../core_data/support/fixtures.dart';
import 'support/harness.dart';

/// A starter whose session was revoked: the real one throws from `userId()`.
class _SignedOutStarter extends FakeStarter {
  @override
  Future<StartOutcome> start(PracticeSelection selection, {PracticeQuote? quote, int? mockNumber}) {
    started.add(selection);
    throw const SignedOutException();
  }
}

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  stubRoute('/run/:sessionId'),
  stubRoute('/learn'),
  stubRoute('/review'),
  stubRoute('/today'),
  stubRoute('/review/repair/:attemptId/:questionId'),
];

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('practice-01: a start that throws never leaves a spinner', () {
    testWidgets('the auto-start route ends in a stop with a way out', (tester) async {
      final starter = _SignedOutStarter();
      await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter),
      );
      await _settle(tester);
      expect(starter.started, hasLength(1));
      expect(find.text(PracticeCopy.gettingReady), findsNothing);
      expect(find.text(PracticeCopy.startFailed), findsOneWidget);
      expect(find.text(PracticeCopy.retry), findsOneWidget);
    });

    testWidgets('the confirm page frees its Start key again', (tester) async {
      final starter = _SignedOutStarter();
      await pumpRouted(
        tester,
        location: '/practice/setup/quick?subject=accountancy',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter),
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('Start practice'));
      await _settle(tester);
      expect(starter.started, hasLength(1));
      expect(find.text(PracticeCopy.startFailed), findsOneWidget);
      final key = tester.widget<KeyButton>(find.widgetWithText(KeyButton, 'Start practice'));
      expect(key.onPressed, isNotNull);
    });
  });

  group('practice-02: a link never spends credits the student has not seen', () {
    testWidgets('a quote that costs credits goes to the confirm step and starts nothing', (tester) async {
      final starter = FakeStarter();
      final router = await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => creditsQuote()), starter: starter),
      );
      await _settle(tester);
      expect(starter.started, isEmpty);
      expect(router.state.uri.path, '/practice/setup/quick');
    });

    testWidgets('a quote that is free today still starts straight away', (tester) async {
      final starter = FakeStarter();
      final router = await pumpRouted(
        tester,
        location: '/practice/start?mode=quick&subject=accountancy&count=10',
        routes: _routes(),
        overrides: practiceOverrides(quotes: FakeQuoteRepository((s, m, c, p) => dailyFree()), starter: starter),
      );
      await _settle(tester);
      expect(starter.started, hasLength(1));
      expect(router.state.uri.path, '/run/sess-1');
    });
  });

  testWidgets('practice-04: the Smart row stays put while another subject quote loads', (tester) async {
    final gate = Completer<PracticeQuote>();
    final quotes = FakeQuoteRepository((s, m, c, p) {
      if (m == 'smart' && s == 'business_studies') return gate.future;
      return dailyFree(count: c ?? 10);
    });
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, attempts: const [], auth: signedIn(subjects: ['accountancy', 'business_studies'])),
    );
    await _settle(tester);
    // The longer sessions sit under the tiles: scroll the page (not the strip) down to them, then
    // back up to the strip to pick (the tiles lead the tab now).
    await tester.scrollUntilVisible(find.text(PracticeCopy.smartTitle), 200, scrollable: find.byType(Scrollable).first);
    await tester.pump();
    expect(find.text(PracticeCopy.smartTitle), findsOneWidget);

    await tester.drag(find.byType(Scrollable).first, const Offset(0, 3000));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.ensureVisible(find.text('Business Studies').first);
    await tester.pump();
    await tester.tap(find.text('Business Studies').first);
    await tester.pump(const Duration(milliseconds: 200));
    // The quote for the new subject is still on its way: nothing under the thumb moved.
    expect(find.text(PracticeCopy.smartTitle, skipOffstage: false), findsOneWidget);
    gate.complete(dailyFree());
    await _settle(tester);
    expect(find.text(PracticeCopy.smartTitle, skipOffstage: false), findsOneWidget);
  });

  testWidgets('practice-04: a quote that says the mode is not offered still removes the row', (tester) async {
    final quotes = FakeQuoteRepository((s, m, c, p) => m == 'smart' && s == 'business_studies' ? modeUnavailable() : dailyFree(count: c ?? 10));
    await pumpRouted(
      tester,
      location: '/practice',
      routes: _routes(),
      overrides: practiceOverrides(quotes: quotes, attempts: const [], auth: signedIn(subjects: ['accountancy', 'business_studies'])),
    );
    await _settle(tester);
    await tester.ensureVisible(find.text('Business Studies').first);
    await tester.pump();
    await tester.tap(find.text('Business Studies').first);
    await _settle(tester);
    expect(find.text(PracticeCopy.smartTitle, skipOffstage: false), findsNothing);
  });

  for (final scale in [1.0, 1.3]) {
    testWidgets('practice-06: a long suggestion title stays clear of the subject object at ${scale}x text', (tester) async {
      tester.view.physicalSize = const Size(360, 640) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(Brightness.light),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)), child: app!),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: SuggestionCard(
                subjectId: 'accountancy',
                overline: 'Suggested',
                number: '10',
                unit: 'questions',
                title: 'Accounting for Partnership Firms Fundamentals and Reconstitution',
                reason: 'You missed 3 here.',
                actionLabel: 'Start',
                onAction: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));
      final title = tester.getRect(find.textContaining('Accounting for Partnership'));
      // The object is drawn 136 dp, centred in its 156 dp box: its ink starts 10 dp inside the box.
      final art = tester.getRect(find.byType(SubjectEmblem));
      expect(title.right + MmSpace.s12, lessThanOrEqualTo(art.left));
      // One object on the card, no Mobi beside it (SPACING.md 5).
      expect(find.byType(MobiCharacter), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }

  for (final scale in [1.0, 1.3, 1.6]) {
    testWidgets('finding 5: the hero title is the subject and never ends in an ellipsis at ${scale}x text', (tester) async {
      tester.view.physicalSize = const Size(360, 640) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(Brightness.dark),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)), child: app!),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: SuggestionCard(
                subjectId: 'business_studies',
                overline: PracticeCopy.suggestedOverline,
                number: '10',
                unit: PracticeCopy.questionsUnit,
                title: PracticeCopy.subjectTitle('Business Studies'),
                kicker: PracticeCopy.subjectKicker,
                reason: 'Ten questions shows where you stand.',
                actionLabel: 'Start',
                onAction: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));
      for (final text in ['Business Studies', PracticeCopy.subjectKicker]) {
        final paragraph = tester.renderObject<RenderParagraph>(find.text(text));
        expect(paragraph.didExceedMaxLines, isFalse, reason: '"$text" fits its lines at ${scale}x');
      }
      expect(PracticeCopy.subjectTitle('Business Studies'), isNot(contains('quick')), reason: 'the kind of paper is the kicker');
    });
  }

  testWidgets('practice-10: Show me opens every question the observation names', (tester) async {
    final questions = [
      for (var i = 0; i < 4; i++) ('Goodwill', V.right),
      for (var i = 0; i < 3; i++) ('Goodwill', V.wrong),
    ];
    final detail = AttemptDetail.fromJson({
      ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
      'answerReviews': <String, dynamic>{},
      'answerReviewState': 'ready',
    });
    await pumpRouted(
      tester,
      location: '/practice/result/p1',
      routes: _routes(),
      overrides: resultOverrides(attemptId: 'p1', detail: detail, chapter: 'Goodwill'),
    );
    await tester.pump(const Duration(milliseconds: 500));
    // No row starts open: the next move's key opens one (RESULT-1017 4.5).
    expect(find.text('Your answer'), findsNothing);
    // What this set shows lives in the "Where the marks went" fold.
    final fold = find.text('Where the marks went');
    await tester.scrollUntilVisible(fold, 200, scrollable: find.byType(Scrollable).first);
    await Scrollable.ensureVisible(tester.element(fold), alignment: 0.3);
    await tester.pump();
    await tester.tap(fold);
    for (var t = 0; t < 500; t += 16) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    await tester.scrollUntilVisible(find.text('3 of your 3 mistakes were in Goodwill'), 200, scrollable: find.byType(Scrollable).first);
    final show = find.textContaining('Show me').last;
    await Scrollable.ensureVisible(tester.element(show), alignment: 0.3);
    await tester.pump();
    await tester.tap(show);
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Your answer'), findsNWidgets(3));
    await tester.pump(const Duration(seconds: 1));
  });
}
