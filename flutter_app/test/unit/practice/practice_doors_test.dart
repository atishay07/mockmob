// Practice C, "three doors" (19 Oct PM, owner D126; his H6 and H7): a Practise / Your papers / Learn switch under the
// Practice title. Practise carries the ways to practise on top (above the next set), every mode listed (Pro ones locked
// while billing is off, D101); Your papers and Learn are whole doors, shown in place, not rows that read as extra. The
// address names the door, so a tab switch and a Back keep it for the session, and every old link still lands.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show LogicalKeyboardKey;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/router.dart' show papersLocationFor, practiceDoorFor;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/insights/copy.dart' show InsightsCopy;
import 'package:mockmob/features/learn/copy.dart' show LearnCopy;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/door_stage.dart';
import 'package:mockmob/features/review/copy.dart' show ReviewCopy;

import '../../golden/review/review_golden_support.dart' show reviewOverrides;
import '../../helpers/fonts.dart';
import '../learn/support/learn_fixtures.dart' as learn;
import 'support/harness.dart';

const _phone = Size(360, 780);

FakeQuoteRepository _freeQuotes() => FakeQuoteRepository((s, m, c, p) {
  if (m == 'full') return creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
  if (m == 'nta' || m == 'smart') return proGate();
  return dailyFree(count: c ?? 10);
});

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  // The app's own redirects: `/practice/papers` and `/learn` alone open their door; `/review` lands on Your papers.
  GoRoute(path: '/practice/papers', redirect: (c, s) => practiceDoorFor(s.uri), builder: (c, s) => const SizedBox()),
  GoRoute(path: '/learn', redirect: (c, s) => practiceDoorFor(s.uri), builder: (c, s) => const SizedBox()),
  GoRoute(path: '/review', redirect: (c, s) => papersLocationFor(s.uri)),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/start'),
  stubRoute('/practice/stream'),
  stubRoute('/exam/nta'),
  stubRoute('/tools/compass'),
  stubRoute('/run/:sessionId'),
  stubRoute('/other'),
];

/// Practice's overrides, with Your papers' record (a fresh one unless [papers]) for the door that shows it.
List<Override> _overrides({int? openRepairs, bool lessons = true, bool learnOff = false}) {
  final practice = practiceOverrides(
    quotes: _freeQuotes(),
    attempts: const [],
    openRepairs: openRepairs,
    learn: learnOff ? learn.catalog(state: 'disabled') : (lessons ? learn.catalog(due: 0) : null),
  );
  final taken = {for (final o in practice) o.origin};
  return [...practice, for (final o in reviewOverrides(attempts: const [])) if (!taken.contains(o.origin)) o];
}

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
  await tester.pump(const Duration(seconds: 1));
}

Finder _door(String name) => find.byKey(ValueKey('practice-door-$name'));

