// The chapter's Cards view as a student meets it: the head and the four filters with their counts, the one volt key and what it
// plays, rows that open in place, Show and Show answers, Pick and its bar, the sections jump and the pinned bar, Free's open
// cards and its one locked line, an empty filter, loading, a failed read, where Back goes, and text 1.3 times larger at 360 dp.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/learn2/cards/card_model.dart';
import 'package:mockmob/features/learn2/cards/cards_copy.dart';
import 'package:mockmob/features/learn2/cards/cards_view.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';

import '../../../helpers/fonts.dart';
import '../support/fixture_learn_api.dart';
import 'cards_support.dart';

/// The recorded Cards view with [change] applied to its body.
class _CardsApi extends FixtureLearnApi {
  _CardsApi({required this.change});

  final void Function(Json body, String filter) change;

  @override
  Future<LearnChapterCards> chapterCards(String chapter, {String filter = 'all'}) async {
    final base = await super.chapterCards(chapter, filter: filter);
    final body = asJson(jsonDecode(jsonEncode(base.raw)));
    change(body, filter);
    return LearnChapterCards.parse(body);
  }
}

/// How many gap boxes (inline widgets) a text holds.
int _gaps(InlineSpan? span) {
  if (span is WidgetSpan) return 1;
  if (span is TextSpan) return (span.children ?? const <InlineSpan>[]).fold(0, (n, c) => n + _gaps(c));
  return 0;
}

final Finder _rows = find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('card-row-'));

