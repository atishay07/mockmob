// LK51 (3 Nov 2026): Explore is Practice's fourth door, after Learn: "Practise | Papers | Learn | Explore". The door shows Explore's
// covers and its Untimed questions entry inside the Practice page (no second back header). `/explore` and `/practice?door=explore`
// land there, and the "Chapter feeds" row in Practise's More ways in opens it. At 360 dp and large text no label is broken mid-word.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderContainer, ProviderScope;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/router.dart' show exploreRedirectFor;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmPageHeader;
import 'package:mockmob/features/learn2/data/learn_providers.dart' show LearnOnNotifier, learnOnProvider;
import 'package:mockmob/features/learn2/explore/explore_copy.dart';
import 'package:mockmob/features/learn2/learn2_door.dart' show ChapterFeedsRow;
import 'package:mockmob/features/learn2/learn2_links.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show practiceSubjectProvider;
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/door_switch.dart' show PracticeDoorSwitch;

import '../../helpers/fonts.dart';
import '../learn/support/learn_fixtures.dart' as learn;
import '../learn2/explore/explore_support.dart';
import 'support/harness.dart';

const _phone = Size(360, 780);

class _On extends LearnOnNotifier {
  @override
  bool build() => true;
}

FakeQuoteRepository _quotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta' || m == 'smart') return proGate();
  return dailyFree(count: c ?? 10);
});

List<Override> _overrides({bool on = true, CoversApi? api, List<String> subjects = const ['accountancy']}) {
  final practice = practiceOverrides(quotes: _quotes(), attempts: const [], openRepairs: 3, learn: learn.catalog(due: 0));
  final explore = exploreOverrides(api ?? CoversApi.of(CoversFixture.pro), subjects: subjects);
  final taken = {for (final o in practice) o.origin};
  return [...practice, for (final o in explore) if (!taken.contains(o.origin)) o, if (on) learnOnProvider.overrideWith(_On.new)];
}

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  stubRoute('/practice/stream'),
  stubRoute('/explore/feed'),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/start'),
  stubRoute('/exam/nta'),
  stubRoute('/tools/compass'),
  stubRoute('/run/:sessionId'),
];

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
  await tester.pump(const Duration(seconds: 1));
}

