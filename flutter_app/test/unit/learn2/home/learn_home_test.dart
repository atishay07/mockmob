// Learn home, as a student meets it (APP-1102-A section 3; the web's rounds 2 to 4, LK24 and LK27): one subject picker, ONE start offer
// from the server's roadmap (never a line of zeros) with at most two quiet Or rows, the search field with Find in place (the student's
// sets as rows, or a word to try), the sets that open in place, and "Your roadmap" with its real chapter sizes, coverage lines, the one
// verdict word, the volt "Start here", the part pills and the sort menu. Every state, the entrance, text at 1.3 and the 48 dp targets.
// The server is the fixture server (recordings of the web preview's real engine, test/fixtures/learn2/).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn2/cards/find_view.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';
import 'package:mockmob/features/learn2/home/chapter_map.dart';
import 'package:mockmob/features/learn2/home/find_home.dart';
import 'package:mockmob/features/learn2/home/home_entrance.dart';
import 'package:mockmob/features/learn2/home/home_model.dart';
import 'package:mockmob/features/learn2/home/learn_home.dart';
import 'package:mockmob/features/learn2/home/roadmap_offer.dart';
import 'package:mockmob/features/learn2/home/search_field.dart';
import 'package:mockmob/features/learn2/home/shelf_set.dart';
import 'package:mockmob/features/learn2/home/subject_row.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';

import '../support/fixture_learn_api.dart';
import 'home_support.dart';

const String _aop = 'accountancy.admission-of-partner';
const String _pf = 'accountancy.partnership-fundamentals';
const String _pl = 'accountancy.profit-and-loss-appropriation-account';
const String _cpsr = 'accountancy.change-in-profit-sharing-ratio';

Finder _row(String key) => find.byKey(ValueKey('lh-row-$key'));
Finder _volt() => find.byWidgetPredicate((w) => w is KeyButton && w.variant == KeyVariant.primary);
Finder _key(String label) => find.widgetWithText(KeyButton, label);
Finder _search() => find.byKey(const ValueKey('lh-search'));
Finder _picker() => find.byKey(const ValueKey('lh-picker'));

TextField _field(WidgetTester tester) => tester.widget<TextField>(_search());

/// Every word on screen, one per Text.
List<String> _texts(WidgetTester tester) => [for (final w in tester.widgetList<Text>(find.byType(Text))) w.data ?? w.textSpan?.toPlainText() ?? ''];

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

/// A count that is 0 is never said ("0 due", "0 of 12 cards"): the lead of a line is never a zero followed by what it counts.
final RegExp _zeroLead = RegExp(r'(^|[^\d.,:])0\s+(of|due|kept|cards?|questions?|mistakes?|in|new|left|seen|missed)\b', caseSensitive: false);

/// The page's words keep the owner's rules: no zero lead, no "mastered", no exclamation mark, no percentage, no arrow on a key.
void _plainWords(WidgetTester tester) {
  final arrow = RegExp('[←-⇿➜➔]');
  for (final s in _texts(tester)) {
    final lower = s.toLowerCase();
    expect(lower.contains('mastered') || lower.contains('mastery'), isFalse, reason: s);
    expect(s.contains('!') || s.contains('%') || arrow.hasMatch(s), isFalse, reason: s);
    expect(_zeroLead.hasMatch(s), isFalse, reason: '"$s" leads with a zero');
  }
}

bool _chosen(WidgetTester tester, String optionId) =>
    tester.widget<MmPressable>(find.descendant(of: find.byKey(ValueKey('lh-choice-$optionId')), matching: find.byType(MmPressable))).selected == true;

