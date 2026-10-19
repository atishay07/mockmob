// Colleges A and B (19 Oct PM, owner D126, his H9: "where is that college section now? I am unable to find it"). A: a
// "Your colleges" card at the top of You with the colleges that need the most marks and their real 2026 Round 1
// figures (D103, D104), "See all N" and "Admission Compass". B: a "Your colleges" strip under Today's greeting that
// opens the full list. A fresh account with no colleges sees an honest invite on both, never an empty card.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/quote_repository.dart' show quoteRepositoryProvider;
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/today_header.dart';
import 'package:mockmob/features/tools/data/my_colleges_actions.dart';
import 'package:mockmob/features/tools/my_colleges/colleges_doors.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../practice/support/harness.dart' show FakeQuoteRepository, creditsQuote, pumpRouted, stubRoute;
import '../today/support/today_fixtures.dart';
import '../you/you_test_support.dart';

const _srcc = LadderPick(college: 'Shri Ram College of Commerce', course: 'B.Com (Hons)', closingScore: 924.3009, outOf: 1000, programmeId: 'bcom-hons');
const _hindu = LadderPick(college: 'Hindu College', course: 'B.Com (Hons)', closingScore: 919.9, outOf: 1000);
const _lsr = LadderPick(college: 'Lady Shri Ram College for Women', course: 'B.Com (Hons)', closingScore: 912.5, outOf: 1000);
const _hansraj = LadderPick(college: 'Hansraj College', course: 'B.Com (Hons)', closingScore: 908.2, outOf: 1000);
const _ramjas = LadderPick(college: 'Ramjas College', course: 'B.Com (Hons)', closingScore: 895.6, outOf: 1000);

const _five = YourColleges(status: YourCollegesStatus.some, picks: [_srcc, _hindu, _lsr, _hansraj, _ramjas]);
const _none = YourColleges(status: YourCollegesStatus.none);

Future<GoRouter> _routed(WidgetTester tester, Widget child, YourColleges colleges) => pumpRouted(
  tester,
  location: '/',
  size: const Size(360, 780),
  brightness: Brightness.dark,
  routes: [
    GoRoute(path: '/', builder: (c, s) => Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: child))),
    stubRoute('/colleges'),
    stubRoute('/tools/compass'),
  ],
  overrides: [yourCollegesProvider.overrideWithValue(colleges)],
);

/// The strip's words (its icons are text too, so only the Text's own paragraph).
final Finder _stripWords = find.descendant(of: find.descendant(of: find.byType(TodayCollegesStrip), matching: find.byType(Text)), matching: find.byType(RichText)).last;

