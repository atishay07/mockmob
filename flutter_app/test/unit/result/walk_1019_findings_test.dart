// The 19 Oct fresh-account walk's A3 findings (tmp/walk-1019/BASELINE-FINDINGS.md, items 28 to 36), each locked here:
// 28 the result's pinned foot carries its cost on one line; 30 one credits word on the result; 31 a chapter title breaks
// only between words; 33 an empty repair record's key goes where there is something to do; 36 the runner says what
// "On this phone" means. (29 is in practice/result_screen_test.dart, 35 in runner/runner_alive_test.dart.)
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/app_shell.dart' show tabReselectProvider;
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/key_button.dart' show KeyButton;
import 'package:mockmob/features/result/layers_copy.dart';
import 'package:mockmob/features/result/model/next_move.dart' show practiceCostLine, repairCostLine;
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/screens/record_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/review/widgets/chapter_hero.dart' show WholeWordTitle;
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/save_glyph.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../review/support/review_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  group('28: the pinned foot says the cost on one line', () {
    test('a repair: the cost and the balance, the promise left to the panel', () {
      expect(LayersCopy.footNote(repairCostLine(40)), '1 credit. You have 40.');
      expect(LayersCopy.footNote(repairCostLine(null)), '1 credit.');
      expect(LayersCopy.footNote(repairCostLine(40))!.contains('\n'), isFalse);
      // The promise itself is unchanged where the row shows it inline.
      expect(repairCostLine(40), '1 credit. You have 40. ${LayersCopy.repairNoCharge}');
    });

    test('other moves keep their line as it is', () {
      expect(LayersCopy.footNote('No extra credit.'), 'No extra credit.');
      expect(LayersCopy.footNote(null), isNull);
    });
  });

  test('30: one credits balance on the result: a set costs "credits", never "practice credits"', () {
    expect(practiceCostLine(practiceCredits: 40), 'This set uses 10 credits. You have 40.');
    expect(practiceCostLine(practiceCredits: 40).contains('practice credits'), isFalse);
    expect(ReviewCopy.retryShort.contains('practice credits'), isFalse);
  });

  group('31: a chapter title breaks only between words', () {
    Future<RenderParagraph> draw(WidgetTester tester, String text, double width) async {
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => Align(
            alignment: Alignment.topLeft,
            child: SizedBox(width: width, child: WholeWordTitle(text: text, style: context.mmType.title.copyWith(fontSize: 24, height: 27 / 24))),
          ),
        ),
        size: const Size(360, 400),
      );
      return tester.renderObject<RenderParagraph>(find.text(text));
    }

    testWidgets('"Partnership Fundamentals" in the 150 dp beside the art: the size steps down and no line ends inside a word', (tester) async {
      final render = await draw(tester, 'Partnership Fundamentals', 150);
      final size = tester.widget<Text>(find.text('Partnership Fundamentals')).style!.fontSize!;
      expect(size, lessThan(24));
      // Each word's letters sit on one line: neither word is split across two (a whole word may move down a line).
      Set<double> tops(int from, int to) => {for (final b in render.getBoxesForSelection(TextSelection(baseOffset: from, extentOffset: to))) b.top};
      expect(tops(0, 11), hasLength(1), reason: '"Partnership" on one line');
      expect(tops(12, 24), hasLength(1), reason: '"Fundamentals" on one line');
    });

    testWidgets('a title whose words already fit keeps its size', (tester) async {
      await draw(tester, 'Goodwill', 150);
      expect(tester.widget<Text>(find.text('Goodwill')).style!.fontSize, 24);
    });
  });

  group('33: an empty repair record never sends the student to an empty page', () {
    Future<void> pump(WidgetTester tester, {required bool withMistakes}) => pumpMockmob(
      tester,
      const RecordScreen(),
      size: const Size(384, 900),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(attempts: withMistakes ? [quick] : const []),
    );

    testWidgets('no paper yet: the key starts 10 questions', (tester) async {
      await pump(tester, withMistakes: false);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(ReviewCopy.recordEmptyTitle), findsOneWidget);
      expect(find.widgetWithText(KeyButton, ReviewCopy.emptyAction), findsOneWidget);
      expect(find.widgetWithText(KeyButton, ReviewCopy.recordEmptyAction), findsNothing);
    });

    testWidgets('mistakes waiting and none repaired: the key opens them', (tester) async {
      await pump(tester, withMistakes: true);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(ReviewCopy.recordEmptyTitle), findsOneWidget);
      expect(find.widgetWithText(KeyButton, ReviewCopy.recordEmptyAction), findsOneWidget);
    });
  });

  group('36: the runner says what "On this phone" means', () {
    testWidgets('a practice set: "Saved on this phone", and TalkBack hears that it goes to the account at submit', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, const Center(child: SaveGlyph(snapshot: SaveSnapshot(state: SaveState.onThisPhone))), size: const Size(360, 200));
      expect(find.text(RunnerCopy.savedOnThisPhone), findsOneWidget);
      expect(find.text('On this phone'), findsNothing);
      expect(find.bySemanticsLabel(RunnerCopy.savedOnThisPhoneSpoken), findsOneWidget);
      expect(RunnerCopy.savedOnThisPhoneSpoken, 'Your answers are saved on this phone. They go to your account when you submit.');
      handle.dispose();
    });
  });

  group('Your papers header at 360 dp (19 Oct device walk: "Your pap...")', () {
    testWidgets('the title is whole and clear of the labelled Ask Mobi pill', (tester) async {
      await pumpMockmob(
        tester,
        const ReviewScreen(),
        size: const Size(360, 800),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: reviewOverrides(attempts: [quick]),
      );
      await tester.pump(const Duration(milliseconds: 600));
      final title = find.text(ReviewCopy.title);
      expect(title, findsOneWidget);
      expect(tester.renderObject<RenderParagraph>(title).didExceedMaxLines, isFalse);
      expect(find.text(ReviewCopy.askKey), findsOneWidget);
      expect(tester.getRect(title).right, lessThanOrEqualTo(tester.getRect(find.text(ReviewCopy.askKey)).left));
    });

    test('"The most marks slip in" keeps "slip in" together, so "in" never sits alone', () {
      expect(ReviewCopy.loseMost, 'The most marks slip in');
    });
  });

  group('a second tap on the tab scrolls Your papers to the top only when it is the page on screen (D105)', () {
    Future<void> pump(WidgetTester tester, {required bool live}) => pumpMockmob(
      tester,
      TickerMode(enabled: live, child: const ReviewScreen()),
      size: const Size(360, 800),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(attempts: [mock7, quick, mock6]),
    );

    double offset(WidgetTester tester) => tester.state<ScrollableState>(find.byType(Scrollable).first).position.pixels;

    Future<void> scrollDownThenReselect(WidgetTester tester, int tab) async {
      await tester.pump(const Duration(milliseconds: 600));
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -600));
      await tester.pumpAndSettle();
      expect(offset(tester), greaterThan(100));
      ProviderScope.containerOf(tester.element(find.byType(ReviewScreen))).read(tabReselectProvider.notifier).reselected(tab);
      await tester.pumpAndSettle();
    }

    testWidgets('on screen: any re-tap of its own tab (Practice under D105, or Review on the old bar) brings it to the top', (tester) async {
      await pump(tester, live: true);
      await scrollDownThenReselect(tester, 1);
      expect(offset(tester), 0);
    });

    testWidgets('its branch offstage (a re-tap of the Mob tab): it stays where the student left it', (tester) async {
      await pump(tester, live: false);
      await scrollDownThenReselect(tester, 2);
      expect(offset(tester), greaterThan(100));
    });
  });
}