void main() {
  group('the offer leads (LK27)', () {
    testWidgets('a new student: Start learning Accountancy, one volt key, the two Or rows and no zero anywhere', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)));
      await settleHome(tester);
      expect(find.text('Start learning Accountancy'), findsOneWidget);
      expect(find.text('Chapter 1 of 14 · Accounting for Partnership: Basic Concepts'), findsOneWidget);
      expect(_key('Start chapter 1 · 10 min'), findsOneWidget);
      expect(_volt(), findsOneWidget, reason: 'the page has one volt key');
      expect(find.text('Skip what you already know'), findsOneWidget);
      expect(find.text('6 questions · about 6 min'), findsOneWidget);
      expect(find.text('Play this chapter as a feed'), findsOneWidget);
      expect(find.text('Scroll through the chapter, stop any time'), findsOneWidget);
      // The old status line, the shelf tiles and the suggestions are gone.
      expect(find.textContaining('due today'), findsNothing);
      expect(find.text('Where to start'), findsNothing);
      expect(find.byKey(const ValueKey('lh-offer-sub')), findsNothing, reason: 'a new student has no sub line');
      _plainWords(tester);
    });

    testWidgets('an unfinished run: Pick up, the real 6 of 16, Continue · 5 min, and the Or rows say the due cards and the open mistakes', (tester) async {
      final api = HomeLearnApi();
      final router = await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.text('Pick up Admission of a Partner'), findsOneWidget);
      expect(find.text('6 of 16 done'), findsOneWidget);
      expect(_key('Continue · 5 min'), findsOneWidget);
      expect(find.text('Revise 9 due cards · 2 min'), findsOneWidget);
      expect(find.text('Fix 3 open mistakes · 3 min'), findsOneWidget);
      expect(find.text('Accounting for Partnership: Basic Concepts'), findsWidgets, reason: 'the fix row names its chapter');
      expect(api.subjectReads, 1, reason: 'one read, the subject body and the shelves together');
      // The key picks the run up by its id.
      final (path, query) = await _go(tester, _key('Continue · 5 min'), router);
      expect(path, '/learn/session');
      expect(query['chapter'], _aop);
      expect(query['min'], '5');
      expect(query['run'], startsWith('lr_'), reason: 'the unfinished run is picked up where it stopped');
      expect(query.containsKey('kind'), isFalse, reason: 'a mix is the default kind');
    });

    testWidgets('the fix row starts a NEW mistakes-only run, never a resume', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      final (path, query) = await _go(tester, find.text('Fix 3 open mistakes · 3 min'), router);
      expect(path, '/learn/session');
      expect(query['chapter'], _pf);
      expect(query['min'], '3');
      expect(query['fresh'], '1');
      expect(query['out'], 'questions,cards,lesson');
      expect(query.containsKey('run'), isFalse);
      expect(query.containsKey('kind'), isFalse);
    });

    testWidgets('the Revise row plays exactly the due cards the server named, as a cards run', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      final (path, query) = await _go(tester, find.text('Revise 9 due cards · 2 min'), router);
      expect(path, '/learn/session');
      expect(query['kind'], 'cards');
      expect(query['chapter'], _pf);
      expect(query['min'], '2');
      expect(query['cards']!.split(',').length, 9);
      expect(query['cards'], startsWith('kc.accountancy.'));
    });

    testWidgets('a new student: the key, Skip what you already know, and the feed through the server\'s href', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)));
      await settleHome(tester);
      var (path, q) = await _go(tester, _key('Start chapter 1 · 10 min'), router);
      expect((path, q['chapter'], q['min']), ('/learn/session', _pf, '10'));
      router.pop();
      await settleHome(tester);

      (path, q) = await _go(tester, find.text('Skip what you already know'), router);
      expect((path, q['kind'], q['min'], q['chapter']), ('/learn/session', 'level', '6', _pf));
      router.pop();
      await settleHome(tester);

      (path, q) = await _go(tester, find.text('Play this chapter as a feed'), router);
      expect((path, q['chapter'], q['min']), ('/explore/feed', _pf, '10'));
    });

    testWidgets('returning, nothing unfinished: Today\'s 10 minutes, the due cards first, Start · 10 min, and only the feed row', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(), subject: 'economics'));
      await settleHome(tester);
      expect(find.text("Today's 10 minutes in Economics"), findsOneWidget);
      expect(find.text('Chapter 1 of 17 · Introduction, Theory of Consumer Behaviour'), findsOneWidget);
      expect(find.text('6 due cards first, then new ones here'), findsOneWidget);
      expect(_key('Start · 10 min'), findsOneWidget);
      expect(find.text('Play this chapter as a feed'), findsOneWidget);
      expect(find.textContaining('Revise '), findsNothing, reason: 'the Start key already plays the due cards: one of the two, never both');
      final (path, query) = await _go(tester, _key('Start · 10 min'), router);
      expect(path, '/learn/session');
      expect(query['min'], '10');
      expect(query['chapter'], startsWith('economics.'));
    });

    testWidgets('Free after the day\'s session: the web\'s one block, See Pro, and the Or rows that still work', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(pro: false, freeUsed: true), nudges: true));
      await settleHome(tester);
      expect(find.text("That was today's free session."), findsOneWidget);
      expect(find.text('Questions come back tomorrow. Your Key cards stay open.'), findsOneWidget);
      expect(_key('See Pro'), findsOneWidget);
      expect(_volt(), findsOneWidget);
      expect(find.text('Continue · 8 min'), findsOneWidget);
      expect(find.text('Revise 8 due cards · 2 min'), findsOneWidget);
      expect(find.textContaining('tomorrow'), findsOneWidget, reason: 'one line says it, nowhere else');
      expect(find.textContaining('Free Learn'), findsNothing);
      _plainWords(tester);
      // The unfinished feed is picked up by its id, as a feed.
      final (path, q) = await _go(tester, find.text('Continue · 8 min'), router);
      expect(path, '/explore/feed');
      expect(q['chapter'], _aop);
      expect(q['min'], '8');
      expect(q['run'], startsWith('lr_'));
    });

    testWidgets('Free with Pro nudges off: the block without a key that sells', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(pro: false, freeUsed: true), nudges: false));
      await settleHome(tester);
      expect(find.text("That was today's free session."), findsOneWidget);
      expect(_key('See Pro'), findsNothing);
      expect(_volt(), findsNothing);
      expect(find.text('Continue · 8 min'), findsOneWidget);
    });

    testWidgets('an Or row that goes to Explore opens Explore on the subject', (tester) async {
      final api = HomeLearnApi(
        pro: false,
        freeUsed: true,
        edit: (j) => (j['roadmap'] as Map<String, dynamic>)['or'] = [
          {'kind': 'singles', 'label': 'Answer single questions', 'href': '/explore', 'go': 'explore'},
        ],
      );
      final router = await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      final (path, q) = await _go(tester, find.text('Answer single questions'), router);
      expect(path, '/explore');
      expect(q['subject'], 'accountancy');
    });

    testWidgets('never more than two Or rows', (tester) async {
      final api = HomeLearnApi(
        edit: (j) => (j['roadmap'] as Map<String, dynamic>)['or'] = [
          {
            'kind': 'revise',
            'label': 'Revise 9 due cards · 2 min',
            'run': {
              'chapterKey': _pf,
              'minutes': 2,
              'kind': 'cards',
              'cardIds': ['kc.a'],
              'leaveOut': <String>[],
            },
          },
          {
            'kind': 'fix',
            'label': 'Fix 3 open mistakes · 3 min',
            'run': {'chapterKey': _pf, 'minutes': 3, 'kind': 'mix', 'leaveOut': <String>[], 'fresh': true},
          },
          {'kind': 'singles', 'label': 'Answer single questions', 'href': '/explore', 'go': 'explore'},
        ],
      );
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.byKey(const ValueKey('lh-or-revise')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-or-fix')), findsOneWidget);
      expect(find.text('Answer single questions'), findsNothing, reason: 'two rows at most');
    });

    testWidgets('a row with nowhere to go is not drawn', (tester) async {
      final api = HomeLearnApi(
        edit: (j) => (j['roadmap'] as Map<String, dynamic>)['or'] = [
          {'kind': 'ghost', 'label': 'A row with nowhere to go'},
          {'kind': 'singles', 'label': 'Answer single questions', 'href': '/explore', 'go': 'explore'},
        ],
      );
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.text('A row with nowhere to go'), findsNothing);
      expect(find.text('Answer single questions'), findsOneWidget);
    });

    for (final (name, api, subject) in <(String, HomeLearnApi Function(), String)>[
      ('a returning Pro student', () => HomeLearnApi(), 'accountancy'),
      ('a new Pro student', () => HomeLearnApi(newStudent: true), 'accountancy'),
      ('a returning Free student', () => HomeLearnApi(pro: false), 'accountancy'),
      ('Free after the day', () => HomeLearnApi(pro: false, freeUsed: true), 'accountancy'),
      ('Economics', () => HomeLearnApi(), 'economics'),
      ('Business Studies', () => HomeLearnApi(), 'business_studies'),
      ('English', () => HomeLearnApi(), 'english'),
    ]) {
      testWidgets('plain words, no zero and no mastery for $name', (tester) async {
        await pumpHome(tester, overrides: homeOverrides(api(), subject: subject, nudges: true));
        await settleHome(tester);
        expect(find.byKey(const ValueKey('lh-offer-title')), findsOneWidget);
        _plainWords(tester);
      });
    }
  });

  group('the subject picker (ruling R1)', () {
    testWidgets('one row with the subject\'s name on one line; it opens "Choose a subject" and choosing writes the shared subject', (tester) async {
      final api = HomeLearnApi();
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(_picker(), findsOneWidget);
      expect(find.descendant(of: _picker(), matching: find.text('Accountancy')), findsOneWidget);
      expect(tester.getSize(_picker()).height, greaterThanOrEqualTo(56));
      final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
      expect(container.read(practiceSubjectProvider), 'accountancy');

      await _tap(tester, _picker());
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Choose a subject'), findsOneWidget);
      for (final name in ['Accountancy', 'Economics', 'Business Studies', 'English']) {
        expect(find.descendant(of: find.byType(MmSheetScaffold), matching: find.text(name)), findsOneWidget, reason: name);
      }
      await tester.tap(find.byKey(const ValueKey('lh-picker-economics')));
      await tester.pump(const Duration(milliseconds: 600));
      await settleHome(tester);
      expect(find.text('Choose a subject'), findsNothing);
      expect(container.read(practiceSubjectProvider), 'economics');
      expect(find.descendant(of: _picker(), matching: find.text('Economics')), findsOneWidget);
      expect(find.text("Today's 10 minutes in Economics"), findsOneWidget);
      expect(find.text('Pick up Admission of a Partner'), findsNothing, reason: 'the old subject\'s offer is never drawn under the new name');
      expect(api.calls, contains('home economics'));
    });

    testWidgets('a link\'s own subject wins', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), subject: 'economics');
      await settleHome(tester);
      final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
      expect(container.read(practiceSubjectProvider), 'economics');
      expect(find.text("Today's 10 minutes in Economics"), findsOneWidget);
    });

    testWidgets('a name never breaks inside a word: one line at 384 dp and at text 1.3', (tester) async {
      await pumpHome(
        tester,
        overrides: homeOverrides(HomeLearnApi(), subject: 'business_studies', subjects: const ['accountancy', 'business_studies']),
        size: const Size(384, 800),
        textScale: 1.3,
      );
      await settleHome(tester);
      expect(tester.takeException(), isNull);
      final name = tester.widget<Text>(find.descendant(of: _picker(), matching: find.text('Business Studies')));
      expect(name.maxLines, 1);
      expect(name.softWrap, isFalse);
      expect(name.overflow, TextOverflow.ellipsis);
      // The name fits on one line here: it is as high as one line of text, not two.
      expect(tester.getSize(find.descendant(of: _picker(), matching: find.text('Business Studies'))).height, lessThan(40));
    });

    test('a long name gives way to its first part, a slash between two words is "and"', () {
      expect(LearnSubjectPicker.shortName('Economics / Business Economics'), 'Economics');
      expect(LearnSubjectPicker.shortName('Business Studies'), 'Business Studies');
      expect(LearnSubjectPicker.shortName('Retirement/Death'), 'Retirement and Death');
    });

    testWidgets('one subject: a plain row, not a key', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(subjectsOnly: const ['accountancy']), subjects: const ['accountancy']));
      await settleHome(tester);
      expect(_picker(), findsOneWidget);
      expect(find.descendant(of: _picker(), matching: find.text('Accountancy')), findsOneWidget);
      await tester.tap(_picker());
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Choose a subject'), findsNothing, reason: 'nothing to choose between');
    });
  });

  group('Find in place', () {
    testWidgets('the field reads "Find a topic, like goodwill"; focusing it opens Find: the student\'s sets as rows, and the offer steps aside', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.text('Find a topic, like goodwill'), findsOneWidget);
      expect(find.byType(FindHome), findsNothing);
      expect(find.text('Cancel'), findsNothing);
      expect(tester.getSize(_search()).height, greaterThanOrEqualTo(HomeSearchField.height - 0.01));

      await tester.tap(_search());
      await settleHome(tester);
      expect(find.byType(FindHome), findsOneWidget);
      expect(find.byType(RoadmapOffer), findsNothing, reason: 'the field leads while Find is open');
      expect(_picker(), findsNothing);
      expect(find.text('Your roadmap'), findsNothing);
      expect(find.text('Your cards'), findsOneWidget);
      expect(find.text('Due today'), findsOneWidget);
      expect(find.text('9 cards · about 2 min'), findsOneWidget);
      expect(find.text('Missed lately'), findsOneWidget);
      expect(find.text('In Revise'), findsOneWidget);
      expect(find.text('Must-know lines'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.byType(FindPanel), findsNothing, reason: 'no words typed: no results');
      _plainWords(tester);
    });

    testWidgets('typing hands Find the words; Cancel clears and returns the offer and the roadmap', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      await tester.enterText(_search(), 'goodwill');
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).subject, 'accountancy');
      expect(find.byType(FindHome), findsNothing);

      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      expect(find.byType(FindPanel), findsNothing);
      expect(find.text('Cancel'), findsNothing);
      expect(find.byType(RoadmapOffer), findsOneWidget);
      expect(find.text('Your roadmap'), findsOneWidget);
      expect(_field(tester).controller!.text, '');
      expect(_field(tester).focusNode!.hasFocus, isFalse);
    });

    testWidgets('a new student has nothing in the sets: a line and four words from the book; a word searches it', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)), find: true);
      await settleHome(tester);
      expect(find.byType(FindHome), findsOneWidget);
      expect(find.text('Search any word from the book, like “goodwill”.'), findsOneWidget);
      expect(find.text('Try a word'), findsNothing, reason: 'the group\'s name is for a screen reader');
      for (final w in ['goodwill', 'sacrificing ratio', 'revaluation', 'debentures']) {
        expect(find.byKey(ValueKey('lh-chip-$w')), findsOneWidget, reason: w);
      }
      // The words are as wide as they are and flow from the left in a row, never one bar across the width to a line.
      final goodwill = tester.getRect(find.byKey(const ValueKey('lh-chip-goodwill')));
      final ratio = tester.getRect(find.byKey(const ValueKey('lh-chip-sacrificing ratio')));
      expect(goodwill.left, MmSpace.gutter);
      expect(goodwill.width, lessThan(200));
      expect(ratio.left, MmSpace.gutter, reason: 'a word that does not fit beside the first starts the next row at the left');
      expect(ratio.width, lessThan(330), reason: 'its own words and their padding');
      expect(find.text('Due today'), findsNothing, reason: 'a set with no cards is not a row');
      expect(find.text('Missed lately'), findsNothing);
      expect(find.text('In Revise'), findsNothing);
      expect(find.text('Must-know lines'), findsOneWidget);
      _plainWords(tester);

      await _tap(tester, find.byKey(const ValueKey('lh-chip-goodwill')));
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(_field(tester).controller!.text, 'goodwill');
    });

    testWidgets('the Clear key empties the words and keeps Find open', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await tester.enterText(_search(), 'goodwill');
      await settleHome(tester);
      final clear = find.byWidgetPredicate((w) => w is MmPressable && w.semanticsLabel == 'Clear the search');
      expect(clear, findsOneWidget);
      await tester.tap(clear);
      await settleHome(tester);
      expect(_field(tester).controller!.text, '');
      expect(find.byType(FindPanel), findsNothing);
      expect(find.byType(FindHome), findsOneWidget);
    });

    testWidgets('the find and query arguments open it that way', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), find: true);
      await settleHome(tester);
      expect(find.byType(FindHome), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(_field(tester).focusNode!.hasFocus, isTrue);
    });

    testWidgets('a query opens the results of that search', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), query: 'goodwill');
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'goodwill');
      expect(_field(tester).controller!.text, 'goodwill');
      expect(find.byType(RoadmapOffer), findsNothing);
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
      expect(_field(tester).controller!.text, 'goodwill');
      query.value = 'a different search';
      await settleHome(tester);
      expect(tester.widget<FindPanel>(find.byType(FindPanel)).query, 'a different search');
      query.value = null;
      await settleHome(tester);
      expect(find.byType(FindPanel), findsNothing);
      expect(find.byType(RoadmapOffer), findsOneWidget);
    });

    testWidgets('the page\'s scroll before the field docked comes back on Cancel', (tester) async {
      final controller = ScrollController();
      addTearDown(controller.dispose);
      // Practice's title and the Learn door's switch stand above Learn home in its list.
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), controller: controller, header: 300, bottom: 900);
      await settleHome(tester);
      controller.jumpTo(120);
      await tester.pump();
      await tester.tap(_search());
      await settleHome(tester);
      expect(controller.offset, greaterThan(120), reason: 'the field docks near the top, so the keyboard does not cover what follows');
      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      expect(controller.offset, closeTo(120, 1));
    });
  });

  group('a set opens in place from Find', () {
    testWidgets('due today: the head, the chips, one volt key that plays exactly its cards, the chapters that hold them', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-find-due')));
      await settleHome(tester);
      expect(find.byType(HomeShelfSet), findsOneWidget);
      expect(find.byType(FindHome), findsNothing);
      expect(find.text('Due today'), findsOneWidget);
      expect(find.text('9 cards in 3 chapters, about 2 min'), findsOneWidget);
      for (final chip in ['Due today 9', 'Missed lately 6', 'In Revise 26', 'Must-know 235']) {
        expect(find.text(chip), findsOneWidget, reason: chip);
      }
      expect(find.byType(RoadmapOffer), findsNothing, reason: 'the offer is hidden while a set is open');
      expect(_volt(), findsOneWidget);
      expect(_key('Revise these 9'), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-row-$_pf')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-row-$_pl')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-row-accountancy.accounting-ratios')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-row-accountancy.goodwill-valuation')), findsNothing, reason: 'a chapter with none of its cards in the set is not listed');
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('3 cards'), findsNWidgets(3), reason: 'each chapter and how many of its cards are in the set');
      expect([for (final t in _texts(tester)) if (RegExp(r'^Ch \d+$').hasMatch(t)) t], isEmpty, reason: 'a chapter is its name, never a "Ch 2" from the book');

      final (path, q) = await _go(tester, _key('Revise these 9'), router);
      expect(path, '/learn/session');
      expect(q['kind'], 'cards');
      expect(q['chapter'], _pf);
      expect(q['cards']!.split(',').length, 9);
      router.pop();
      await settleHome(tester);

      // Back to the book: the offer and the roadmap are there again.
      await _tap(tester, find.byKey(const ValueKey('lh-set-back')));
      await settleHome(tester);
      expect(find.byType(HomeShelfSet), findsNothing);
      expect(find.byType(RoadmapOffer), findsOneWidget);
      expect(find.text('Your roadmap'), findsOneWidget);
    });

    testWidgets('Cancel closes the set; the chips switch the set; typing replaces it with Find', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-find-missed')));
      await settleHome(tester);
      expect(find.text('Missed lately'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      expect(find.byType(HomeShelfSet), findsNothing);
      expect(find.byType(RoadmapOffer), findsOneWidget);
      expect(find.text('Cancel'), findsNothing);

      await tester.tap(_search());
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-find-due')));
      await settleHome(tester);
      await _tap(tester, find.text('In Revise 26'));
      await settleHome(tester);
      expect(find.text('In Revise'), findsOneWidget);
      await tester.enterText(_search(), 'goodwill');
      await settleHome(tester);
      expect(find.byType(FindPanel), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-set-chips')), findsNothing);
    });

    testWidgets('a set that failed to load says so and tries again', (tester) async {
      final api = HomeLearnApi(failOn: {'subjectCards': FixtureLearnApi.offlineError});
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-find-due')));
      await settleHome(tester);
      expect(find.text('The cards did not load'), findsOneWidget);
      expect(find.text('Check your connection and try again.'), findsOneWidget);
      api.failOn.clear();
      await _tap(tester, _key('Try again'));
      await settleHome(tester);
      expect(find.text('9 cards in 3 chapters, about 2 min'), findsOneWidget);
    });
  });

  group('Your roadmap (rulings R5, ui-correctness#1)', () {
    testWidgets('a new student: Start here on chapter 1, the real size of each chapter, no bar, no state ring', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)));
      await settleHome(tester);
      expect(find.text('Your roadmap'), findsOneWidget);
      expect(find.text('Book order'), findsOneWidget);
      expect(find.text('Start here'), findsOneWidget);
      expect(find.text('Up next'), findsNothing);
      expect(find.descendant(of: _row(_pf), matching: find.text('Start here')), findsOneWidget);
      expect(find.descendant(of: _row(_pf), matching: find.text('45 cards · 10 questions')), findsOneWidget);
      for (final gone in ['Not started', 'Getting there', 'Holding', 'Too few answers', 'Fading', 'All 15 chapters are new to you.']) {
        expect(find.text(gone), findsNothing, reason: '"$gone" is not a word Learn lists draw');
      }
      expect(find.text('Part 1, Partnership Accounts'), findsOneWidget);
      expect(find.text('Accounting for Partnership'), findsOneWidget, reason: 'a unit heading that says more than its one chapter');
      expect(find.text('Dissolution of Partnership Firm'), findsOneWidget, reason: 'a unit named like its one chapter says nothing twice');
      // Every playable chapter is a row, keyed by its chapter; no row carries a bar before a card is seen.
      for (final row in LearnFixtures.subject('home_accountancy_new_pro').chapters.where((c) => c.cards > 0)) {
        expect(_row(row.key), findsOneWidget, reason: row.key);
      }
      expect(find.text('Nothing to practise here yet.'), findsNothing, reason: 'a chapter with no cards is not drawn at all');
      _plainWords(tester);
    });

    testWidgets('a returning student: the coverage line, the verdict word and where it comes from, Up next on the chapter they are in', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.descendant(of: _row(_pf), matching: find.text('12 of 45 cards seen · 3 of 10 questions tried')), findsOneWidget);
      expect(find.descendant(of: _row(_pl), matching: find.text('11 of 42 cards seen · 1 question')), findsOneWidget);
      expect(find.descendant(of: _row(_aop), matching: find.text('58 cards · 2 of 10 questions tried')), findsOneWidget, reason: 'no card seen yet: the total, never "0 of"');
      expect(find.descendant(of: _row(_cpsr), matching: find.text('Needs work · from your papers', findRichText: true)), findsOneWidget);
      expect(find.descendant(of: _row(_aop), matching: find.text('Up next')), findsOneWidget);
      expect(find.text('Start here'), findsNothing);
      for (final gone in ['Getting there', 'Holding', 'Too few answers', 'Not started']) {
        expect(find.text(gone), findsNothing, reason: gone);
      }
      _plainWords(tester);
    });

    testWidgets('the arc of the cards seen (the old 3 dp bar, now on the row node) is drawn only for a chapter with a card seen', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      Finder bar(String key) => find.descendant(of: _row(key), matching: find.byKey(const ValueKey('lh-node-arc')));
      expect(bar(_pf), findsOneWidget);
      expect(bar(_pl), findsOneWidget);
      expect(bar(_aop), findsNothing);
      expect(bar(_cpsr), findsNothing);
    });

    testWidgets('Free: "5 Key cards free in each chapter" once in the header, and every row keeps the chapter\'s real size', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(pro: false, newStudent: true)));
      await settleHome(tester);
      expect(find.text('5 Key cards free in each chapter'), findsOneWidget);
      expect(find.descendant(of: _row(_pf), matching: find.text('45 cards · 10 questions')), findsOneWidget, reason: 'never the free count');
      expect(_texts(tester).where((t) => t.contains('free card') || t.contains('5 of 45')), isEmpty);
    });

    testWidgets('Pro does not say it', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.byKey(const ValueKey('lh-free-each')), findsNothing);
    });

    testWidgets('a part with two options: the line, two pills, and which one shows until one is picked', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)));
      await settleHome(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('lh-switch-p2')));
      await tester.pump();
      expect(find.text('Part 2 has two options. Pick the one your school teaches.'), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-choice-AFS')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-choice-CAS')), findsOneWidget);
      expect(_chosen(tester, 'AFS'), isFalse);
      expect(_chosen(tester, 'CAS'), isFalse);
      expect(find.text('Showing Analysis of Financial Statements until you pick.'), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-option-coming')), findsNothing);
      // The pills are as wide as their words and flow from the left, as the web's: never one across the whole width.
      final afs = tester.getRect(find.byKey(const ValueKey('lh-choice-AFS')));
      final cas = tester.getRect(find.byKey(const ValueKey('lh-choice-CAS')));
      expect(afs.left, MmSpace.gutter);
      expect(cas.left, MmSpace.gutter);
      expect(afs.width, lessThanOrEqualTo(360 - 2 * MmSpace.gutter));
    });

    testWidgets('choosing the side with no cards: Saving your choice at once, the filled pill, then the one line that cards are coming', (tester) async {
      final api = HomeLearnApi(newStudent: true);
      final gate = Completer<void>();
      final keys = HomeKeyCards(api, gate: gate);
      await pumpHome(tester, overrides: homeOverrides(api, keyCards: keys), disableAnimations: false);
      await settleHome(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('lh-switch-p2')));
      await tester.pump(const Duration(milliseconds: 400));
      final above = [for (final k in [_pf, 'accountancy.retirement-and-death-of-partner']) tester.getTopLeft(_row(k)).dy];
      final switchTop = tester.getTopLeft(find.byKey(const ValueKey('lh-switch-p2'))).dy;

      await tester.tap(find.byKey(const ValueKey('lh-choice-CAS')));
      await tester.pump();
      // At once: the tapped side is the chosen one, the hint says it is saving, and nothing above has moved.
      expect(_chosen(tester, 'CAS'), isTrue);
      expect(find.text('Saving your choice'), findsOneWidget);
      expect(keys.saved, ['CAS']);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Saving your choice'), findsOneWidget, reason: 'the server has not answered yet');
      expect(find.byKey(const ValueKey('lh-row-accountancy.accounting-ratios')), findsNothing, reason: 'the other side\'s rows are gone once the cross-fade has run');
      expect(find.text('Cards for this option are coming.'), findsOneWidget);
      expect([for (final k in [_pf, 'accountancy.retirement-and-death-of-partner']) tester.getTopLeft(_row(k)).dy], above, reason: 'nothing above the part switch moves');
      expect(tester.getTopLeft(find.byKey(const ValueKey('lh-switch-p2'))).dy, switchTop, reason: 'the pills stay where the finger is');

      // The server agrees: the choice stays and the hint goes.
      gate.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(_chosen(tester, 'CAS'), isTrue);
      expect(find.text('Saving your choice'), findsNothing);
      expect(find.text('Your choice was not saved. Try again.'), findsNothing);
      expect(find.text('Showing Analysis of Financial Statements until you pick.'), findsNothing);
      expect(api.subjectReads, greaterThanOrEqualTo(2), reason: 'the home was read again after the save');
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('a failed save slides the pill back and says so; both sides show again; trying again is one tap', (tester) async {
      final api = HomeLearnApi(newStudent: true);
      final gate = Completer<void>();
      final keys = HomeKeyCards(api, fail: true, gate: gate);
      await pumpHome(tester, overrides: homeOverrides(api, keyCards: keys), disableAnimations: false);
      await settleHome(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('lh-switch-p2')));
      await tester.pump(const Duration(milliseconds: 400));

      await tester.tap(find.byKey(const ValueKey('lh-choice-CAS')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(_chosen(tester, 'CAS'), isTrue);
      expect(find.byKey(const ValueKey('lh-row-accountancy.accounting-ratios')), findsNothing);

      gate.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.text('Your choice was not saved. Try again.'), findsOneWidget);
      expect(_chosen(tester, 'CAS'), isFalse, reason: 'the choice is dropped');
      expect(find.byKey(const ValueKey('lh-row-accountancy.accounting-ratios')), findsOneWidget, reason: 'the side that shows is back');
      expect(find.text('Cards for this option are coming.'), findsNothing);

      // Trying again is one tap.
      keys.fail = false;
      final retry = Completer<void>();
      keys.gate = retry;
      await tester.tap(find.byKey(const ValueKey('lh-choice-AFS')));
      await tester.pump();
      expect(find.text('Saving your choice'), findsOneWidget);
      expect(_chosen(tester, 'AFS'), isTrue);
      retry.complete();
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Saving your choice'), findsNothing);
      expect(find.text('Your choice was not saved. Try again.'), findsNothing);
      expect(keys.saved, ['CAS', 'AFS']);
    });

    testWidgets('the sort menu offers Book order and Needs work first; Needs work first lists the chapters flat, the weak ones first', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      final parts = LearnFixtures.subject('home_accountancy_pro').parts;
      double top(String key) => tester.getTopLeft(_row(key)).dy;
      List<String> order(List<String> keys) => [...keys]..sort((a, b) => top(a).compareTo(top(b)));
      final book = [for (final f in HomeModel.flatRows(HomeModel.playableParts(parts))) f.row.key];
      expect(order(book), book, reason: 'book order down the page');

      await _tap(tester, find.byKey(const ValueKey('lh-sort')));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Sort chapters'), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort-book')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort-needs')), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort-due')), findsNothing, reason: 'the rows carry no due counts, so a sort by them would order by something unseen');
      expect(find.byKey(const ValueKey('lh-sort-marks')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('lh-sort-needs')));
      await tester.pump(const Duration(milliseconds: 600));
      await settleHome(tester);
      expect(find.text('Needs work first'), findsOneWidget);
      for (final k in book) {
        expect(_row(k), findsOneWidget, reason: 'every row is keyed by its chapter: $k');
      }
      final needs = [for (final f in HomeModel.sortRows(HomeModel.playableParts(parts), 'needs')) f.row.key];
      expect(order(book), needs, reason: 'needs work first');
      expect(top(_cpsr), lessThan(top(_pf)), reason: 'a chapter that needs work comes before one that does not');
      expect(find.text('Part 1, Partnership Accounts'), findsNothing, reason: 'a sorted list is flat');

      await _tap(tester, find.byKey(const ValueKey('lh-sort')));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(find.byKey(const ValueKey('lh-sort-book')));
      await tester.pump(const Duration(milliseconds: 600));
      await settleHome(tester);
      expect(order(book), book);
      expect(find.text('Part 1, Partnership Accounts'), findsOneWidget);
    });

    testWidgets('a row opens the chapter page', (tester) async {
      final router = await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      final (path, q) = await _go(tester, _row('accountancy.goodwill-valuation'), router);
      expect(path, '/learn/c/accountancy.goodwill-valuation');
      expect(q, isEmpty);
    });

    testWidgets('a subject with no chapter that has cards: one line, no sort menu', (tester) async {
      final api = HomeLearnApi(
        thin: true,
        edit: (j) {
          for (final p in (j['parts'] as List).cast<Map<String, dynamic>>()) {
            p['option'] = null;
          }
        },
      );
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.text('Your roadmap'), findsOneWidget);
      expect(find.text('No chapters here yet.'), findsOneWidget);
      expect(find.byKey(const ValueKey('lh-sort')), findsNothing);
      expect(find.text('Nothing to practise here yet.'), findsNothing);
    });

    testWidgets('English carries its note under the field', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(), subject: 'english'));
      await settleHome(tester);
      expect(find.text('English cards are written for MockMob, not taken from an NCERT book.'), findsOneWidget);
      expect(find.text('Find a topic, like synonym'), findsOneWidget);
    });
  });

  group('the states', () {
    testWidgets('loading: the picker and the field stay; the offer and the roadmap are skeletons at their final shape', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HoldLearnApi()));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(_picker(), findsOneWidget, reason: 'drawn from the profile at once');
      expect(_search(), findsOneWidget);
      expect(find.byType(RoadmapOfferSkeleton), findsOneWidget);
      expect(find.byType(ChapterMapSkeleton), findsOneWidget);
      expect(find.byType(RoadmapOffer), findsNothing);
      expect(find.text('Your roadmap'), findsNothing);
      expect(_volt(), findsNothing);
    });

    testWidgets('the skeletons give way to the page', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(slow: const Duration(seconds: 5))));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(RoadmapOfferSkeleton), findsOneWidget);
      await tester.pump(const Duration(seconds: 6));
      await settleHome(tester);
      expect(find.byType(RoadmapOfferSkeleton), findsNothing);
      expect(find.byType(RoadmapOffer), findsOneWidget);
      expect(find.text('Your roadmap'), findsOneWidget);
    });

    testWidgets('failed: "Learn did not load", what is safe, and one Try again that reads it again', (tester) async {
      final api = HomeLearnApi(error: true);
      await pumpHome(tester, overrides: homeOverrides(api));
      await settleHome(tester);
      expect(find.text('Learn did not load'), findsOneWidget);
      expect(find.text('Check your connection and try again. Your cards and their schedule are safe.'), findsOneWidget);
      expect(_picker(), findsOneWidget, reason: 'the subject row stays usable');
      expect(_search(), findsOneWidget);
      expect(find.byType(RoadmapOffer), findsNothing);
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

    testWidgets('Find on a failed home: the same words and Try again, the field stays', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(error: true)));
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      expect(find.text('Learn did not load'), findsOneWidget);
      expect(find.byType(FindHome), findsNothing);
      expect(find.text('Cancel'), findsOneWidget);
    });
  });

  group('the entrance plays once', () {
    test('the numbers of the page: 6 dp, 24 ms apart, the first 12, 524 ms in all', () {
      expect(HomeEntrance.rise, 6);
      expect(HomeEntrance.step, const Duration(milliseconds: 24));
      expect(HomeEntrance.cap, 12);
      expect(HomeEntrance.total, const Duration(milliseconds: 24 * 11 + 260));
    });

    testWidgets('on the first arrival the offer rises into its place and never falls', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), disableAnimations: false);
      await tester.pump();
      // Step in single frames until the offer exists, then watch it settle.
      double? first;
      for (var i = 0; i < 40 && first == null; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        final title = find.byKey(const ValueKey('lh-offer-title'));
        if (title.evaluate().isNotEmpty) first = tester.getTopLeft(title).dy;
      }
      expect(first, isNotNull);
      await tester.pump(const Duration(milliseconds: 700));
      final settled = tester.getTopLeft(find.byKey(const ValueKey('lh-offer-title'))).dy;
      expect(first!, greaterThanOrEqualTo(settled), reason: 'it rises into place');
      expect(first - settled, lessThanOrEqualTo(6.01));
    });

    testWidgets('the offer of another subject arrives where it stands: the entrance has played', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), disableAnimations: false);
      await settleHome(tester);
      await tester.pump(const Duration(seconds: 1));
      final container = ProviderScope.containerOf(tester.element(find.byType(LearnHome)));
      container.read(practiceSubjectProvider.notifier).select('economics');
      await tester.pump();
      double? first;
      for (var i = 0; i < 40 && first == null; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        final title = find.byKey(const ValueKey('lh-offer-title'));
        if (title.evaluate().isNotEmpty && find.text("Today's 10 minutes in Economics").evaluate().isNotEmpty) first = tester.getTopLeft(title).dy;
      }
      expect(first, isNotNull);
      await tester.pump(const Duration(milliseconds: 700));
      expect(tester.getTopLeft(find.byKey(const ValueKey('lh-offer-title'))).dy, closeTo(first!, 0.01), reason: 'no second rise');
    });
  });

  group('text at 1.3 on a 360 dp phone', () {
    for (final (name, api) in <(String, HomeLearnApi Function())>[
      ('returning Pro', () => HomeLearnApi()),
      ('new Free', () => HomeLearnApi(pro: false, newStudent: true)),
      ('Free with its day used', () => HomeLearnApi(pro: false, freeUsed: true)),
      ('thin subject', () => HomeLearnApi(thin: true)),
    ]) {
      testWidgets('$name draws without overflow, from the picker to the last chapter', (tester) async {
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

    testWidgets('Find open, a set open and a long search hold too', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()), textScale: 1.3);
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      expect(tester.takeException(), isNull);
      await _tap(tester, find.byKey(const ValueKey('lh-find-due')));
      await settleHome(tester);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Cancel'));
      await settleHome(tester);
      await tester.tap(_search());
      await settleHome(tester);
      await tester.enterText(_search(), 'a long search with several words in it, past what fits');
      await settleHome(tester);
      expect(tester.takeException(), isNull);
    });

    testWidgets('the offer\'s long chapter name wraps and never overflows', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true)), textScale: 1.3);
      await settleHome(tester);
      expect(tester.takeException(), isNull);
      expect(find.text('Chapter 1 of 14 · Accounting for Partnership: Basic Concepts'), findsOneWidget);
    });
  });

  group('every key is at least 48 dp', () {
    for (final scale in [1.0, 1.3]) {
      testWidgets('a new student at text scale $scale', (tester) async {
        await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(newStudent: true), nudges: true), textScale: scale);
        await settleHome(tester);
        final tooSmall = <String>[];
        for (final e in find.byType(MmPressable).evaluate()) {
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

    testWidgets('the field, its Clear and Cancel keys, Find\'s rows and chips, and Free\'s block', (tester) async {
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi(pro: false, freeUsed: true), nudges: true));
      await settleHome(tester);
      expect(tester.getSize(_search()).height, greaterThanOrEqualTo(HomeSearchField.height - 0.01));
      final small = <String>[];
      void check() {
        for (final e in find.byType(MmPressable).evaluate()) {
          final box = e.renderObject! as RenderBox;
          if (box.size.height < 47.99 || box.size.width < 47.99) small.add('${(e.widget as MmPressable).semanticsLabel}: ${box.size}');
        }
      }

      check();
      await tester.tap(_search());
      await settleHome(tester);
      check();
      await tester.enterText(_search(), 'goodwill');
      await settleHome(tester);
      check();
      expect(small, isEmpty);
    });
  });

  group('the page speaks plainly to a screen reader', () {
    testWidgets('the picker, the offer, rows and the sort menu carry their words; the one header is the subject', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpHome(tester, overrides: homeOverrides(HomeLearnApi()));
      await settleHome(tester);
      expect(find.bySemanticsLabel('Subject: Accountancy. Change subject'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'Pick up\s+Admission of a Partner')), findsWidgets);
      expect(find.bySemanticsLabel('Sort chapters, now Book order'), findsOneWidget);
      final row = LearnFixtures.subject('home_accountancy_pro').chapter(_aop)!;
      expect(find.bySemanticsLabel(HomeModel.rowSpoken(row, here: 'Up next')), findsOneWidget);
      final weak = LearnFixtures.subject('home_accountancy_pro').chapter(_cpsr)!;
      expect(find.bySemanticsLabel(HomeModel.rowSpoken(weak)), findsOneWidget);
      expect(HomeModel.rowSpoken(weak), contains('Needs work · from your papers'));
      handle.dispose();
    });
  });

  test('the providers it reads are the shared ones', () {
    // One subject between Learn and Practice: the Learn id is Practice's, as the public id the Learn routes take.
    final c = ProviderContainer(overrides: [practiceSubjectProvider.overrideWithBuild((ref, n) => 'business')]);
    addTearDown(c.dispose);
    expect(c.read(learnSubjectIdProvider), 'business_studies');
  });

  test('the subject line and the field\'s words come from the subject', () {
    expect(HomeModel.subjectLine(const LearnSubjectInfo(id: 'accountancy', name: 'Accountancy', cards: 912, chapters: 14, lessons: 4)), '14 chapters · 912 Key cards · 4 lessons');
    expect(HomeModel.findPlaceholder('accountancy'), 'Find a topic, like goodwill');
    expect(HomeModel.findPlaceholder('maths'), 'Find a chapter or topic');
  });
}