void main() {
  setUpAll(loadAppFonts);

  group('the shared read', () {
    test('both ways in read Today\'s ladder, hardest first, so their numbers agree', () {
      final container = ProviderContainer(overrides: [
        todayProfileProvider.overrideWithValue(const TodayProfile(ladder: [_hindu, _ramjas, _srcc], category: 'UR')),
        myCollegesProvider.overrideWithValue(const MyCollegesView(status: MyCollegesStatus.ready)),
      ]);
      addTearDown(container.dispose);
      final c = container.read(yourCollegesProvider);
      expect(c.status, YourCollegesStatus.some);
      expect([for (final p in c.picks) p.college], ['Shri Ram College of Commerce', 'Hindu College', 'Ramjas College']);
    });

    test('no colleges: none once the list is read, loading or failed while it is not', () {
      for (final (status, want) in const [
        (MyCollegesStatus.ready, YourCollegesStatus.none),
        (MyCollegesStatus.signedOut, YourCollegesStatus.none),
        (MyCollegesStatus.loading, YourCollegesStatus.loading),
        (MyCollegesStatus.failed, YourCollegesStatus.failed),
      ]) {
        final container = ProviderContainer(overrides: [
          todayProfileProvider.overrideWithValue(null),
          myCollegesProvider.overrideWithValue(MyCollegesView(status: status)),
        ]);
        expect(container.read(yourCollegesProvider).status, want, reason: '$status');
        container.dispose();
      }
    });

    test('the lines read as whole sentences, with the real figure and DU\'s short name', () {
      expect(shortCollegeName(_srcc), 'SRCC');
      expect(CollegesDoorCopy.stripSentence(_five), 'You picked 5. The hardest, SRCC, needed 924.3 in 2026.');
      expect(CollegesDoorCopy.stripSentence(const YourColleges(status: YourCollegesStatus.some, picks: [_hindu])), 'You picked ${shortCollegeName(_hindu)}. It needed 919.9 in 2026.');
      const noFigure = LadderPick(college: 'Hindu College', course: 'B.Com (Hons)');
      expect(CollegesDoorCopy.stripSentence(const YourColleges(status: YourCollegesStatus.some, picks: [noFigure, _ramjas])), 'You picked 2. Open the list to see each 2026 cutoff.');
      // The strip's one line, longest first: each is true on its own, and the shortest still names the list.
      expect([for (final l in CollegesDoorCopy.stripLines(_five)) l.text], [
        'Your 5 colleges · SRCC needed 924.3 in 2026',
        'Your 5 colleges · SRCC needed 924.3',
        'Your colleges · SRCC needed 924.3',
        'Your 5 colleges',
        'Your colleges',
      ]);
      expect([for (final l in CollegesDoorCopy.stripLines(_none)) l.text], ['Choose your colleges · see 2026 cutoffs', 'Choose your colleges', 'Choose colleges']);
      expect(CollegesDoorCopy.cardLine(_five), '5 colleges for B.Com (Hons). Each number is the lowest score that got in at Round 1 in 2026, for the unreserved category.');
    });
  });

  group('B. Today\'s strip', () {
    String shown(WidgetTester tester) {
      final text = tester.renderObject<RenderParagraph>(_stripWords);
      return text.text.toPlainText();
    }

    testWidgets('with colleges it names the hardest with its figure on one line, and opens the full list', (tester) async {
      final router = await _routed(tester, const TodayCollegesStrip(), _five);
      expect(shown(tester), 'Your colleges · SRCC needed 924.3', reason: 'the longest line that fits at 360 dp');
      expect(tester.getSize(find.byKey(const ValueKey('today-colleges-strip'))).height, TodayCollegesStrip.height);
      expect(find.bySemanticsLabel('Your colleges. You picked 5. The hardest, SRCC, needed 924.3 in 2026.'), findsOneWidget, reason: 'the whole sentence for a screen reader');
      await tester.tap(find.byType(TodayCollegesStrip));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/colleges');
    });

    testWidgets('a fresh account sees an honest invite on one line, never an empty strip', (tester) async {
      await _routed(tester, const TodayCollegesStrip(), _none);
      expect(shown(tester), 'Choose your colleges', reason: 'the longest invite that fits at 360 dp');
      expect(find.textContaining('Your colleges'), findsNothing);
    });

    testWidgets('a list that did not load still opens Colleges, and says so', (tester) async {
      final router = await _routed(tester, const TodayCollegesStrip(), const YourColleges(status: YourCollegesStatus.failed));
      expect(shown(tester), 'Your colleges · ${CollegesDoorCopy.failedRest}');
      await tester.tap(find.byType(TodayCollegesStrip));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/colleges');
    });

    // The strip is ONE line at every width and text size a phone gives it: it drops words, never wraps, never cuts.
    for (final scale in const [1.0, 1.3, 1.6, 2.0]) {
      for (final width in const [320.0, 360.0, 412.0]) {
        for (final (name, colleges) in [
          ('five', _five),
          ('none', _none),
          ('failed', const YourColleges(status: YourCollegesStatus.failed)),
          ('loading', const YourColleges(status: YourCollegesStatus.loading)),
        ]) {
          testWidgets('one line: $name at $width dp, text $scale', (tester) async {
            await pumpRouted(
              tester,
              location: '/',
              size: Size(width, 780),
              textScale: scale,
              routes: [GoRoute(path: '/', builder: (c, s) => const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: TodayCollegesStrip())))],
              overrides: [yourCollegesProvider.overrideWithValue(colleges)],
            );
            expect(tester.takeException(), isNull);
            final strip = tester.getRect(find.byKey(const ValueKey('today-colleges-strip')));
            // Up to text 1.6 the strip is one line, 48 dp in every state, so nothing under it moves. At 2.0 on the
            // narrowest phone even "Choose colleges" is too wide: there it wraps whole rather than cut a word.
            final oneLine = scale <= 1.6 || width >= 360;
            if (oneLine) expect(strip.height, TodayCollegesStrip.height, reason: 'the same height in every state, so nothing under it moves');
            final paragraph = tester.renderObject<RenderParagraph>(_stripWords);
            final line = paragraph.text.toPlainText();
            expect(line, isNotEmpty);
            expect(paragraph.didExceedMaxLines, isFalse, reason: 'nothing cut');
            final painter = TextPainter(text: paragraph.text, textDirection: TextDirection.ltr, textScaler: paragraph.textScaler)..layout(maxWidth: oneLine ? double.infinity : paragraph.size.width);
            expect(painter.width, lessThanOrEqualTo(paragraph.size.width + 0.5), reason: '"$line" fits whole, nothing faded or cut');
            if (oneLine) expect(painter.computeLineMetrics().length, 1, reason: '"$line" is one line');
            painter.dispose();
          });
        }
      }
    }

    testWidgets('it sits right under the greeting, above the move, and the colleges block at the end stays', (tester) async {
      await pumpMockmob(
        tester,
        TodayBody(view: buildToday(ashaInputs()), skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
        size: const Size(384, 1900),
        disableAnimations: true,
        overrides: [
          authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
          quoteRepositoryProvider.overrideWithValue(FakeQuoteRepository((s, m, c, p) => creditsQuote(cost: 10, balance: 390, mode: m, count: c ?? 10))),
          yourCollegesProvider.overrideWithValue(_five),
        ],
      );
      final header = tester.getRect(find.byType(TodayHeader));
      final strip = tester.getRect(find.byType(TodayCollegesStrip));
      expect(strip.top, greaterThanOrEqualTo(header.bottom));
      expect(strip.top - header.bottom, lessThanOrEqualTo(24), reason: 'just under the greeting');
      expect(strip.top, lessThan(400), reason: 'on the first screen');
      await tester.scrollUntilVisible(find.text('Shri Ram College of Commerce'), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('Shri Ram College of Commerce'), findsOneWidget, reason: "Today's own colleges block stays");
    });
  });

  group('A. You\'s card', () {
    testWidgets('with colleges: the three that need the most marks, each figure of 1000, See all 5 and Admission Compass', (tester) async {
      final router = await _routed(tester, const YouCollegesCard(), _five);
      expect(find.text('Your colleges'), findsOneWidget);
      for (final p in [_srcc, _hindu, _lsr]) {
        expect(find.text(p.college), findsOneWidget, reason: p.college);
      }
      expect(find.text('924.3'), findsOneWidget);
      expect(find.text('919.9'), findsOneWidget);
      expect(find.text('912.5'), findsOneWidget);
      expect(find.text('of 1000'), findsNWidgets(3));
      expect(find.text(_hansraj.college), findsNothing, reason: 'three, then See all');
      expect(find.text('See all 5'), findsOneWidget);
      expect(find.text('Admission Compass'), findsOneWidget);
      await tester.tap(find.text('See all 5'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/colleges');
      router.pop();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Admission Compass'));
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/tools/compass');
    });

    testWidgets('a fresh account: an honest invite to choose, with the Compass one tap away', (tester) async {
      await _routed(tester, const YouCollegesCard(), _none);
      expect(find.text('Choose your colleges'), findsOneWidget, reason: 'the title');
      expect(find.text(CollegesDoorCopy.chooseKey), findsOneWidget, reason: 'its key, not the same words twice');
      expect(find.text(CollegesDoorCopy.chooseCardLine), findsOneWidget);
      expect(find.text('Admission Compass'), findsOneWidget);
      expect(find.text('of 1000'), findsNothing);
    });

    testWidgets('long names wrap whole at 360 dp and text 1.6', (tester) async {
      await pumpRouted(
        tester,
        location: '/',
        size: const Size(360, 780),
        textScale: 1.6,
        routes: [GoRoute(path: '/', builder: (c, s) => const Scaffold(body: SingleChildScrollView(padding: EdgeInsets.all(16), child: YouCollegesCard())))],
        overrides: [yourCollegesProvider.overrideWithValue(_five)],
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Lady Shri Ram College for Women'), findsOneWidget);
      expect(find.text('Admission Compass'), findsOneWidget);
    });

    testWidgets('on You it sits under the name, above the section chips, and the Aim row stays', (tester) async {
      await pumpMockmob(
        tester,
        const YouHubScreen(),
        disableAnimations: true,
        wrapInScaffold: false,
        size: const Size(384, 7000),
        overrides: [...youOverrides(), yourCollegesProvider.overrideWithValue(_five)],
      );
      await tester.pump();
      final card = tester.getRect(find.byType(YouCollegesCard));
      expect(card.top, lessThan(tester.getTopLeft(find.text('Week').first).dy), reason: 'above the chips');
      expect(card.top, lessThan(420), reason: 'on the first screen of You');
      expect(find.text('Aim', skipOffstage: false), findsWidgets, reason: 'the Aim row stays (R3)');
    });
  });
}
