// Learn home, as a student meets it (APP-1101, packet H1): the subject row, the search field and Find in place, the three
// shelf tiles and the set they open, the server's three suggestions and where their keys go, the chapter map with its sort
// and its part switch (LK2), every state, the entrance, text at 1.3 and the 48 dp targets. The server is the fixture
// server (recordings of the web preview's real engine).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn2/cards/find_view.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';
import 'package:mockmob/features/learn2/home/chapter_map.dart';
import 'package:mockmob/features/learn2/home/home_entrance.dart';
import 'package:mockmob/features/learn2/home/home_model.dart';
import 'package:mockmob/features/learn2/home/learn_home.dart';
import 'package:mockmob/features/learn2/home/search_field.dart';
import 'package:mockmob/features/learn2/home/shelf_keys.dart';
import 'package:mockmob/features/learn2/home/subject_row.dart';
import 'package:mockmob/features/learn2/home/suggestions.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';

import '../support/fixture_learn_api.dart';
import 'home_support.dart';

const String _aop = 'accountancy.admission-of-partner';
const String _pf = 'accountancy.partnership-fundamentals';
const String _pl = 'accountancy.profit-and-loss-appropriation-account';

Finder _row(String key) => find.byKey(ValueKey('lh-row-$key'));
Finder _volt() => find.byWidgetPredicate((w) => w is KeyButton && w.variant == KeyVariant.primary);
Finder _key(String label) => find.widgetWithText(KeyButton, label);

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.pump();
  await tester.tap(f.first);
  await tester.pump();
}

/// A key's place in the app: its path and its query.
Future<(String, Map<String, String>)> _go(WidgetTester tester, Finder f, GoRouter router) async {
  await _tap(tester, f);
  await tester.pump(const Duration(seconds: 1));
  final uri = locationOf(router);
  return (uri.path, uri.queryParameters);
}