void main() {
  setUpAll(loadAppFonts);

  final pro = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_pro'));
  final proGroups = CardsModel.visibleSections(pro.sections, pro.lockedLine);
  final proIds = CardsModel.ids(proGroups);
  final must = LearnChapterCards.parse(LearnFixtures.json('cards_aop_must_pro'));
  final mustIds = CardsModel.ids(CardsModel.visibleSections(must.sections, null));
  final free = LearnChapterCards.parse(LearnFixtures.json('cards_aop_all_free'));
  final freeGroups = CardsModel.visibleSections(free.sections, free.lockedLine);
  final freeIds = CardsModel.ids(freeGroups);

  Future<GoRouter> pumpView(
    WidgetTester tester,
    FixtureLearnApi api, {
    String? filter,
    bool nudges = false,
    Brightness brightness = Brightness.dark,
    double textScale = 1,
    Size size = const Size(360, 800),
  }) async {
    final router = await pumpCards(
      tester,
      CardsViewScreen(chapterKey: cardsChapter, filter: filter),
      overrides: cardsOverrides(api, nudges: nudges),
      brightness: brightness,
      textScale: textScale,
      size: size,
    );
    await settleCards(tester);
    return router;
  }

  group('the head', () {
    testWidgets('names the chapter, the subject and how many cards, over the four filters with their counts', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      expect(find.text(CardsCopy.title), findsOneWidget);
      expect(find.text('Admission of a Partner'), findsOneWidget, reason: 'Back is named by the chapter');
      expect(find.text('Accountancy, Ch 2, 53 cards'), findsOneWidget);
      expect(pro.counts.all, 53);
      for (final (value, label, n) in [('all', 'All', 53), ('must', 'Must-know', 14), ('revise', 'In Revise', 0), ('missed', 'Missed lately', 2)]) {
        expect(find.byKey(ValueKey('cards-filter-$value')), findsOneWidget, reason: label);
        expect(find.descendant(of: find.byKey(ValueKey('cards-filter-$value')), matching: find.text(label)), findsOneWidget);
        expect(find.descendant(of: find.byKey(ValueKey('cards-filter-$value')), matching: find.text('$n')), findsOneWidget);
      }
    });

    testWidgets('has one volt key, Study these 53, that plays every card of the chapter in book order', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      expect(voltKeys(tester), 1);
      await tapAt(tester, find.text('Study these 53'));
      final uri = lastVisit();
      expect(uri.path, '/learn/session');
      expect(uri.queryParameters['chapter'], cardsChapter);
      expect(uri.queryParameters['kind'], 'cards');
      expect(uri.queryParameters['min'], '10');
      expect(cardsOf(uri), proIds);
    });

    testWidgets('keeps the whole chapter as the opening filter unless the link names one', (tester) async {
      await pumpView(tester, FixtureLearnApi(), filter: 'nonsense');
      expect(find.text('Study these 53'), findsOneWidget);
      expect(tester.widget<MmPressable>(find.byKey(const ValueKey('cards-filter-all'))).selected, isTrue);
    });
  });

  group('the filters', () {
    testWidgets('a link can open Must-know: Study these 14, the 14 cards, and no Must-know word drawn on every row', (tester) async {
      await pumpView(tester, FixtureLearnApi(), filter: 'must');
      expect(tester.widget<MmPressable>(find.byKey(const ValueKey('cards-filter-must'))).selected, isTrue);
      expect(find.text('Study these 14'), findsOneWidget);
      expect(_rows, findsWidgets);
      expect(find.text(KeyCardsCopy.mustKnow), findsOneWidget, reason: 'only the chip says it');
      await tapAt(tester, find.text('Study these 14'));
      expect(cardsOf(lastVisit()), mustIds);
    });

    testWidgets('choosing a filter reads it, moves the selection and changes what the key plays', (tester) async {
      final api = FixtureLearnApi();
      await pumpView(tester, api);
      expect(_rows.evaluate().length, lessThan(53), reason: 'only the rows near the top are built');
      await tapAt(tester, find.byKey(const ValueKey('cards-filter-must')));
      expect(api.calls, contains('chapterCards $cardsChapter must'));
      expect(tester.widget<MmPressable>(find.byKey(const ValueKey('cards-filter-must'))).selected, isTrue);
      expect(tester.widget<MmPressable>(find.byKey(const ValueKey('cards-filter-all'))).selected, isFalse);
      expect(find.text('Study these 14'), findsOneWidget);
      expect(voltKeys(tester), 1);
    });

    testWidgets('Missed lately and In Revise are words at the end of the kind line, and Missed lately is in the warning colour', (tester) async {
      final api = _CardsApi(
        change: (body, filter) {
          final cards = [for (final s in body['sections'] as List) ...(s['cards'] as List)];
          (cards[0] as Map<String, dynamic>)['inRevise'] = true;
          (cards[0] as Map<String, dynamic>)['missedLately'] = true;
        },
      );
      await pumpView(tester, api);
      final first = find.byKey(ValueKey('card-row-${proIds.first}'));
      expect(find.descendant(of: first, matching: find.text(CardsCopy.missedLately)), findsOneWidget);
      expect(find.descendant(of: first, matching: find.text(CardsCopy.inRevise)), findsOneWidget);
      final missed = tester.widget<Text>(find.descendant(of: first, matching: find.text(CardsCopy.missedLately)));
      final plainWord = tester.widget<Text>(find.descendant(of: first, matching: find.text(CardsCopy.inRevise)));
      expect(missed.style!.color, isNot(plainWord.style!.color));
    });

    testWidgets('an empty filter says so, with no key and no list', (tester) async {
      await pumpView(tester, FixtureLearnApi(), filter: 'revise');
      final empty = CardsCopy.empty['revise']!;
      expect(find.text(empty.title), findsOneWidget);
      expect(find.text(empty.line), findsOneWidget);
      expect(voltKeys(tester), 0);
      expect(_rows, findsNothing);
      expect(find.byKey(const ValueKey('cards-jump')), findsNothing);
    });
  });

  group('a row', () {
    testWidgets('folds NCERT\'s line behind Show, and Show turns to Hide', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      final entry = proGroups.first.cards.first;
      final row = find.byKey(ValueKey('card-row-${entry.id}'));
      final words = entry.card.back.substring(0, 20);
      expect(find.descendant(of: row, matching: find.textContaining(words, findRichText: true)), findsNothing);
      await tapAt(tester, find.byKey(ValueKey('card-show-${entry.id}')));
      expect(find.descendant(of: row, matching: find.textContaining(words, findRichText: true)), findsWidgets);
      expect(find.descendant(of: row, matching: find.text(CardsCopy.hide)), findsOneWidget);
    });

    testWidgets('opens in place to the full words, the source and its actions, and one is open at a time', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      final a = proGroups[0].cards[0];
      final b = proGroups[1].cards[0];
      expect(find.byKey(ValueKey('card-study-${a.id}')), findsNothing);
      await tapAt(tester, find.byKey(ValueKey('card-hit-${a.id}')));
      expect(find.byKey(ValueKey('card-study-${a.id}')), findsOneWidget);
      expect(find.byKey(ValueKey('card-report-${a.id}')), findsOneWidget);
      expect(find.text(a.card.source.reference!), findsOneWidget);
      await tapKey(tester, ValueKey('card-hit-${b.id}'));
      expect(find.byKey(ValueKey('card-study-${a.id}')), findsNothing);
      expect(find.byKey(ValueKey('card-study-${b.id}')), findsOneWidget);
      // A second tap on the front folds it again.
      await tapKey(tester, ValueKey('card-hit-${b.id}'));
      expect(find.byKey(ValueKey('card-study-${b.id}')), findsNothing);
    });

    testWidgets('Study this card plays that one card, and Report opens the reasons', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      final a = proGroups[0].cards[0];
      await tapAt(tester, find.byKey(ValueKey('card-hit-${a.id}')));
      await tapAt(tester, find.byKey(ValueKey('card-report-${a.id}')));
      expect(find.text(KeyCardsCopy.reportTitle), findsOneWidget);
      await tester.tapAt(const Offset(180, 40));
      await settleCards(tester);
      await tapAt(tester, find.byKey(ValueKey('card-study-${a.id}')));
      final uri = lastVisit();
      expect(uri.queryParameters['kind'], 'cards');
      expect(uri.queryParameters['chapter'], cardsChapter);
      expect(cardsOf(uri), [a.id]);
    });

    testWidgets('Show answers puts the line under every row and takes the Show keys away', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      final entry = proGroups.first.cards.first;
      expect(find.byKey(ValueKey('card-show-${entry.id}')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('cards-show-answers')));
      await settleCards(tester);
      expect(find.byKey(ValueKey('card-show-${entry.id}')), findsNothing);
      expect(find.descendant(of: find.byKey(ValueKey('card-row-${entry.id}')), matching: find.textContaining(entry.card.back.substring(0, 20), findRichText: true)), findsWidgets);
    });

    testWidgets('draws a blank as a gap that stays in one piece', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      final blank = proGroups.expand((g) => g.cards).firstWhere((e) => e.card.front.contains('____'));
      final row = find.byKey(ValueKey('card-row-${blank.id}'));
      await tester.ensureVisible(row);
      await tester.pump();
      expect(find.descendant(of: row, matching: find.textContaining('____', findRichText: true)), findsNothing);
      final front = tester.widgetList<Text>(find.descendant(of: row, matching: find.byType(Text))).where((t) => _gaps(t.textSpan) > 0);
      expect(front, hasLength(1));
      expect(_gaps(front.single.textSpan), blank.card.front.split(RegExp(r'_{3,}')).length - 1, reason: 'one gap box for each ____');
    });
  });

  group('Pick', () {
    testWidgets('shows a box on every row, and the bar plays exactly what is picked in the order it was picked', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
      final first = proGroups[0].cards[0].id;
      final second = proGroups[1].cards[0].id;
      await tapAt(tester, find.byKey(ValueKey('card-pick-$second')));
      await tapAt(tester, find.byKey(ValueKey('card-pick-$first')));
      expect(find.text('2 picked'), findsOneWidget);
      // The page's key steps back to an outline: one volt key, the bar's.
      expect(voltKeys(tester), 1);
      await tester.tap(find.byKey(const ValueKey('cards-pick-study')));
      await settleCards(tester);
      final uri = lastVisit();
      expect(cardsOf(uri), [second, first]);
      expect(uri.queryParameters['chapter'], cardsChapter);
      expect(uri.queryParameters['kind'], 'cards');
    });

    testWidgets('Clear takes the picks and the bar away, Done leaves the mode, and a filter change stops picking', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
      final first = proGroups[0].cards[0].id;
      await tapAt(tester, find.byKey(ValueKey('card-pick-$first')));
      await tester.tap(find.byKey(const ValueKey('cards-pick-clear')));
      await settleCards(tester);
      expect(find.byKey(const ValueKey('cards-pick-bar')), findsNothing);
      expect(find.byKey(ValueKey('card-pick-$first')), findsOneWidget);
      await tapAt(tester, find.byKey(ValueKey('card-pick-$first')));
      expect(find.text('1 picked'), findsOneWidget);
      await tapAt(tester, find.byKey(const ValueKey('cards-filter-must')));
      expect(find.byKey(const ValueKey('cards-pick-bar')), findsNothing);
      expect(find.text(CardsCopy.pick), findsOneWidget);
    });
  });

  group('the pick bar', () {
    testWidgets('stays with its page: a run opened over it covers it, and it is back with the page', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
      await tapAt(tester, find.byKey(ValueKey('card-pick-${proGroups[0].cards[0].id}')));
      expect(find.byKey(const ValueKey('cards-pick-bar')).hitTestable(), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('cards-pick-study')));
      await settleCards(tester);
      expect(find.text('landed on a run'), findsOneWidget);
      expect(find.byKey(const ValueKey('cards-pick-bar')).hitTestable(), findsNothing, reason: 'the run is over the page, bar and all');
      await tapAt(tester, find.text('back from landing'));
      expect(find.byKey(const ValueKey('cards-pick-bar')).hitTestable(), findsOneWidget);
      expect(find.text('1 picked'), findsOneWidget, reason: 'what was picked is still picked');
    });
  });

  group('the sections', () {
    testWidgets('are listed with their counts, and the chosen one comes to the top', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-jump')));
      for (final g in proGroups) {
        expect(find.byKey(ValueKey('cards-jump-${g.id}')), findsOneWidget, reason: g.title);
      }
      final target = proGroups.firstWhere((g) => g.title.startsWith('2.7 '));
      await tapAt(tester, find.byKey(ValueKey('cards-jump-${target.id}')));
      await tester.pump(const Duration(milliseconds: 500));
      final top = tester.getTopLeft(find.byKey(ValueKey('cards-section-${target.id}'))).dy;
      expect(top, inInclusiveRange(-1, 4), reason: 'the section\'s bar sits at the top of the list');
      // ... and its first card is under it.
      expect(find.byKey(ValueKey('card-row-${target.cards.first.id}')), findsOneWidget);
    });

    testWidgets('keep one bar pinned for the section in view', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -1400));
      await settleCards(tester);
      final bars = proGroups.where((g) {
        final f = find.byKey(ValueKey('cards-section-${g.id}'));
        if (f.evaluate().isEmpty) return false;
        final box = tester.renderObject<RenderBox>(f);
        if (!box.attached) return false;
        final top = tester.getTopLeft(f).dy;
        return top >= -1 && top <= 4;
      }).toList();
      expect(bars, hasLength(1), reason: 'one bar rides at the top while its section scrolls under it');
    });

    testWidgets('are not offered for a chapter with one section', (tester) async {
      final api = _CardsApi(
        change: (body, filter) {
          body['sections'] = [(body['sections'] as List).first];
        },
      );
      await pumpView(tester, api);
      expect(find.byKey(const ValueKey('cards-jump')), findsNothing);
    });
  });

  group('Free', () {
    testWidgets('shows the open cards whole and the one locked line with the server\'s own words', (tester) async {
      await pumpView(tester, FixtureLearnApi(pro: false), nudges: true);
      expect(find.text('Accountancy, Ch 2, 5 of 53 cards open on Free'), findsOneWidget);
      expect(freeIds, hasLength(5));
      expect(find.text('Study these 5'), findsOneWidget);
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
      await settleCards(tester);
      expect(find.text(free.lockedLine!), findsOneWidget);
      expect(find.byKey(const ValueKey('cards-see-pro')), findsOneWidget);
      expect(free.lockedLine, startsWith('48 more cards'));
      // One lock for the one line.
      expect(find.byIcon(LucideIcons.lock), findsOneWidget);
    });

    testWidgets('has no See Pro key where Pro nudges are off, but the line stays', (tester) async {
      await pumpView(tester, FixtureLearnApi(pro: false));
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
      await settleCards(tester);
      expect(find.text(free.lockedLine!), findsOneWidget);
      expect(find.byKey(const ValueKey('cards-see-pro')), findsNothing);
    });

    testWidgets('plays only the open cards', (tester) async {
      await pumpView(tester, FixtureLearnApi(pro: false));
      await tapAt(tester, find.text('Study these 5'));
      expect(cardsOf(lastVisit()), freeIds);
    });
  });

  group('the states', () {
    testWidgets('loading draws the page at its final shape, with no numbers and no key', (tester) async {
      final api = HoldCardsApi();
      await pumpCards(tester, const CardsViewScreen(chapterKey: cardsChapter), overrides: cardsOverrides(api));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(CardsCopy.title), findsOneWidget);
      expect(find.text(CardsCopy.backFallback), findsOneWidget);
      expect(find.bySemanticsLabel(CardsCopy.loading), findsWidgets);
      expect(voltKeys(tester), 0);
      expect(find.byKey(const ValueKey('cards-filter-all')), findsNothing);
      api.gate.complete();
      await settleCards(tester);
      expect(find.text('Study these 53'), findsOneWidget);
    });

    testWidgets('a failed read says so and offers Try again, never a number', (tester) async {
      final api = FixtureLearnApi(failOn: {'chapterCards': FixtureLearnApi.offlineError});
      await pumpView(tester, api);
      expect(find.text(CardsCopy.loadFailedTitle), findsOneWidget);
      expect(find.text(CardsCopy.loadFailedLine), findsOneWidget);
      expect(find.textContaining('53 cards'), findsNothing);
      expect(voltKeys(tester), 0);
      api.failOn.clear();
      await tester.tap(find.byKey(const ValueKey('cards-retry')));
      await settleCards(tester);
      expect(find.text('Study these 53'), findsOneWidget);
      expect(find.text(CardsCopy.loadFailedTitle), findsNothing);
    });

    testWidgets('a filter that fails to read says so, and the chips are not drawn on a stale page', (tester) async {
      final api = FixtureLearnApi();
      await pumpView(tester, api);
      api.failOn['chapterCards'] = FixtureLearnApi.offlineError;
      await tapAt(tester, find.byKey(const ValueKey('cards-filter-must')));
      expect(find.text(CardsCopy.loadFailedTitle), findsOneWidget);
    });

    testWidgets('Back goes to the chapter page when there is nothing to go back to', (tester) async {
      await pumpView(tester, FixtureLearnApi());
      await tapAt(tester, find.byKey(const ValueKey('cards-back')));
      expect(lastVisit().path, '/learn/c/$cardsChapter');
    });

    testWidgets('a new filter keeps the last cards on screen until the next arrive', (tester) async {
      final api = FixtureLearnApi();
      await pumpView(tester, api);
      api.slow = const Duration(milliseconds: 500);
      await tester.tap(find.byKey(const ValueKey('cards-filter-must')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byKey(ValueKey('card-row-${proIds.first}')), findsOneWidget, reason: 'the old rows stay while the new are read');
      await tester.pump(const Duration(milliseconds: 600));
      await settleCards(tester);
      expect(find.text('Study these 14'), findsOneWidget);
    });
  });

  group('large text and targets', () {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';

      testWidgets('text 1.3 times larger at 360 dp draws without overflow, $tag', (tester) async {
        await pumpView(tester, FixtureLearnApi(), brightness: brightness, textScale: 1.3);
        expect(tester.takeException(), isNull);
        await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
        await tapAt(tester, find.byKey(ValueKey('card-pick-${proGroups[0].cards[0].id}')));
        await tapAt(tester, find.byKey(ValueKey('card-hit-${proGroups[1].cards[0].id}')));
        expect(tester.takeException(), isNull);
        expect(find.text('1 picked'), findsOneWidget);
      });

      testWidgets('every target is 48 dp and named, and the text reads, $tag', (tester) async {
        await pumpView(tester, FixtureLearnApi(), brightness: brightness);
        final handle = tester.ensureSemantics();
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });

      testWidgets('a row open, with the pick bar up, meets the guidelines, $tag', (tester) async {
        await pumpView(tester, FixtureLearnApi(pro: false), brightness: brightness, nudges: true);
        await tapAt(tester, find.byKey(const ValueKey('cards-pick')));
        await tapAt(tester, find.byKey(ValueKey('card-pick-${freeIds.first}')));
        await tapAt(tester, find.byKey(ValueKey('card-hit-${freeIds[1]}')));
        final handle = tester.ensureSemantics();
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        handle.dispose();
      });
    }
  });
}
