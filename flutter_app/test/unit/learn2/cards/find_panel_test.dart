// Find (the results under Learn home's field) as a student meets it: nothing under two characters, the head and its count, the
// cards by chapter with the searched words underlined from the server's spans, the one volt key and what it plays, Show
// answers, Show, Pick and its bar, Free's locked matches, no results, a failed read, and text 1.3 times larger at 360 dp.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/learn2/cards/card_model.dart';
import 'package:mockmob/features/learn2/cards/cards_copy.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';

import '../../../helpers/fonts.dart';
import '../support/fixture_learn_api.dart';
import 'cards_support.dart';

/// The recorded search with [change] applied to its body.
class _SearchApi extends FixtureLearnApi {
  _SearchApi({super.pro, required this.change});

  final void Function(Json body) change;

  @override
  Future<LearnSearch> search(String subject, String query) async {
    final found = await super.search(subject, query);
    final body = asJson(found.raw);
    final copy = LearnFixtures.json('search_goodwill_${pro ? 'pro' : 'free'}');
    copy['query'] = body['query'];
    change(copy);
    return LearnSearch.parse(copy);
  }
}

void main() {
  setUpAll(loadAppFonts);

  final proSearch = LearnSearch.parse(LearnFixtures.json('search_goodwill_pro'));
  final proGroups = CardsModel.resultGroups(proSearch.cards);
  final proIds = CardsModel.ids(proGroups);
  final firstId = proGroups.first.cards.first.id;

  Future<ValueNotifier<String>> pumpFind(
    WidgetTester tester,
    FixtureLearnApi api, {
    String text = 'goodwill',
    bool nudges = false,
    Brightness brightness = Brightness.dark,
    double textScale = 1,
    Size size = const Size(360, 800),
  }) async {
    final query = ValueNotifier<String>('');
    addTearDown(query.dispose);
    await pumpCards(tester, FindPage(query: query), overrides: cardsOverrides(api, nudges: nudges), brightness: brightness, textScale: textScale, size: size);
    await settleCards(tester);
    if (text.isNotEmpty) await typeQuery(tester, query, text);
    return query;
  }

  group('under two characters', () {
    testWidgets('nothing is drawn for nothing typed, and the server is not asked', (tester) async {
      final api = FixtureLearnApi();
      await pumpFind(tester, api, text: '');
      expect(find.textContaining('Results for'), findsNothing);
      expect(find.byType(KeyButton), findsNothing);
      expect(api.calls.where((c) => c.startsWith('search')), isEmpty);
    });

    testWidgets('one character gets one line and no read', (tester) async {
      final api = FixtureLearnApi();
      final q = await pumpFind(tester, api, text: 'g');
      expect(find.text(CardsCopy.findHint), findsOneWidget);
      expect(find.textContaining('Results for'), findsNothing);
      expect(api.calls.where((c) => c.startsWith('search')), isEmpty);
      // Clearing the field takes it away at once.
      q.value = '';
      await tester.pump();
      expect(find.text(CardsCopy.findHint), findsNothing);
    });

    testWidgets('a second character searches, once the typing has rested', (tester) async {
      final api = FixtureLearnApi();
      final q = await pumpFind(tester, api, text: '');
      q.value = 'go';
      await tester.pump(const Duration(milliseconds: 100));
      q.value = 'goo';
      await tester.pump(const Duration(milliseconds: 100));
      q.value = 'good';
      await tester.pump(const Duration(milliseconds: 100));
      // Still resting: nothing has been asked.
      expect(api.calls.where((c) => c.startsWith('search')), isEmpty);
      await tester.pump(const Duration(milliseconds: 200));
      await settleCards(tester);
      expect(api.calls.where((c) => c.startsWith('search')), ['search good']);
    });
  });

  group('the results', () {
    testWidgets('say what was searched and what was found, and group the cards by chapter in the order they came', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      expect(find.text('Results for “goodwill”'), findsOneWidget);
      expect(find.text('50 cards in 4 chapters'), findsOneWidget);
      expect(proGroups.map((g) => g.cards.length), [32, 13, 4, 1]);
      var y = -1.0;
      for (final g in proGroups) {
        final bar = find.text(g.title);
        expect(bar, findsOneWidget, reason: g.title);
        final top = tester.getTopLeft(bar).dy;
        expect(top, greaterThan(y), reason: 'the bars come in the order of the results');
        y = top;
      }
      // Every open card is a row.
      expect(find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('card-row-')), findsNWidgets(50));
      // The count says "more" when the server held some back.
      expect(find.text(CardsCopy.more(proSearch.more)), findsOneWidget);
    });

    testWidgets('underline the searched words in the front from the server\'s spans, and nothing else', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      expect(underlined(tester, find.byKey(ValueKey('card-row-$firstId'))), ['Goodwill']);
      // A kind that says itself ("Formula: Goodwill by ...") is drawn without its prefix: the span moves with the words.
      final formula = proGroups.expand((g) => g.cards).firstWhere((e) => e.card.front.startsWith('Formula: '));
      final row = find.byKey(ValueKey('card-row-${formula.id}'));
      expect(underlined(tester, row), ['Goodwill']);
      expect(find.descendant(of: row, matching: find.textContaining('Formula:')), findsNothing);
    });

    testWidgets('draw a blank as a gap and still underline the words around it', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      final blank = proGroups.expand((g) => g.cards).firstWhere((e) => e.card.front.contains('____'));
      final row = find.byKey(ValueKey('card-row-${blank.id}'));
      expect(find.descendant(of: row, matching: find.textContaining('____')), findsNothing);
      expect(underlined(tester, row).map((w) => w.toLowerCase()), contains('goodwill'));
    });

    testWidgets('show Must-know as a word, and nothing like it on a card that is not', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      final must = proGroups.expand((g) => g.cards).where((e) => e.card.mustKnow).toList();
      final good = proGroups.expand((g) => g.cards).where((e) => !e.card.mustKnow).toList();
      expect(must, isNotEmpty);
      expect(find.descendant(of: find.byKey(ValueKey('card-row-${must.first.id}')), matching: find.text(KeyCardsCopy.mustKnow)), findsOneWidget);
      expect(find.descendant(of: find.byKey(ValueKey('card-row-${good.first.id}')), matching: find.text(KeyCardsCopy.mustKnow)), findsNothing);
    });

    testWidgets('show the NCERT line of a card that matched only in NCERT\'s words, with the match underlined, without a tap', (tester) async {
      final api = _SearchApi(
        change: (body) {
          final card = (body['cards'] as List).first as Map<String, dynamic>;
          (card['match'] as Map<String, dynamic>)['front'] = <dynamic>[];
          // The searched word sits in the quote, not in the front.
          (card['card'] as Map<String, dynamic>)['front'] = 'Who may specifically decide the method to be used?';
        },
      );
      await pumpFind(tester, api);
      final row = find.byKey(ValueKey('card-row-$firstId'));
      expect(find.descendant(of: row, matching: find.byKey(ValueKey('card-show-$firstId'))), findsNothing, reason: 'the line is out, so there is nothing to show');
      expect(underlined(tester, row), contains('Goodwill'));
      expect(find.descendant(of: row, matching: find.textContaining('Goodwill calculated by one method', findRichText: true)), findsWidgets);
    });

    testWidgets('keep the first group above the second, then one tap on a bar opens its chapter', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(ValueKey('cards-bar-${proGroups[1].id}')));
      expect(lastVisit().path, '/learn/c/${Uri.encodeComponent(proGroups[1].chapterKey!)}');
    });
  });

  group('the keys', () {
    testWidgets('one volt key, Study these 50, plays exactly the 50 cards in order, in the first card\'s chapter', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      expect(voltKeys(tester), 1);
      await tapAt(tester, find.text('Study these 50'));
      final uri = lastVisit();
      expect(uri.path, '/learn/session');
      expect(uri.queryParameters['kind'], 'cards');
      expect(uri.queryParameters['min'], '10');
      expect(uri.queryParameters['chapter'], proGroups.first.chapterKey);
      expect(cardsOf(uri), proIds);
    });

    testWidgets('a search of over 100 cards offers no volt key, and says to pick or add a word', (tester) async {
      final api = _SearchApi(
        change: (body) {
          final cards = (body['cards'] as List).cast<Map<String, dynamic>>();
          final extra = <Map<String, dynamic>>[];
          for (var i = 0; cards.length + extra.length < 120; i++) {
            final copy = jsonDecode(jsonEncode(cards[i % 27])) as Map<String, dynamic>;
            final card = copy['card'] as Map<String, dynamic>;
            card['id'] = '${card['id']}-copy$i';
            extra.add(copy);
          }
          body['cards'] = [...cards, ...extra];
        },
      );
      await pumpFind(tester, api);
      expect(find.text(CardsCopy.over(120, 100)), findsOneWidget);
      expect(find.text('Study these 120'), findsNothing);
      expect(voltKeys(tester), 0);
    });

    testWidgets('Pick shows a box on every row, a pick raises the bar, and the bar plays exactly what is picked', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      expect(find.byKey(const ValueKey('cards-pick-bar')), findsNothing);
      await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
      expect(find.text(CardsCopy.pickDone), findsOneWidget);
      final second = proGroups.first.cards[1].id;
      final fourth = proGroups.first.cards[3].id;
      // Picked in this order: the run takes them in this order.
      await tapAt(tester, find.byKey(ValueKey('card-pick-$fourth')));
      await tapAt(tester, find.byKey(ValueKey('card-pick-$second')));
      expect(find.text('2 picked'), findsOneWidget);
      // The page's key steps back to an outline: the bar holds the one volt key.
      expect(voltKeys(tester), 1);
      expect(find.descendant(of: find.byKey(const ValueKey('cards-pick-bar')), matching: find.text('Study these 2')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('cards-pick-study')));
      await settleCards(tester);
      final uri = lastVisit();
      expect(uri.queryParameters['kind'], 'cards');
      expect(cardsOf(uri), [fourth, second]);
      expect(uri.queryParameters['chapter'], proGroups.first.chapterKey);
    });

    testWidgets('Clear unpicks everything and takes the bar away, and Done leaves pick mode', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
      await tapAt(tester, find.byKey(ValueKey('card-pick-${proGroups.first.cards.first.id}')));
      expect(find.text('1 picked'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('cards-pick-clear')));
      await settleCards(tester);
      expect(find.byKey(const ValueKey('cards-pick-bar')), findsNothing);
      // Still picking: the boxes stay until Done.
      expect(find.byKey(ValueKey('card-pick-${proGroups.first.cards.first.id}')), findsOneWidget);
      await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
      expect(find.byKey(ValueKey('card-pick-${proGroups.first.cards.first.id}')), findsNothing);
      expect(find.text(CardsCopy.pick), findsOneWidget);
    });
  });

  group('a row', () {
    testWidgets('keeps NCERT\'s line folded until Show, and Show turns to Hide', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      final entry = proGroups.first.cards[1];
      final row = find.byKey(ValueKey('card-row-${entry.id}'));
      final line = find.descendant(of: row, matching: find.textContaining(entry.card.back.substring(0, 24), findRichText: true));
      expect(line, findsNothing);
      await tapAt(tester, find.byKey(ValueKey('card-show-${entry.id}')));
      expect(line, findsWidgets);
      expect(find.descendant(of: row, matching: find.text(CardsCopy.hide)), findsOneWidget);
      await tapAt(tester, find.byKey(ValueKey('card-show-${entry.id}')));
      expect(find.descendant(of: row, matching: find.text(CardsCopy.show)), findsOneWidget);
    });

    testWidgets('Show answers puts the line on every row and takes the Show keys away', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      expect(find.byKey(ValueKey('card-show-$firstId')), findsOneWidget);
      await tapAt(tester, find.byKey(const ValueKey('cards-show-answers')));
      expect(find.byKey(ValueKey('card-show-$firstId')), findsNothing);
      final entry = proGroups.first.cards[1];
      expect(find.descendant(of: find.byKey(ValueKey('card-row-${entry.id}')), matching: find.textContaining(entry.card.back.substring(0, 24), findRichText: true)), findsWidgets);
    });

    testWidgets('opens in place to the full words, the source and its actions, and one row is open at a time', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      final a = proGroups.first.cards[0].id;
      final b = proGroups.first.cards[1].id;
      await tapAt(tester, find.byKey(ValueKey('card-hit-$a')));
      expect(find.byKey(ValueKey('card-study-$a')), findsOneWidget);
      expect(find.byKey(ValueKey('card-report-$a')), findsOneWidget);
      expect(find.text(proGroups.first.cards[0].card.source.reference!), findsOneWidget);
      await tapAt(tester, find.byKey(ValueKey('card-hit-$b')));
      expect(find.byKey(ValueKey('card-study-$a')), findsNothing);
      expect(find.byKey(ValueKey('card-study-$b')), findsOneWidget);
      await tapAt(tester, find.byKey(ValueKey('card-study-$b')));
      expect(cardsOf(lastVisit()), [b]);
    });

    testWidgets('Report opens the reasons', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      final a = proGroups.first.cards.first.id;
      await tapAt(tester, find.byKey(ValueKey('card-hit-$a')));
      await tapAt(tester, find.byKey(ValueKey('card-report-$a')));
      expect(find.text(KeyCardsCopy.reportTitle), findsOneWidget);
      expect(find.text(KeyCardsCopy.reportReasons.first), findsOneWidget);
    });
  });

  group('the chapter jump', () {
    testWidgets('lists the chapters with their counts and brings the chosen one to the top', (tester) async {
      await pumpFind(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-jump')));
      for (final g in proGroups) {
        expect(find.byKey(ValueKey('cards-jump-${g.id}')), findsOneWidget);
      }
      final last = proGroups[1];
      await tester.tap(find.byKey(ValueKey('cards-jump-${last.id}')));
      await settleCards(tester);
      await tester.pump(const Duration(milliseconds: 600));
      final top = tester.getTopLeft(find.byKey(ValueKey('cards-bar-${last.id}'))).dy;
      expect(top, lessThan(260));
      expect(top, greaterThan(0));
    });

    testWidgets('is not offered for one chapter', (tester) async {
      final api = _SearchApi(
        change: (body) {
          body['cards'] = [for (final c in asJsonList(body['cards'])) if ((c as Map)['chapterKey'] == 'accountancy.change-in-profit-sharing-ratio') c];
        },
      );
      await pumpFind(tester, api);
      expect(find.byKey(const ValueKey('cards-jump')), findsNothing);
    });
  });

  group('chapters and lessons the search found', () {
    testWidgets('show three rows and a key for the rest, and open the chapter', (tester) async {
      final api = _SearchApi(
        change: (body) {
          body['chapters'] = [
            for (var i = 0; i < 5; i++) {'key': 'accountancy.chap-$i', 'title': 'A chapter $i', 'cards': i + 1, 'match': <String, dynamic>{}},
          ];
          body['lessons'] = [
            {'id': 'u-1', 'title': 'A lesson on goodwill', 'chapterKey': 'accountancy.goodwill-valuation', 'match': <String, dynamic>{}},
          ];
        },
      );
      await pumpFind(tester, api);
      expect(find.text('50 cards in 4 chapters, 1 lesson'), findsOneWidget);
      expect(find.byKey(const ValueKey('find-link-accountancy.chap-0')), findsOneWidget);
      expect(find.byKey(const ValueKey('find-link-accountancy.chap-2')), findsOneWidget);
      expect(find.byKey(const ValueKey('find-link-accountancy.chap-3')), findsNothing);
      await tapAt(tester, find.text('Show all 5 chapters'));
      expect(find.byKey(const ValueKey('find-link-accountancy.chap-4')), findsOneWidget);
      await tapAt(tester, find.byKey(const ValueKey('find-link-accountancy.chap-1')));
      expect(lastVisit().path, '/learn/c/accountancy.chap-1');
      await tapAt(tester, find.text('back from landing'));
      await tapAt(tester, find.byKey(const ValueKey('find-link-u-1')));
      expect(lastVisit().path, '/learn/u-1');
    });
  });

  group('Free', () {
    testWidgets('shows the open matches whole and one line for the locked ones, never a wall of locks', (tester) async {
      final api = FixtureLearnApi(pro: false);
      await pumpFind(tester, api, nudges: true);
      final free = LearnSearch.parse(LearnFixtures.json('search_goodwill_free'));
      final groups = CardsModel.resultGroups(free.cards);
      final locked = CardsModel.lockedMatches(free.cards);
      expect(locked, 40);
      expect(CardsModel.ids(groups).length, 10);
      expect(find.text('10 cards in 3 chapters'), findsOneWidget);
      expect(find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('card-row-')), findsNWidgets(10));
      expect(find.text('40 more cards match in cards Pro opens. ${KeyCardsCopy.proLine}'), findsOneWidget);
      expect(find.byKey(const ValueKey('cards-see-pro')), findsOneWidget);
      // One lock for the one line, not one for every card.
      expect(find.byIcon(LucideIcons.lock), findsOneWidget);
      // The one volt key plays the open cards only.
      await tapAt(tester, find.text('Study these 10'));
      expect(cardsOf(lastVisit()), CardsModel.ids(groups));
    });

    testWidgets('has no See Pro key where Pro nudges are off, but the line stays', (tester) async {
      await pumpFind(tester, FixtureLearnApi(pro: false));
      expect(find.byKey(const ValueKey('cards-see-pro')), findsNothing);
      expect(find.textContaining('40 more cards match'), findsOneWidget);
    });

    testWidgets('says so alone when every match is locked', (tester) async {
      final api = _SearchApi(
        pro: false,
        change: (body) {
          body['cards'] = [for (final c in asJsonList(body['cards'])) if ((c as Map)['locked'] == true) c];
        },
      );
      await pumpFind(tester, api);
      expect(find.textContaining('40 more cards match'), findsOneWidget);
      expect(find.byType(KeyButton), findsNothing);
    });
  });

  group('the states', () {
    testWidgets('no results says what matched nothing and what to try', (tester) async {
      await pumpFind(tester, FixtureLearnApi(), text: 'xyz');
      expect(find.text('Results for “xyz”'), findsOneWidget);
      expect(find.text('Nothing matches “xyz”.'), findsOneWidget);
      expect(find.text(CardsCopy.noMatchLine), findsOneWidget);
      expect(find.byType(KeyButton), findsNothing);
    });

    testWidgets('loading draws the head and the rows at their size, with no numbers', (tester) async {
      final api = HoldCardsApi();
      final q = ValueNotifier<String>('');
      addTearDown(q.dispose);
      await pumpCards(tester, FindPage(query: q), overrides: cardsOverrides(api));
      q.value = 'goodwill';
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Results for “goodwill”'), findsOneWidget);
      expect(find.bySemanticsLabel(CardsCopy.findLoading), findsWidgets);
      expect(find.textContaining('cards in'), findsNothing);
      expect(find.byType(KeyButton), findsNothing);
      api.gate.complete();
      await settleCards(tester);
      expect(find.text('50 cards in 4 chapters'), findsOneWidget);
    });

    testWidgets('a failed read says so, and Try again reads it again', (tester) async {
      final api = FixtureLearnApi(failOn: {'search': FixtureLearnApi.offlineError});
      await pumpFind(tester, api);
      expect(find.text(CardsCopy.findFailedTitle), findsOneWidget);
      expect(find.text(CardsCopy.findFailedLine), findsOneWidget);
      expect(find.textContaining('cards in'), findsNothing);
      api.failOn.clear();
      await tester.tap(find.byKey(const ValueKey('cards-retry')));
      await settleCards(tester);
      expect(find.text('50 cards in 4 chapters'), findsOneWidget);
      expect(find.text(CardsCopy.findFailedTitle), findsNothing);
    });

    testWidgets('a new search keeps the last results on screen until the next arrive', (tester) async {
      final api = FixtureLearnApi();
      final q = await pumpFind(tester, api);
      expect(find.text('50 cards in 4 chapters'), findsOneWidget);
      api.slow = const Duration(milliseconds: 500);
      q.value = 'goodwill valuation';
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 50));
      // The words of the new search are in the head; the old cards are still there.
      expect(find.text('Results for “goodwill”'), findsOneWidget);
      expect(find.byKey(ValueKey('card-row-$firstId')), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 600));
      await settleCards(tester);
      expect(find.text('Results for “goodwill valuation”'), findsOneWidget);
    });
  });

  group('large text and targets', () {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';

      testWidgets('text 1.3 times larger at 360 dp draws without overflow, $tag', (tester) async {
        await pumpFind(tester, FixtureLearnApi(), brightness: brightness, textScale: 1.3);
        expect(tester.takeException(), isNull);
        expect(find.text('50 cards in 4 chapters'), findsOneWidget);
        await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
        await tapAt(tester, find.byKey(ValueKey('card-pick-${proGroups.first.cards.first.id}')));
        expect(tester.takeException(), isNull);
        expect(find.text('1 picked'), findsOneWidget);
      });

      testWidgets('every target is 48 dp and named, and the text reads, $tag', (tester) async {
        await pumpFind(tester, FixtureLearnApi(pro: false), brightness: brightness, nudges: true);
        final handle = tester.ensureSemantics();
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });

      testWidgets('with the pick bar up every target is 48 dp and named, $tag', (tester) async {
        await pumpFind(tester, FixtureLearnApi(), brightness: brightness);
        await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
        await tapAt(tester, find.byKey(ValueKey('card-pick-${proGroups.first.cards.first.id}')));
        final handle = tester.ensureSemantics();
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });
    }
  });
}
