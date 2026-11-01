// Find's results and the chapter's Cards view at 360 x 800, Night and Day (APP-1101 section 7): Find with a Pro and a Free
// student, with Show answers on, in pick mode with the bar up, with nothing matched; the Cards view for every card, for
// Must-know, with a row open, for Free, with an empty filter and while loading. The whole screen is captured, so the pick
// bar (drawn on the screen's overlay) is in the picture. Find is drawn in a plain page, in the gutter of a column that
// scrolls, as Learn home holds it; Learn home's own Find goldens belong to the home packet.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/cards/cards_view.dart';

import '../../../helpers/fonts.dart';
import '../../../helpers/golden_harness.dart';
import '../../../unit/learn2/cards/cards_support.dart';
import '../../../unit/learn2/support/fixture_learn_api.dart';

/// Runs the frame once per theme as `goldens/cards_<name>_<night|day>.png`.
void _golden(
  String name, {
  required Widget Function(ValueNotifier<String> query) build,
  required List<Override> Function() overrides,
  Size size = const Size(360, 800),
  double textScale = 1,
  Future<void> Function(WidgetTester tester, ValueNotifier<String> query)? after,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final query = ValueNotifier<String>('');
      addTearDown(query.dispose);
      await pumpMockmob(
        tester,
        build(query),
        brightness: brightness,
        size: size,
        textScale: textScale,
        disableAnimations: true,
        overrides: overrides(),
        wrapInScaffold: false,
      );
      await settleCards(tester);
      if (after != null) await after(tester, query);
      await settleImages(tester);
      await tester.pump(const Duration(milliseconds: 400));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/cards_${name}_$tag.png'));
    });
  }
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f.first);
  await tester.pump();
  await tester.tap(f.first);
  await settleCards(tester);
}

/// The page scrolled so [f] sits near the top, as a student would leave it.
Future<void> _scrollTo(WidgetTester tester, Finder f, {double alignment = 0.04}) async {
  await Scrollable.ensureVisible(tester.element(f.first), alignment: alignment);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

Widget _find(ValueNotifier<String> q) => FindPage(query: q);

Widget _cards({String? filter}) => CardsViewScreen(chapterKey: cardsChapter, filter: filter);

void main() {
  setUpAll(loadAppFonts);

  // ---------------------------------------------------------------------------------------------------------- Find

  _golden(
    'find_results_pro',
    build: _find,
    overrides: () => cardsOverrides(FixtureLearnApi()),
    after: (tester, q) => typeQuery(tester, q, 'goodwill'),
  );
  _golden(
    'find_results_free',
    build: _find,
    overrides: () => cardsOverrides(FixtureLearnApi(pro: false), nudges: true),
    after: (tester, q) async {
      await typeQuery(tester, q, 'goodwill');
      await _scrollTo(tester, find.textContaining('40 more cards match'), alignment: 0.7);
    },
  );
  _golden(
    'find_show_answers',
    build: _find,
    overrides: () => cardsOverrides(FixtureLearnApi()),
    after: (tester, q) async {
      await typeQuery(tester, q, 'goodwill');
      await tester.tap(find.byKey(const ValueKey('cards-show-answers')));
      await settleCards(tester);
    },
  );
  _golden(
    'find_pick',
    build: _find,
    overrides: () => cardsOverrides(FixtureLearnApi()),
    after: (tester, q) async {
      await typeQuery(tester, q, 'goodwill');
      await tester.tap(find.byKey(const ValueKey('cards-pick')));
      await settleCards(tester);
      final boxes = [
        for (final w in tester.widgetList<Widget>(find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('card-pick-'))))
          w.key! as ValueKey<String>,
      ];
      await tester.tap(find.byKey(boxes[1]));
      await settleCards(tester);
      await tester.tap(find.byKey(boxes[2]));
      await settleCards(tester);
    },
  );
  _golden(
    'find_no_results',
    build: _find,
    overrides: () => cardsOverrides(FixtureLearnApi()),
    after: (tester, q) => typeQuery(tester, q, 'xyz'),
  );

  // ----------------------------------------------------------------------------------------------------- Cards view

  _golden('view_all', build: (_) => _cards(), overrides: () => cardsOverrides(FixtureLearnApi()));
  _golden('view_must', build: (_) => _cards(filter: 'must'), overrides: () => cardsOverrides(FixtureLearnApi()));
  _golden(
    'view_row_open',
    build: (_) => _cards(),
    overrides: () => cardsOverrides(FixtureLearnApi()),
    after: (tester, q) async {
      final keys = [
        for (final w in tester.widgetList<Widget>(find.byWidgetPredicate((w) => w.key is ValueKey<String> && (w.key! as ValueKey<String>).value.startsWith('card-hit-'))))
          w.key! as ValueKey<String>,
      ];
      await _tap(tester, find.byKey(keys[1]));
      // The open row's section bar rides at the top, the row under it.
      await _scrollTo(tester, find.byKey(const ValueKey('cards-section-sec-1')), alignment: 0);
    },
  );
  _golden(
    'view_free',
    build: (_) => _cards(),
    overrides: () => cardsOverrides(FixtureLearnApi(pro: false), nudges: true),
    after: (tester, q) async {
      // To the foot of the list, where Free's one locked line closes it.
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
      await settleCards(tester);
    },
  );
  _golden('view_empty_filter', build: (_) => _cards(filter: 'revise'), overrides: () => cardsOverrides(FixtureLearnApi()));
  _golden('view_loading', build: (_) => _cards(), overrides: () => cardsOverrides(HoldCardsApi()));
}