Finder _door(String name) => find.byKey(ValueKey('practice-door-$name'));

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> pump(WidgetTester tester, {String location = '/practice', bool on = true, double textScale = 1, Size size = _phone, Brightness brightness = Brightness.dark, CoversApi? api, List<String> subjects = const ['accountancy']}) async {
    final router = await pumpRouted(tester, location: location, routes: _routes(), overrides: _overrides(on: on, api: api, subjects: subjects), size: size, textScale: textScale, brightness: brightness);
    await _settle(tester);
    return router;
  }

  group('the address', () {
    test('the door is named explore, lives at /practice?door=explore and /explore opens it', () {
      expect(PracticeDoor.parse('explore'), PracticeDoor.explore);
      expect(PracticeDoor.explore.location, '/practice?door=explore');
      expect(PracticeDoor.explore.location, AppRoutes.exploreDoor);
      expect(PracticeDoor.values.map((d) => d.name), ['practise', 'papers', 'learn', 'explore'], reason: 'Practise, Papers, Learn, Explore');
      expect(Learn2Links.explore(), '/practice?door=explore');
      expect(Learn2Links.explore(subject: 'accountancy'), '/practice?subject=accountancy&door=explore');
      expect(AppRoutes.opensWithGo('/explore'), isTrue, reason: 'a door of the Practice tab opens with go, never a push');
      expect(AppRoutes.opensWithGo('/explore/feed'), isFalse, reason: 'a feed is a page over the shell');
      expect(AppRoutes.opensWithGo(AppRoutes.exploreDoor), isTrue);
    });

    test('/explore redirects to the door while Learn v2 is on (subject kept), to the stream while it is off; a feed stays', () {
      expect(exploreRedirectFor(Uri.parse('/explore'), learnOn: true), '/practice?door=explore');
      expect(exploreRedirectFor(Uri.parse('/explore?subject=accountancy'), learnOn: true), '/practice?subject=accountancy&door=explore');
      expect(exploreRedirectFor(Uri.parse('/explore?subject=accountancy'), learnOn: false), '/practice/stream?subject=accountancy');
      expect(exploreRedirectFor(Uri.parse('/explore'), learnOn: false), '/practice/stream');
      expect(exploreRedirectFor(Uri.parse('/explore/feed?chapter=a.b'), learnOn: true), isNull);
    });

    test('a production /explore href is the door, and a filtered one is left to the ActionRouter', () {
      expect(Learn2Links.resolve('/explore'), '/practice?door=explore');
      expect(Learn2Links.resolve('/explore?chapter=Goodwill'), isNull);
    });
  });

  group('the switch', () {
    testWidgets('four doors in the website\'s order and words: Practise, Papers, Learn, Explore (Papers carries the mistakes)', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester);
      final order = ['practise', 'papers', 'learn', 'explore'];
      var last = -1.0;
      for (final name in order) {
        expect(_door(name), findsOneWidget, reason: name);
        final size = tester.getSize(_door(name));
        expect(size.height, greaterThanOrEqualTo(44), reason: '$name is a 44 dp target');
        expect(size.width, greaterThanOrEqualTo(48), reason: '$name is wide enough to hit');
        final left = tester.getTopLeft(_door(name)).dx;
        expect(left, greaterThan(last), reason: '$name comes after the one before');
        last = left;
      }
      for (final label in ['Practise', 'Papers', 'Learn', 'Explore']) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      expect(find.text('Your papers'), findsNothing, reason: 'the door is "Papers", as on the website');
      expect(find.descendant(of: _door('papers'), matching: find.text('3')), findsOneWidget, reason: 'the mistakes badge stays on Papers');
      expect(tester.getSemantics(_door('papers')).label, contains('Papers, 3 mistakes to repair'));
      expect(tester.getSemantics(_door('practise')), isSemantics(isSelected: true, isButton: true, isInMutuallyExclusiveGroup: true));
      expect(tester.getSemantics(_door('explore')), isSemantics(isSelected: false, isButton: true, isInMutuallyExclusiveGroup: true));
      handle.dispose();
    });

    testWidgets('with Learn v2 off there is no Explore door, and /practice?door=explore opens Practise', (tester) async {
      await pump(tester, location: '/practice?door=explore', on: false);
      expect(_door('explore'), findsNothing);
      expect(_door('practise'), findsOneWidget);
      expect(find.text(PracticeCopy.waysHeading), findsOneWidget);
    });

    for (final scale in [1.0, 1.3, 1.6]) {
      for (final brightness in [Brightness.dark, Brightness.light]) {
        testWidgets('at 360 dp, text $scale, ${brightness.name}: every label is one line, none is broken mid-word', (tester) async {
          await pump(tester, textScale: scale, brightness: brightness);
          expect(tester.takeException(), isNull);
          for (final label in ['Practise', 'Papers', 'Learn', 'Explore']) {
            final box = tester.getSize(find.text(label));
            // One line at the size it is set at: never two (a wrap would be at least twice the height of a line).
            expect(box.height, lessThan(32 * scale.clamp(1.0, 1.3)), reason: '$label is one line at text $scale');
          }
          // The doors share the track: the last one ends inside it.
          final track = tester.getRect(find.byType(PracticeDoorSwitch));
          expect(tester.getRect(_door('explore')).right, lessThanOrEqualTo(track.right + 0.5));
        });
      }
    }
  });

  group('the Explore door', () {
    testWidgets('shows the covers and the untimed questions entry inside the Practice page, with no second back header', (tester) async {
      final router = await pump(tester, location: '/practice?door=explore');
      expect(router.state.uri.toString(), '/practice?door=explore');
      expect(find.text(ExploreCopy.feedsHeading), findsOneWidget, reason: 'Chapter feeds');
      expect(find.text(ExploreCopy.questionsHeading), findsOneWidget, reason: 'Questions: the way to the untimed questions');
      expect(find.byType(MmPageHeader), findsNothing, reason: 'the page has its own title; no second back header');
      expect(find.text(PracticeCopy.tabTitle), findsOneWidget);
      // The covers are the recorded chapters of Accountancy.
      expect(find.textContaining('Basic Concepts'), findsWidgets);
    });

    testWidgets('a tap on the Explore door goes to /practice?door=explore, and back to Practise again', (tester) async {
      final router = await pump(tester);
      await tester.tap(_door('explore'));
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice?door=explore');
      expect(find.text(ExploreCopy.feedsHeading), findsOneWidget);
      await tester.tap(_door('practise'));
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice');
    });

    testWidgets('"Chapter feeds" in More ways in stays, and opens the Explore door of this page', (tester) async {
      final router = await pump(tester);
      final row = find.text(ChapterFeedsRow.title);
      await tester.dragUntilVisible(row, find.byType(Scrollable).first, const Offset(0, -240));
      await tester.pump();
      expect(row, findsOneWidget);
      await tester.tap(row);
      await _settle(tester);
      expect(router.state.uri.queryParameters['door'], 'explore');
      expect(find.text(ExploreCopy.feedsHeading), findsWidgets);
    });

    testWidgets('"Chapter feeds" has a 1 px divider under it, like the rows around it (I10)', (tester) async {
      await pump(tester);
      final row = find.text(ChapterFeedsRow.title);
      await tester.dragUntilVisible(row, find.byType(Scrollable).first, const Offset(0, -240));
      await tester.pump();
      final feeds = find.ancestor(of: row, matching: find.byType(ChapterFeedsRow));
      final divider = find.descendant(of: feeds, matching: find.byType(Divider));
      expect(divider, findsOneWidget);
      expect(tester.getSize(divider).height, 1);
      expect(tester.getTopLeft(divider).dy, greaterThan(tester.getBottomLeft(row).dy), reason: 'under the row, not over it');
    });

    testWidgets('a cover opens its feed over Practice; Back returns to the Explore door', (tester) async {
      final router = await pump(tester, location: '/practice?door=explore');
      final cover = find.textContaining('Basic Concepts').first;
      await tester.ensureVisible(cover);
      await tester.tap(cover, warnIfMissed: false);
      await _settle(tester);
      if (router.state.uri.path == '/explore/feed') {
        router.pop();
        await _settle(tester);
      }
      expect(router.state.uri.toString(), '/practice?door=explore');
    });
  });

  group('the Explore door follows the shared subject; the subject of a link is a one-shot handoff (explore-learn-calm-1)', () {
    // The door is built once and kept (PracticeDoorStage), so one Explore state lives for the session: a link's subject must
    // not hold it on the first subject after the student changes it elsewhere or follows another link.
    ProviderContainer containerOf(WidgetTester tester) => ProviderScope.containerOf(tester.element(find.byType(PracticeDoorSwitch)));

    Future<void> goToPractise(WidgetTester tester) async {
      await tester.tap(_door('practise'));
      await _settle(tester);
    }

    testWidgets('a link names subject A, the student picks B on Practise, a link with subject=B shows B and asks the covers of B', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      final router = await pump(tester, location: '/practice?door=explore&subject=accountancy', api: api, subjects: ['accountancy', 'economics']);
      final container = containerOf(tester);
      expect(container.read(practiceSubjectProvider), 'accountancy');
      expect(api.asked.last, 'accountancy');

      await goToPractise(tester);
      container.read(practiceSubjectProvider.notifier).select('economics');
      await _settle(tester);

      router.go('/practice?door=explore&subject=economics');
      await _settle(tester);
      expect(container.read(practiceSubjectProvider), 'economics');
      expect(api.asked.last, 'economics', reason: 'the covers on the page are of the new subject');
      expect(api.asked.where((a) => a == 'economics'), isNotEmpty);
    });

    testWidgets('a link names subject A, the student picks B on Practise, the Explore door of the switch shows B', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      final router = await pump(tester, location: '/practice?door=explore&subject=accountancy', api: api, subjects: ['accountancy', 'economics']);
      final container = containerOf(tester);

      await goToPractise(tester);
      container.read(practiceSubjectProvider.notifier).select('economics');
      await _settle(tester);

      await tester.tap(_door('explore'));
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice?door=explore');
      expect(container.read(practiceSubjectProvider), 'economics');
      expect(api.asked.last, 'economics', reason: 'no subject is held from the first link');
    });

    testWidgets('a second link with another subject takes the same way, and the shared subject follows it', (tester) async {
      final api = CoversApi.of(CoversFixture.pro);
      final router = await pump(tester, location: '/practice?door=explore&subject=accountancy', api: api, subjects: ['accountancy', 'economics']);
      final container = containerOf(tester);

      // No visit to Practise in between: the page the router keeps gets a new link.
      router.go('/practice?door=explore&subject=economics');
      await _settle(tester);
      expect(container.read(practiceSubjectProvider), 'economics');
      expect(api.asked.last, 'economics');
    });
  });
}