void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> pump(WidgetTester tester, {String location = '/practice', int? openRepairs, bool lessons = true, bool learnOff = false, double textScale = 1, Brightness brightness = Brightness.dark}) async {
    final router = await pumpRouted(
      tester,
      location: location,
      routes: _routes(),
      overrides: _overrides(openRepairs: openRepairs, lessons: lessons, learnOff: learnOff),
      size: _phone,
      textScale: textScale,
      brightness: brightness,
    );
    await _settle(tester);
    return router;
  }

  group('the switch', () {
    testWidgets('three doors under the title, Practise chosen on a fresh account, each a 44 dp target that says so', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester);
      for (final name in ['practise', 'papers', 'learn']) {
        expect(_door(name), findsOneWidget, reason: name);
        final size = tester.getSize(_door(name));
        expect(size.height, greaterThanOrEqualTo(44), reason: '$name height');
        expect(size.width, greaterThanOrEqualTo(48), reason: '$name width');
        expect(tester.getTopLeft(_door(name)).dy, lessThan(160), reason: 'right under the title');
      }
      expect(find.text(PracticeCopy.doorPractise), findsOneWidget);
      expect(find.text(PracticeCopy.doorPapers), findsOneWidget);
      expect(find.text(PracticeCopy.doorLearn), findsOneWidget);
      expect(tester.getSemantics(_door('practise')), isSemantics(isSelected: true, isButton: true, isInMutuallyExclusiveGroup: true));
      expect(tester.getSemantics(_door('papers')), isSemantics(isSelected: false, isButton: true, isInMutuallyExclusiveGroup: true));
      handle.dispose();
    });

    testWidgets('a keyboard reaches a door and opens it with Enter', (tester) async {
      final router = await pump(tester);
      Focus.of(tester.element(find.text(PracticeCopy.doorPapers))).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice?door=papers');
    });

    testWidgets('Your papers counts the open mistakes, and a screen reader hears them', (tester) async {
      final handle = tester.ensureSemantics();
      await pump(tester, openRepairs: 12);
      expect(find.descendant(of: _door('papers'), matching: find.text('12')), findsOneWidget);
      expect(tester.getSemantics(_door('papers')).label, contains('Your papers, 12 mistakes to repair'));
      handle.dispose();
      expect(PracticeCopy.doorPapersSemantics(1), 'Your papers, 1 mistake to repair');
      expect(PracticeCopy.doorPapersSemantics(0), 'Your papers');
    });

    testWidgets('with Learn switched off on the server there are two doors, and a Learn link opens Practise', (tester) async {
      await pump(tester, location: '/learn', learnOff: true);
      expect(_door('learn'), findsNothing);
      expect(_door('practise'), findsOneWidget);
      expect(find.text(PracticeCopy.waysHeading), findsOneWidget);
    });

    testWidgets('at 360 dp and text 1.6 the words wrap whole and nothing overflows', (tester) async {
      await pump(tester, openRepairs: 98, textScale: 1.6);
      expect(tester.takeException(), isNull);
      expect(find.text(PracticeCopy.doorPapers), findsOneWidget);
      expect(find.text('98'), findsOneWidget);
    });
  });

  group('Practise', () {
    testWidgets('the ways to practise come before the next set (H6), and the two first modes are on the first screen', (tester) async {
      await pump(tester);
      final ways = tester.getTopLeft(find.text(PracticeCopy.waysHeading)).dy;
      expect(ways, lessThan(_phone.height));
      expect(tester.getTopLeft(find.text(PracticeCopy.quickTitle)).dy, lessThan(_phone.height));
      expect(tester.getTopLeft(find.text(PracticeCopy.chapterTitle)).dy, lessThan(_phone.height));
      final upNext = find.textContaining('Up next in ', skipOffstage: false);
      expect(upNext, findsOneWidget);
      expect(tester.getTopLeft(upNext).dy, greaterThan(ways));
    });

    testWidgets('every mode is listed on a fresh Free account, Smart practice and NTA mode with the Pro tag (D101)', (tester) async {
      await pump(tester);
      final list = find.byType(Scrollable).first;
      for (final title in [PracticeCopy.quickTitle, PracticeCopy.chapterTitle, PracticeCopy.smartTitle, PracticeCopy.fullMockTitle, PracticeCopy.ntaTitle]) {
        await tester.scrollUntilVisible(find.text(title), 200, scrollable: list);
        expect(find.text(title), findsOneWidget, reason: title);
      }
      expect(find.text(PracticeCopy.proTag, skipOffstage: false), findsNWidgets(2));
    });

    testWidgets('More ways in has Untimed questions (renamed from Question stream) and the Admission Compass', (tester) async {
      await pump(tester);
      await tester.scrollUntilVisible(find.text(InsightsCopy.streamEntryTitle), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('Untimed questions'), findsOneWidget);
      expect(find.text('One question at a time, with the reason after each answer.'), findsOneWidget);
      expect(find.text('Question stream', skipOffstage: false), findsNothing);
      expect(find.text(PracticeCopy.toolsTitle, skipOffstage: false), findsOneWidget);
    });
  });

  group('Your papers', () {
    testWidgets('a tap opens it in place: the address says so, the switch moves, a fresh account sees its first step', (tester) async {
      final router = await pump(tester);
      await tester.tap(_door('papers'));
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice?door=papers');
      expect(find.text(ReviewCopy.firstPaperTitle), findsOneWidget);
      expect(find.text(PracticeCopy.waysHeading), findsNothing, reason: 'Practise is out of sight, kept as it was');
      expect(find.text(PracticeCopy.waysHeading, skipOffstage: false), findsOneWidget);
      // The title and Ask Mobi stay: one place, three doors.
      expect(find.text(PracticeCopy.tabTitle), findsOneWidget);
    });

    testWidgets('every old way in still opens it: /practice/papers, /review and a paper link', (tester) async {
      for (final (from, to) in [
        ('/practice/papers', '/practice?door=papers'),
        ('/review', '/practice?door=papers'),
        ('/review?paper=a1', '/practice?paper=a1&door=papers'),
      ]) {
        final router = await pump(tester, location: from);
        expect(router.state.uri.toString(), to, reason: from);
        expect(find.text(ReviewCopy.firstPaperTitle), findsOneWidget, reason: from);
      }
    });
  });

  group('Learn', () {
    testWidgets('a tap opens the library in place; /learn opens the same door', (tester) async {
      final router = await pump(tester);
      await tester.tap(_door('learn'));
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice?door=learn');
      expect(find.text(LearnCopy.subtitle), findsOneWidget);
      final again = await pump(tester, location: '/learn');
      expect(again.state.uri.toString(), '/practice?door=learn');
      expect(find.text(LearnCopy.subtitle), findsOneWidget);
    });
  });

  group('memory and motion', () {
    testWidgets('the door is kept when the student leaves and comes back (Back, or the same address from a tab)', (tester) async {
      final router = await pump(tester);
      await tester.tap(_door('papers'));
      await _settle(tester);
      unawaited(router.push('/other'));
      await _settle(tester);
      router.pop();
      await _settle(tester);
      expect(router.state.uri.toString(), '/practice?door=papers');
      expect(find.text(ReviewCopy.firstPaperTitle), findsOneWidget);
    });

    testWidgets('a change of door is one calm fade-through of about 300 ms: out, then in, never both', (tester) async {
      await pump(tester);
      await tester.tap(_door('learn'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 45));
      final opacity = tester.widget<Opacity>(find.descendant(of: find.byType(PracticeDoorStage), matching: find.byType(Opacity)).first);
      expect(opacity.opacity, inExclusiveRange(0.0, 1.0), reason: 'the old door is lifting out');
      expect(find.text(PracticeCopy.waysHeading), findsOneWidget, reason: 'still the old door at 45 ms');
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(LearnCopy.subtitle), findsOneWidget, reason: 'the new door after the out half');
      await tester.pump(const Duration(milliseconds: 200));
      final landed = tester.widget<Opacity>(find.descendant(of: find.byType(PracticeDoorStage), matching: find.byType(Opacity)).first);
      expect(landed.opacity, 1);
      expect(PracticeDoorStage.outTime + PracticeDoorStage.inTime, const Duration(milliseconds: 300));
    });

    testWidgets('under reduced motion the door changes at once', (tester) async {
      await pump(tester);
      tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
      await tester.pump();
      await tester.tap(_door('learn'));
      await tester.pump();
      await tester.pump();
      expect(find.text(LearnCopy.subtitle), findsOneWidget);
      expect(find.text(PracticeCopy.waysHeading), findsNothing);
      await _settle(tester);
    });
  });

  test('the address of each door, and the paths that redirect to one', () {
    expect(PracticeDoor.parse(null), PracticeDoor.practise);
    expect(PracticeDoor.parse('papers'), PracticeDoor.papers);
    expect(PracticeDoor.parse('learn'), PracticeDoor.learn);
    expect(PracticeDoor.parse('nonsense'), PracticeDoor.practise);
    expect(PracticeDoor.practise.location, '/practice');
    expect(PracticeDoor.papers.location, AppRoutes.papersDoor);
    expect(PracticeDoor.learn.location, AppRoutes.learnDoor);
    expect(practiceDoorFor(Uri.parse('/practice/papers')), '/practice?door=papers');
    expect(practiceDoorFor(Uri.parse('/practice/papers/')), '/practice?door=papers');
    expect(practiceDoorFor(Uri.parse('/practice/papers/mistakes')), isNull, reason: 'its own pages keep their paths');
    expect(practiceDoorFor(Uri.parse('/learn')), '/practice?door=learn');
    expect(practiceDoorFor(Uri.parse('/learn/unit-1')), isNull);
    expect(AppRoutes.opensWithGo('/review'), isTrue);
    expect(AppRoutes.opensWithGo('/review?paper=a'), isTrue);
    expect(AppRoutes.opensWithGo('/learn'), isTrue);
    expect(AppRoutes.opensWithGo('/review/mistakes'), isFalse);
    expect(AppRoutes.opensWithGo('/learn/unit-1'), isFalse);
  });
}