void main() {
  group('a returning Pro student', () {
    testWidgets('the subjects, the field, the three tiles, the three suggestions and the book in order', (tester) async {
      final api = HomeLearnApi();
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);

      // Subjects: names, and each one's cards due today.
      for (final name in ['Accountancy', 'Economics', 'Business Studies', 'English']) {
        expect(find.text(name), findsOneWidget, reason: name);
      }
      expect(find.text('9 due'), findsOneWidget);
      expect(find.text('6 due'), findsNWidgets(3));
      // The field says what it can find, with the real count.
      expect(find.text('Search 868 Key cards'), findsOneWidget);
      // The three shelf tiles.
      expect(find.byKey(const ValueKey('lh-shelf-due')), findsOneWidget);
      for (final t in ['due today', 'missed lately', 'in Revise']) {
        expect(find.text(t), findsOneWidget, reason: t);
      }
      expect(find.text('26'), findsOneWidget);
      // The server's three: the lead and two compact ones, no kind word, the headline in bold.
      expect(find.text('Pick up Admission of a Partner'), findsOneWidget);
      expect(find.text('You stopped at 6 of 16. About 5 minutes left.'), findsOneWidget);
      expect(find.textContaining('3 cards due', findRichText: true), findsOneWidget);
      expect(find.text('3 open mistakes in Accounting for Partnership: Basic Concepts', findRichText: true), findsOneWidget);
      expect(find.text('Due today, about 1 minute.'), findsOneWidget);
      expect(find.text('From Mock 3 on 16 Oct.'), findsOneWidget);
      // The chapters: every one keyed, parts and units with their words, the ring and the state word.
      expect(find.text('Chapters'), findsOneWidget);
      expect(find.text('Book order'), findsOneWidget);
      expect(find.text('Part 1, Partnership Accounts'), findsOneWidget);
      expect(find.text('Reconstitution of a Partnership firm'), findsOneWidget);
      expect(_row(_aop), findsOneWidget);
      for (final row in LearnFixtures.subject('subject_accountancy_pro').chapters) {
        expect(_row(row.key), findsOneWidget, reason: row.key);
      }
      expect(find.text('Getting there'), findsWidgets);
      expect(find.text('Nothing to practise here yet.'), findsOneWidget);
      // A unit named like its one chapter says nothing twice.
      expect(find.text('Dissolution of Partnership Firm'), findsOneWidget);
      // The page's one volt key is the lead's.
      expect(_volt(), findsOneWidget);
      expect(_key('Pick up, 5 minutes'), findsOneWidget);
      // No kind word, no mastery, no exclamation marks.
      for (final w in tester.widgetList<Text>(find.byType(Text))) {
        final s = w.data ?? w.textSpan?.toPlainText() ?? '';
        expect(s.toLowerCase().contains('mastered') || s.toLowerCase().contains('mastery') || s.contains('!'), isFalse, reason: s);
      }
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('the references are shown where they change, not down a unit', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      // "Ch 2" begins the Reconstitution unit and shows once; the rows under it carry their own meta only.
      expect(find.textContaining('Ch 2', findRichText: true), findsWidgets);
      final refs = [for (final w in tester.widgetList<Text>(find.byType(Text))) if (RegExp(r'^Ch 2(,|$)').hasMatch(w.data ?? '')) w.data];
      expect(refs.length, 2, reason: "Ch 2 shows where it begins (the unit's first chapter and debentures), not down the unit: $refs");
    });
  });

  group('the keys of the suggestions start at once', () {
    testWidgets('pick-up goes to its run with the unfinished run, due to a cards run of exactly its ids, fix to its run', (tester) async {
      final api = HomeLearnApi();
      final router = await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);

      var (path, q) = await _go(tester, _key('Pick up, 5 minutes'), router);
      expect(path, '/learn/session');
      expect(q['chapter'], _aop);
      expect(q['min'], '5');
      expect(q['run'], startsWith('lr_'), reason: 'the unfinished run is picked up where it stopped');
      expect(q.containsKey('kind'), isFalse, reason: 'a mix is the default kind');
      router.pop();
      await settleHome(tester);

      (path, q) = await _go(tester, _key('Revise these'), router);
      expect(path, '/learn/session');
      expect(q['chapter'], _pl);
      expect(q['kind'], 'cards');
      expect(q['min'], '1');
      expect(q['out'], 'questions,mistakes,lesson');
      expect(q['cards']!.split(',').length, 3);
      expect(q['cards'], startsWith('kc.accountancy.profit-and-loss-appropriation-account.'));
      router.pop();
      await settleHome(tester);

      (path, q) = await _go(tester, _key('Fix them, about 3 minutes'), router);
      expect(path, '/learn/session');
      expect(q['chapter'], _pf);
      expect(q['min'], '3');
      expect(q['out'], 'questions,cards,lesson');
      expect(q.containsKey('kind'), isFalse);
    });

    testWidgets('a new student: start, find your level, and the feed through the server\'s href', (tester) async {
      final api = HomeLearnApi(newStudent: true);
      final router = await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);

      expect(find.text('Start with Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(find.text('Find your level'), findsOneWidget);
      expect(find.textContaining('Chapter 1 as a feed', findRichText: true), findsOneWidget);
      expect(_volt(), findsOneWidget);

      var (path, q) = await _go(tester, _key('Start 10 minutes'), router);
      expect((path, q['chapter'], q['min']), ('/learn/session', _pf, '10'));
      router.pop();
      await settleHome(tester);

      (path, q) = await _go(tester, _key('Start 6 minutes'), router);
      expect((path, q['kind'], q['min']), ('/learn/session', 'level', '6'));
      router.pop();
      await settleHome(tester);

      (path, q) = await _go(tester, _key('Open the feed'), router);
      expect((path, q['chapter'], q['min']), ('/explore/feed', _pf, '10'));
    });

    testWidgets('there is exactly one volt key, and every other key is a line key', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(_volt(), findsOneWidget);
      expect(find.byWidgetPredicate((w) => w is KeyButton && w.variant == KeyVariant.secondary), findsNWidgets(2));
    });

    testWidgets('a chapter row opens its page', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      final (path, q) = await _go(tester, _row('accountancy.goodwill-valuation'), router);
      expect(path, '/learn/c/accountancy.goodwill-valuation');
      expect(q, isEmpty);
    });
  });

  group('the subject row', () {
    testWidgets('choosing writes the shared practice subject and the body follows it', (tester) async {
      final api = HomeLearnApi();
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
      expect(container.read(practiceSubjectProvider), 'accountancy');
      expect(tester.widget<MmPressable>(find.descendant(of: find.byKey(const ValueKey('lh-subject-accountancy')), matching: find.byType(MmPressable))).selected, isTrue);

      await _tap(tester, find.byKey(const ValueKey('lh-subject-economics')));
      await settleHome(tester);
      expect(container.read(practiceSubjectProvider), 'economics');
      final economics = LearnFixtures.subject('subject_economics_pro');
      expect(find.text('Search ${economics.subject.cards} Key cards'), findsOneWidget);
      expect(tester.widget<MmPressable>(find.descendant(of: find.byKey(const ValueKey('lh-subject-economics')), matching: find.byType(MmPressable))).selected, isTrue);
      expect(tester.widget<MmPressable>(find.descendant(of: find.byKey(const ValueKey('lh-subject-accountancy')), matching: find.byType(MmPressable))).selected, isFalse);
      expect(find.text('Pick up Admission of a Partner'), findsNothing, reason: 'the old subject\'s suggestions are never drawn under the new name');
    });

    testWidgets('a link\'s own subject wins', (tester) async {
      final api = HomeLearnApi();
      await pumpHome(tester, overrides: homeOverrides(api), subject: 'economics');
      await settleHome(tester);
      final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
      expect(container.read(practiceSubjectProvider), 'economics');
    });

    test('the chosen subject is brought to the middle of the row, inside it', () {
      // Four items of 96 with 5 between and 16 on each side: 431 wide, in a 360 dp window (71 dp to scroll).
      double at(int i) => LearnSubjectRow.centerOffset(index: i, itemWidth: 96, viewport: 360, content: 431);
      expect(at(0), 0, reason: 'the first is already left of the middle');
      expect(at(1), 0, reason: 'the second is near the middle already');
      expect(at(2), 71, reason: 'the third wants more than the row has: it stops at the end');
      expect(at(3), 71);
      // Six items scroll further: the middle of the fourth.
      expect(LearnSubjectRow.centerOffset(index: 3, itemWidth: 96, viewport: 360, content: 633), closeTo(16 + 3 * 101 + 48 - 180, 0.01));
    });

    test('a long name gives way to its first part', () {
      expect(LearnSubjectRow.shortName('Economics / Business Economics'), 'Economics');
      expect(LearnSubjectRow.shortName('Business Studies'), 'Business Studies');
      expect(LearnSubjectRow.shortName('Retirement/Death'), 'Retirement and Death');
    });
  });

  group('Find opens in place and Cancel brings the book back', () {
    testWidgets('focusing opens Find under the field with a Cancel key; typing hands it the words; Cancel clears and returns', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.byType(FindPanel), findsNothing);
      expect(find.text('Cancel'), findsNothing);
      expect(find.text('Book order'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('lh-search')));
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Book order'), findsNothing, reason: 'Find takes the place of the suggestions and the chapters');
      expect(find.byKey(const ValueKey('lh-shelf-due')), findsOneWidget, reason: 'the tiles stay, so a search can jump to a set');
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, '');
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).subject, 'accountancy');

      await tester.enterText(find.byKey(const ValueKey('lh-search')), 'goodwill');
      await settleHome(tester);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');

      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      expect(find.byType(FindPanel), findsNothing);
      expect(find.text('Cancel'), findsNothing);
      expect(find.text('Book order'), findsOneWidget);
      expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).controller!.text, '');
      expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).focusNode!.hasFocus, isFalse);
    });

    testWidgets('the Clear key empties the words and keeps Find open', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await tester.enterText(find.byKey(const ValueKey('lh-search')), 'goodwill');
      await settleHome(tester);
      final clear = find.byWidgetPredicate((w) => w is MmPressable && w.semanticsLabel == 'Clear the search');
      expect(clear, findsOneWidget);
      await tester.tap(clear);
      await settleHome(tester);
      expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).controller!.text, '');
      expect(find.byType(FindPanel), findsOneWidget);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, '');
    });

    testWidgets('the find and query arguments open it that way', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), find: true);
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).focusNode!.hasFocus, isTrue);
    });

    testWidgets('a query opens the results of that search', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), query: 'goodwill');
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');
      expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).controller!.text, 'goodwill');
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('a new link to the same page replaces what is open: its words, then none', (tester) async {
      final query = ValueNotifier<String?>(null);
      addTearDown(query.dispose);
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: homeOverrides(HomeLearnApi()),
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            home: ValueListenableBuilder<String?>(valueListenable: query, builder: (context, q, _) => HomePage(query: q)),
          ),
        ),
      );
      await settleHome(tester);
      expect(find.byType(FindPanel), findsNothing);
      query.value = 'goodwill';
      await settleHome(tester);
      expect(tester.takeException(), isNull);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');
      expect(tester.widget<TextField>(find.byKey(const ValueKey('lh-search'))).controller!.text, 'goodwill');
      query.value = 'a different search';
      await settleHome(tester);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'a different search');
      query.value = null;
      await settleHome(tester);
      expect(find.byType(FindPanel), findsNothing);
      expect(find.text('Book order'), findsOneWidget);
    });

    testWidgets('the page\'s scroll before the field docked comes back on Cancel', (tester) async {
      final controller = ScrollController();
      addTearDown(controller.dispose);
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), controller: controller, bottom: 900);
      await settleHome(tester);
      controller.jumpTo(60);
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('lh-search')));
      await settleHome(tester);
      expect(controller.offset, greaterThan(60), reason: 'the field docks near the top, so the keyboard does not cover what follows');
      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      expect(controller.offset, closeTo(60, 1));
    });
  });

  group('the shelf tiles open a set in place', () {
    testWidgets('due today: the head, the chips, one volt key that plays exactly its cards, the chapters that hold them', (tester) async {
      final api = HomeLearnApi();
      final router = await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);

      await _tap(tester, find.byKey(const ValueKey('lh-shelf-due')));
      await settleHome(tester);
      expect(find.text('Due today'), findsOneWidget);
      expect(find.text('9 cards in 3 chapters, about 2 min'), findsOneWidget);
      for (final chip in ['Due today 9', 'Missed lately 6', 'In Revise 26', 'Must-know 229']) {
        expect(find.text(chip), findsOneWidget, reason: chip);
      }
      // The lead suggestion is hidden while a set is open; the set's key is the page's one volt key.
      expect(find.byKey(const ValueKey('lh-suggestion-0')), findsNothing);
      expect(_volt(), findsOneWidget);
      expect(_key('Revise these 9'), findsOneWidget);
      expect(find.byKey(ValueKey('lh-set-row-$_pf')), findsOneWidget);
      expect(find.byKey(ValueKey('lh-set-row-$_pl')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-row-accountancy.accounting-ratios')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-row-accountancy.goodwill-valuation')), findsNothing, reason: 'a chapter with none of its cards in the set is not listed');
      expect(find.text('Cancel'), findsOneWidget);

      final (path, q) = await _go(tester, _key('Revise these 9'), router);
      expect(path, '/learn/session');
      expect(q['kind'], 'cards');
      expect(q['chapter'], _pf);
      expect(q['cards']!.split(',').length, 9);
      router.pop();
      await settleHome(tester);

      // Back to the chapters; the tile lets go.
      await _tap(tester, find.byKey(const ValueKey('lh-set-back')));
      await settleHome(tester);
      expect(find.byKey(const ValueKey('lh-suggestion-0')), findsOneWidget);
      expect(find.text('Book order'), findsOneWidget);
    });

    testWidgets('the open set\'s tile is pressed; tapping it again closes the set; Cancel does too', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-shelf-missed')));
      await settleHome(tester);
      expect(tester.widget<MmPressable>(find.descendant(of: find.byKey(const ValueKey('lh-shelf-missed')), matching: find.byType(MmPressable))).selected, isTrue);
      expect(find.text('Missed lately'), findsOneWidget);
      await _tap(tester, find.byKey(const ValueKey('lh-shelf-missed')));
      await settleHome(tester);
      expect(find.byKey(const ValueKey('lh-suggestion-0')), findsOneWidget);

      await _tap(tester, find.byKey(const ValueKey('lh-shelf-revise')));
      await settleHome(tester);
      expect(find.text('In Revise'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      expect(find.byKey(const ValueKey('lh-suggestion-0')), findsOneWidget);
      expect(find.text('Cancel'), findsNothing);
    });

    testWidgets('typing replaces an open set with Find, and the chips switch the set', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-shelf-due')));
      await settleHome(tester);
      await _tap(tester, find.text('In Revise 26'));
      await settleHome(tester);
      expect(find.text('In Revise'), findsOneWidget);
      await tester.enterText(find.byKey(const ValueKey('lh-search')), 'goodwill');
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-chips')), findsNothing);
    });

    testWidgets('a set that failed to load says so and tries again', (tester) async {
      final api = HomeLearnApi(failOn: {'subjectCards': FixtureLearnApi.offlineError});
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-shelf-due')));
      await settleHome(tester);
      expect(find.text('The cards did not load'), findsOneWidget);
      expect(find.text('Check your connection and try again.'), findsOneWidget);
      api.failOn.clear();
      await _tap(tester, _key('Try again'));
      await settleHome(tester);
      expect(find.text('9 cards in 3 chapters, about 2 min'), findsOneWidget);
    });

    testWidgets('a new student has nothing in the tiles: one line says it', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)));
      await settleHome(tester);
      expect(find.text('Nothing in Revise yet. Cards you study land here.'), findsOneWidget);
      expect(find.byType(HomeShelfKeys), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-shelf-due')), findsNothing);
      expect(find.text('due today'), findsNothing);
    });
  });

  group('the chapter map', () {
    testWidgets('the sort menu: Book order, Due first, Needs work first; rows keep their keys and take the new order', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      final parts = LearnFixtures.subject('subject_accountancy_pro').parts;
      double top(String key) => tester.getTopLeft(_row(key)).dy;
      List<String> order(List<String> keys) => [...keys]..sort((a, b) => top(a).compareTo(top(b)));

      final book = [for (final f in HomeModel.flatRows(parts)) f.row.key];
      expect(order(book), book, reason: 'book order down the page');

      await _tap(tester, find.byKey(const ValueKey('lh-sort')));
      await settleHome(tester);
      expect(find.byKey(const ValueKey('lh-sort-book')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort-due')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort-needs')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort-marks')), findsNothing, reason: 'no chapter carries a figure');
      await tester.tap(find.byKey(const ValueKey('lh-sort-due')));
      await settleHome(tester);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Due first'), findsOneWidget);
      final due = [for (final f in HomeModel.sortRows(parts, 'due')) f.row.key];
      for (final k in book) {
        expect(_row(k), findsOneWidget, reason: 'every row is keyed by its chapter: $k');
      }
      expect(order(book), due, reason: 'due first');
      // A sorted list draws every reference, and no unit or part headings.
      expect(find.text('Part 1, Partnership Accounts'), findsNothing);

      await _tap(tester, find.byKey(const ValueKey('lh-sort')));
      await settleHome(tester);
      await tester.tap(find.byKey(const ValueKey('lh-sort-needs')));
      await settleHome(tester);
      await tester.pump(const Duration(seconds: 1));
      expect(order(book), [for (final f in HomeModel.sortRows(parts, 'needs')) f.row.key], reason: 'needs work first');

      await _tap(tester, find.byKey(const ValueKey('lh-sort')));
      await settleHome(tester);
      await tester.tap(find.byKey(const ValueKey('lh-sort-book')));
      await settleHome(tester);
      await tester.pump(const Duration(seconds: 1));
      expect(order(book), book);
      expect(find.text('Part 1, Partnership Accounts'), findsOneWidget);
    });

    testWidgets('a new student: one line says every chapter is new, and the rows draw no state', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)));
      await settleHome(tester);
      expect(find.text('All 15 chapters are new to you.'), findsOneWidget);
      expect(find.text('Not started'), findsNothing);
      expect(find.text('Getting there'), findsNothing);
      expect(find.text('Needs work'), findsNothing);
    });

    testWidgets('a subject with no Key cards: the field says what it can find, no tiles, rows with their own truth', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(thin: true)));
      await settleHome(tester);
      expect(find.text('Search chapters and lessons'), findsOneWidget);
      expect(find.byType(HomeShelfKeys), findsNothing);
      expect(find.byType(HomeShelfKeysSkeleton), findsNothing);
      expect(find.text('Nothing in Revise yet. Cards you study land here.'), findsNothing);
      // Chapters with questions only say so; a chapter with nothing at all says that.
      expect(find.text('No Key cards yet. Questions ready.'), findsWidgets);
      expect(find.text('Nothing to practise here yet.'), findsWidgets);
      expect([for (final w in tester.widgetList<Text>(find.byType(Text))) if (RegExp(r'^\d+ cards?$').hasMatch(w.data ?? '')) w.data], isEmpty, reason: 'no card counts where there are no cards');
    });

    testWidgets('English: the one part with its own note', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(), subject: 'english'));
      await settleHome(tester);
      expect(find.text('English cards are written for MockMob, not taken from an NCERT book.'), findsOneWidget);
      expect(find.text('CUET English'), findsOneWidget);
    });
  });

  group('the part switch (LK2)', () {
    Finder switchFinder() => find.byKey(const ValueKey('lh-switch-p2'));
    Finder indicator() => find.descendant(of: switchFinder(), matching: find.byType(MmSlidingIndicator));
    Finder hint() => find.byKey(const ValueKey('lh-part-hint'));
    String hintText(WidgetTester tester) => tester.widget<Text>(hint()).data!;
    double top(WidgetTester tester, String key) => tester.getTopLeft(_row(key)).dy;

    testWidgets('both sides show until the student chooses, each saying how many chapters it holds', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.text('Your part'), findsOneWidget);
      expect(find.text('Analysis of Financial Statements'), findsWidgets);
      expect(find.text('Computerised Accounting'), findsOneWidget);
      expect(find.text('5 chapters'), findsOneWidget);
      expect(find.text('1 chapter'), findsOneWidget);
      expect(hintText(tester), 'Both parts show until you choose.');
      expect(_row('accountancy.accounting-ratios'), findsOneWidget);
      expect(_row('accountancy.computerized-accounting-system'), findsOneWidget);
    });

    testWidgets('the tapped side stays chosen through a slow save; only the option unit below changes; nothing above moves', (tester) async {
      final api = HomeLearnApi();
      final gate = Completer<void>();
      final keyCards = HomeKeyCards(api, gate: gate);
      await pumpHome(tester, overrides: homeOverrides(api, keyCards: keyCards), disableAnimations: false);
      await settleHome(tester);
      await tester.ensureVisible(switchFinder());
      await tester.pump(const Duration(milliseconds: 400));

      final above = [for (final k in ['accountancy.share-capital', 'accountancy.debentures']) top(tester, k)];
      final switchTop = tester.getTopLeft(switchFinder()).dy;
      expect(tester.widget<AnimatedOpacity>(find.descendant(of: switchFinder(), matching: find.byType(AnimatedOpacity))).opacity, 0, reason: 'nothing is chosen: no thumb');

      await tester.tap(find.byKey(const ValueKey('lh-choice-CAS')));
      await tester.pump();
      // At once: the tapped side holds the thumb; the hint says it is saving; nothing above moved.
      expect(tester.widget<MmSlidingIndicator>(indicator()).index, 1);
      expect(tester.widget<AnimatedOpacity>(find.descendant(of: switchFinder(), matching: find.byType(AnimatedOpacity))).opacity, 1);
      expect(hintText(tester), 'Saving your choice');
      expect(keyCards.saved, ['CAS']);
      // The old unit fades while the save is still out; then only the chosen side's unit stands.
      await tester.pump(const Duration(milliseconds: 600));
      expect(_row('accountancy.computerized-accounting-system'), findsOneWidget);
      expect(_row('accountancy.accounting-ratios'), findsNothing, reason: 'the other side\'s unit is gone once the cross-fade has run');
      expect(tester.widget<MmSlidingIndicator>(indicator()).index, 1, reason: 'still chosen while the server has not answered');
      expect(hintText(tester), 'Saving your choice');
      expect([for (final k in ['accountancy.share-capital', 'accountancy.debentures']) top(tester, k)], above, reason: 'nothing above the option unit moves or re-sorts');
      expect(tester.getTopLeft(switchFinder()).dy, switchTop);

      // The server agrees: the choice stays and the hint is the server's again.
      gate.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.widget<MmSlidingIndicator>(indicator()).index, 1);
      expect(hintText(tester), isNot('Saving your choice'));
      expect(hintText(tester), isNot('Your choice was not saved. Try again.'));
      expect(_row('accountancy.computerized-accounting-system'), findsOneWidget);
      expect(_row('accountancy.accounting-ratios'), findsNothing);
      expect(api.subjectReads, greaterThanOrEqualTo(2), reason: 'the home was read again after the save');
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('a failed save slides the thumb back and says so; the other side shows again', (tester) async {
      final api = HomeLearnApi();
      final gate = Completer<void>();
      final keyCards = HomeKeyCards(api, fail: true, gate: gate);
      await pumpHome(tester, overrides: homeOverrides(api, keyCards: keyCards), disableAnimations: false);
      await settleHome(tester);
      await tester.ensureVisible(switchFinder());
      await tester.pump(const Duration(milliseconds: 400));

      await tester.tap(find.byKey(const ValueKey('lh-choice-CAS')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.widget<MmSlidingIndicator>(indicator()).index, 1);
      expect(_row('accountancy.accounting-ratios'), findsNothing);

      gate.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
      expect(hintText(tester), 'Your choice was not saved. Try again.');
      expect(tester.widget<AnimatedOpacity>(find.descendant(of: switchFinder(), matching: find.byType(AnimatedOpacity))).opacity, 0, reason: 'the choice is dropped: no thumb');
      expect(_row('accountancy.accounting-ratios'), findsOneWidget, reason: 'both sides show again');
      expect(_row('accountancy.computerized-accounting-system'), findsOneWidget);
      // Trying again is one tap.
      keyCards.fail = false;
      final retry = Completer<void>();
      keyCards.gate = retry;
      await tester.tap(find.byKey(const ValueKey('lh-choice-AFS')));
      await tester.pump();
      expect(hintText(tester), 'Saving your choice');
      expect(tester.widget<MmSlidingIndicator>(indicator()).index, 0);
      expect(tester.widget<AnimatedOpacity>(find.descendant(of: switchFinder(), matching: find.byType(AnimatedOpacity))).opacity, 1);
      retry.complete();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(hintText(tester), isNot('Saving your choice'));
      expect(hintText(tester), isNot('Your choice was not saved. Try again.'));
      expect(keyCards.saved, ['CAS', 'AFS']);
    });
  });

  group('the states', () {
    testWidgets('loading: the subjects and the field stay; the tiles and the blocks are skeletons at their final heights', (tester) async {
      final api = HomeLearnApi(slow: const Duration(seconds: 5));
      await pumpHome(tester, overrides: homeOverrides(api));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byKey(const ValueKey('lh-subject-accountancy')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-search')), findsOneWidget);
      expect(find.text('Search Key cards'), findsOneWidget, reason: 'the count is not known yet');
      expect(find.byType(HomeShelfKeysSkeleton), findsOneWidget);
      expect(find.byType(HomeSuggestionsSkeleton), findsOneWidget);
      expect(find.byType(ChapterMapSkeleton), findsOneWidget);
      expect(find.byType(HomeSuggestions), findsNothing);
      expect(find.text('Chapters'), findsNothing);
      expect(_volt(), findsNothing);
      expect(tester.getSize(find.byType(HomeShelfKeysSkeleton)).height, 56);
      // The skeletons give way to the page.
      await tester.pump(const Duration(seconds: 6));
      await settleHome(tester);
      expect(find.byType(HomeSuggestionsSkeleton), findsNothing);
      expect(find.text('Search 868 Key cards'), findsOneWidget);
    });

    testWidgets('failed: "Learn did not load", what is safe, and one Try again that reads it again', (tester) async {
      final api = HomeLearnApi(error: true);
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.text('Learn did not load'), findsOneWidget);
      expect(find.text('Check your connection and try again. Your cards and their schedule are safe.'), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-subject-economics')), findsOneWidget, reason: 'the subject row stays usable');
      expect(find.byKey(const ValueKey('lh-search')), findsOneWidget);
      expect(find.byType(HomeSuggestions), findsNothing);
      expect(_volt(), findsNothing);
      api.error = false;
      await _tap(tester, _key('Try again'));
      await settleHome(tester);
      expect(find.text('Learn did not load'), findsNothing);
      expect(find.text('Pick up Admission of a Partner'), findsOneWidget);
    });

    testWidgets('offline reads as failed, never as empty', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(offline: true)));
      await settleHome(tester);
      expect(find.text('Learn did not load'), findsOneWidget);
      expect(find.text('No chapters here yet.'), findsNothing);
    });

    testWidgets('shelves that fail while the home reads: one quiet line in the tiles\' place, and Try again', (tester) async {
      final api = HomeLearnApi(failOn: {'shelves': FixtureLearnApi.offlineError});
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.text('Your cards did not load.'), findsOneWidget);
      expect(find.text('Pick up Admission of a Partner'), findsOneWidget, reason: 'a failed shelves read does not hold the page');
      api.failOn.clear();
      await _tap(tester, find.widgetWithText(MmPressable, 'Try again'));
      await settleHome(tester);
      expect(find.text('Your cards did not load.'), findsNothing);
      expect(find.byKey(const ValueKey('lh-shelf-due')), findsOneWidget);
    });

    testWidgets('Free before its limit: no Free line anywhere', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(pro: false), nudges: true));
      await settleHome(tester);
      expect(find.textContaining('free Learn session', findRichText: true), findsNothing);
      expect(find.text('See Pro'), findsNothing);
      expect(_volt(), findsOneWidget);
    });

    testWidgets('Free with its day used: the server\'s line, See Pro where Pro nudges are on, and a dismiss until tomorrow', (tester) async {
      final api = HomeLearnApi(pro: false, freeUsed: true);
      await pumpHome(tester, overrides: homeOverrides(api, nudges: true));
      await settleHome(tester);
      const line = 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.';
      expect(find.text(line), findsOneWidget);
      expect(find.text('See Pro'), findsOneWidget);
      // Each suggestion carries what is true today.
      expect(find.text('Key cards only today.'), findsNWidgets(2));
      expect(_volt(), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('lh-free-dismiss')));
      await settleHome(tester);
      expect(find.text(line), findsNothing);
    });

    testWidgets('Free with Pro nudges off: the line without a key that sells', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(pro: false, freeUsed: true)));
      await settleHome(tester);
      expect(find.textContaining('free Learn session for today is done', findRichText: true), findsOneWidget);
      expect(find.text('See Pro'), findsNothing);
    });
  });

  group('the entrance plays once', () {
    test('the numbers of the page: 6 dp, 24 ms apart, the first 12, 524 ms in all', () {
      expect(HomeEntrance.rise, 6);
      expect(HomeEntrance.step, const Duration(milliseconds: 24));
      expect(HomeEntrance.cap, 12);
      expect(HomeEntrance.total, const Duration(milliseconds: 24 * 11 + 260));
    });

    testWidgets('on the first arrival the lead tile rises into its place and never falls', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), disableAnimations: false);
      await tester.pump();
      // Step in single frames until the lead exists, then watch it settle.
      double? first;
      for (var i = 0; i < 40 && first == null; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        final lead = find.byKey(const ValueKey('lh-suggestion-0'));
        if (lead.evaluate().isNotEmpty) first = tester.getTopLeft(lead).dy;
      }
      expect(first, isNotNull);
      await tester.pump(const Duration(milliseconds: 700));
      final settled = tester.getTopLeft(find.byKey(const ValueKey('lh-suggestion-0'))).dy;
      expect(first!, greaterThanOrEqualTo(settled), reason: 'it rises into place');
      expect(first - settled, lessThanOrEqualTo(6.01));
    });

    testWidgets('the body of another subject arrives where it stands: the entrance has played', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), disableAnimations: false);
      await settleHome(tester);
      await tester.pump(const Duration(seconds: 1));
      final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
      container.read(practiceSubjectProvider.notifier).select('economics');
      await tester.pump();
      double? first;
      for (var i = 0; i < 40 && first == null; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        final lead = find.byKey(const ValueKey('lh-suggestion-0'));
        // While the two bodies cross-fade, the incoming one is the later layer.
        if (lead.evaluate().isNotEmpty && find.text('Search ${LearnFixtures.subject('subject_economics_pro').subject.cards} Key cards').evaluate().isNotEmpty) first = tester.getTopLeft(lead.last).dy;
      }
      expect(first, isNotNull);
      await tester.pump(const Duration(milliseconds: 700));
      expect(tester.getTopLeft(find.byKey(const ValueKey('lh-suggestion-0'))).dy, closeTo(first!, 0.01), reason: 'no second rise');
    });
  });

  group('text at 1.3 on a 360 dp phone', () {
    for (final (name, api) in [
      ('returning Pro', () => HomeLearnApi()),
      ('new Free', () => HomeLearnApi(pro: false, newStudent: true)),
      ('Free with its day used', () => HomeLearnApi(pro: false, freeUsed: true)),
      ('thin subject', () => HomeLearnApi(thin: true)),
    ]) {
      testWidgets('$name draws without overflow, from the subjects to the last chapter', (tester) async {
        final server = api();
        await pumpHome(tester, overrides: homeOverrides(server, nudges: true), textScale: 1.3);
        await settleHome(tester);
        expect(tester.takeException(), isNull);
        final scroll = tester.state<ScrollableState>(find.byType(Scrollable).first);
        scroll.position.jumpTo(scroll.position.maxScrollExtent);
        await tester.pump();
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('Find open, a set open and the part switch at 1.3 hold too', (tester) async {
      final api = HomeLearnApi();
      await pumpHome(tester, overrides: homeOverrides(api), textScale: 1.3);
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-shelf-due')));
      await settleHome(tester);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      await tester.tap(find.byKey(const ValueKey('lh-search')));
      await settleHome(tester);
      await tester.enterText(find.byKey(const ValueKey('lh-search')), 'a long search with several words in it, past what fits');
      await settleHome(tester);
      expect(tester.takeException(), isNull);
    });
  });

  group('every key is at least 48 dp', () {
    for (final scale in [1.0, 1.3]) {
      testWidgets('returning Pro at text scale $scale', (tester) async {
        await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(), nudges: true), textScale: scale);
        await settleHome(tester);
        final tooSmall = <String>[];
        for (final e in find.byType(MmPressable).evaluate()) {
          // A chip is 40 dp to look at and 48 to touch (a hit slop around it).
          if (e.findAncestorWidgetOfExactType<MmChip>() != null) continue;
          final box = e.renderObject! as RenderBox;
          if (box.size.height < 47.99 || box.size.width < 47.99) tooSmall.add('${(e.widget as MmPressable).semanticsLabel}: ${box.size}');
        }
        for (final e in find.byType(KeyButton).evaluate()) {
          final box = e.renderObject! as RenderBox;
          if (box.size.height < 47.99) tooSmall.add('key ${(e.widget as KeyButton).label}: ${box.size}');
        }
        expect(tooSmall, isEmpty);
      });
    }

    testWidgets('the field, its Clear and Cancel keys, a set and the Free line', (tester) async {
      final api = HomeLearnApi(pro: false, freeUsed: true);
      await pumpHome(tester, overrides: homeOverrides(api, nudges: true));
      await settleHome(tester);
      expect(tester.getSize(find.byKey(const ValueKey('lh-search'))).height, greaterThanOrEqualTo(HomeSearchField.height - 0.01));
      await tester.enterText(find.byKey(const ValueKey('lh-search')), 'goodwill');
      await settleHome(tester);
      final small = <String>[];
      for (final e in find.byType(MmPressable).evaluate()) {
        final box = e.renderObject! as RenderBox;
        if (box.size.height < 47.99 || box.size.width < 47.99) small.add('${(e.widget as MmPressable).semanticsLabel}: ${box.size}');
      }
      expect(small, isEmpty);
    });
  });

  group('the page speaks plainly to a screen reader', () {
    testWidgets('rows, tiles and subjects carry their words; the one header is the subject', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.bySemanticsLabel('Accountancy, 9 due'), findsOneWidget);
      expect(find.bySemanticsLabel('Due today: 9 Accountancy cards. Show them'), findsOneWidget);
      expect(find.bySemanticsLabel('Missed lately: 6 cards in the last 7 days. Show them'), findsOneWidget);
      expect(find.bySemanticsLabel('In Revise: 26 cards in 3 chapters. Show them'), findsOneWidget);
      expect(find.bySemanticsLabel('Search 868 Key cards'), findsWidgets);
      final row = LearnFixtures.subject('subject_accountancy_pro').chapter(_aop)!;
      expect(find.bySemanticsLabel(HomeModel.rowSpoken(row)), findsOneWidget);
      expect(find.bySemanticsLabel('Sort chapters, now Book order'), findsOneWidget);
      handle.dispose();
    });
  });

  test('the providers it reads are the shared ones', () {
    // One subject between Learn and Practice: the Learn id is Practice's, as the public id the Learn routes take.
    final c = ProviderContainer(overrides: [practiceSubjectProvider.overrideWithBuild((ref, n) => 'business')]);
    addTearDown(c.dispose);
    expect(c.read(learnSubjectIdProvider), 'business_studies');
  });
}
