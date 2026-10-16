import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiAct, MobiMood;
import 'package:mockmob/core/models/models.dart' show AttemptDetail;
import 'package:mockmob/core/widgets/widgets.dart' show BubbleGrid, BubbleState, Mobi, MobiPose;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/full/answer_row.dart' show AnswerRow;
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/result/model/recap_variant.dart';
import 'package:mockmob/features/result/recap/recap_flow.dart' show RecapPlaceholder;
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

String _at(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

Future<void> _run(WidgetTester tester, int ms) async {
  await tester.pump();
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

RecapData _ready(RecapModel m, AttemptDetail d) => RecapData(model: m, attempt: d.attempt, detail: d);

/// The alive result (15 Oct): the one reaction table's face, the loading Mobi's manners, the
/// repair key on the full result and the 48 dp targets of the story bar.
void main() {
  setUpAll(loadAppFonts);

  group('the face under the act', () {
    RecapReaction? at(RecapVariant v, {int hour = 14}) =>
        recapReaction(variant: v, mode: CelebrationMode.full, isNta: false, hour: hour);

    test('proud with the milestone, happy with the cheer, soft after a lower result, calm otherwise', () {
      expect(recapMood(RecapVariant.firstMock, at(RecapVariant.firstMock)), MobiMood.proud);
      expect(recapMood(RecapVariant.higher, at(RecapVariant.higher)), MobiMood.happy);
      expect(recapMood(RecapVariant.lower, at(RecapVariant.lower)), MobiMood.concerned);
      expect(recapMood(RecapVariant.held, at(RecapVariant.held)), MobiMood.calm, reason: 'a held key is not a setback');
      expect(recapMood(RecapVariant.standard, at(RecapVariant.standard)), MobiMood.calm);
    });

    test('sleepy late at night, whatever the result, and nothing at all with no reaction', () {
      for (final v in RecapVariant.values) {
        expect(recapMood(v, at(v, hour: 2)), MobiMood.sleepy, reason: '$v at 2 AM');
        expect(recapMood(v, null), MobiMood.calm);
      }
    });

    test('the act of every variant is the one the face was built for', () {
      expect(at(RecapVariant.firstMock)?.act, MobiAct.proud);
      expect(at(RecapVariant.higher)?.act, MobiAct.cheer);
      expect(at(RecapVariant.lower)?.act, MobiAct.encourage);
    });
  });

  group('loading Mobi', () {
    Future<void> pumpSealed(WidgetTester tester, RecapData data, {Size size = const Size(384, 853)}) async {
      await pumpResultRoute(tester, location: '/result/a7/sealed', size: size, overrides: resultOverrides(attemptId: 'a7', data: data));
      await tester.pump(const Duration(milliseconds: 400));
    }

    testWidgets('waits below the skeleton at 60%, in its loading pose, once the paper is known not to be NTA', (tester) async {
      final d = detail();
      await pumpSealed(tester, RecapData(attempt: d.attempt, loading: true));
      expect(find.byType(Mobi), findsOneWidget);
      expect(tester.widget<Mobi>(find.byType(Mobi)).pose, MobiPose.loading);
      final fade = tester.widget<Opacity>(find.ancestor(of: find.byType(Mobi), matching: find.byType(Opacity)).first);
      expect(fade.opacity, 0.6);
    });

    testWidgets('an NTA paper, and a paper whose mode is not known yet, get no Mobi while loading', (tester) async {
      final nta = detail(attemptBody: attemptJson(mode: 'nta'));
      await pumpSealed(tester, RecapData(attempt: nta.attempt, loading: true));
      expect(find.byType(Mobi), findsNothing, reason: 'NTA results are exam-faithful');
      await pumpSealed(tester, const RecapData(loading: true));
      expect(find.byType(Mobi), findsNothing, reason: 'the mode is not known until the attempt is');
    });

    testWidgets('is left out on a screen too short to hold it under the skeleton, and nothing overflows', (tester) async {
      final d = detail();
      await pumpSealed(tester, RecapData(attempt: d.attempt, loading: true), size: const Size(360, 560));
      expect(tester.takeException(), isNull);
      expect(find.byType(Mobi), findsNothing);
    });

    testWidgets('the slow state thinks quietly in the state view, and the way on is there', (tester) async {
      final d = detail();
      await pumpSealed(tester, RecapData(attempt: d.attempt, loading: true));
      await tester.pump(RecapPlaceholder.slowAfter);
      await tester.pump(const Duration(milliseconds: 700));
      expect(find.byType(Mobi), findsOneWidget);
      expect(tester.widget<Mobi>(find.byType(Mobi)).pose, MobiPose.think);
    });
  });

  group('the repair key on the full result says what opens', () {
    testWidgets('the count on the key, the chapter and the minutes under it, and the link opens that run', (tester) async {
      final d = detail();
      final router = await pumpResultRoute(
        tester,
        location: '/result/a7',
        overrides: resultOverrides(attemptId: 'a7', data: _ready(mock7(withDetail: d), d)),
      );
      await _run(tester, 400);
      await tester.scrollUntilVisible(find.text('Repair 4 mistakes'), 300);
      expect(find.text('Repair 4 mistakes'), findsOneWidget);
      expect(find.text('Admission of a partner, about 15 minutes. The other 11 are in Review.'), findsOneWidget);
      expect(find.bySemanticsLabel('Repair 4 mistakes. Admission of a partner, about 15 minutes. The other 11 are in Review.'), findsOneWidget);
      await tester.tap(find.text('Repair 4 mistakes'));
      await tester.pumpAndSettle();
      expect(_at(router), startsWith('/review/repair/a7/'));
      expect(_at(router), contains('count=4'));
    });

    testWidgets('a shorter length on the last card opens fewer, and the line under it counts what is left for Review', (tester) async {
      final d = detail();
      await pumpResultRoute(
        tester,
        location: '/result/a7/recap/4',
        overrides: resultOverrides(attemptId: 'a7', data: _ready(mock7(withDetail: d), d), ritual: const RecapRitual(sheetsOpened: 1)),
      );
      await _run(tester, 1000);
      await tester.tap(find.text('5 min'));
      await _run(tester, 600);
      expect(find.text('Repair 2 mistakes'), findsOneWidget);
      expect(
        find.text('Admission of a partner, 2 of its 4 wrong answers.\nAbout 5 minutes. The other 13 are in Review.'),
        findsOneWidget,
        reason: 'the two in the run leave thirteen of the fifteen in Review, the chapter\'s other two among them',
      );
    });
  });

  group('the story bar', () {
    testWidgets('every segment is a 48 dp target in both directions on a 360 dp phone', (tester) async {
      final d = detail();
      await pumpResultRoute(
        tester,
        location: '/result/a7/recap/2',
        size: const Size(360, 780),
        overrides: resultOverrides(attemptId: 'a7', data: _ready(mock7(withDetail: d), d), ritual: const RecapRitual(sheetsOpened: 1)),
      );
      await _run(tester, 1000);
      for (var i = 1; i <= 4; i++) {
        final seg = find.bySemanticsLabel(RegExp('^Card $i of 4'));
        expect(seg, findsOneWidget);
        final size = tester.getSize(seg);
        expect(size.height, greaterThanOrEqualTo(48), reason: 'card $i target height');
        expect(size.width, greaterThanOrEqualTo(48), reason: 'card $i target width');
      }
      expect(find.bySemanticsLabel('Skip to full result'), findsOneWidget, reason: 'the short key still says where it goes');
    });
  });

  group('the answer map', () {
    Offset bubbleAt(WidgetTester tester, int number) {
      final grid = find.byType(BubbleGrid);
      final tl = tester.getTopLeft(grid);
      final w = tester.getSize(grid).width;
      const b = 20.0, numberSpace = 16.0, rowGap = 10.0;
      final i = number - 1;
      final x = (i % 10) * (w - b) / 9 + b / 2;
      final y = (i ~/ 10) * (b + numberSpace + rowGap) + numberSpace + b / 2;
      return tl + Offset(x, y);
    }

    testWidgets('a bubble of a blank answer opens the folded group and that row, with nothing thrown', (tester) async {
      final d = detail();
      await pumpResultRoute(
        tester,
        location: '/result/a7',
        overrides: resultOverrides(attemptId: 'a7', data: _ready(mock7(withDetail: d), d)),
      );
      await _run(tester, 1200);
      final blank = mock7().cells.indexOf(BubbleState.blank) + 1;
      await tester.tapAt(bubbleAt(tester, blank));
      await _run(tester, 1200);
      expect(tester.takeException(), isNull);
      final row = tester.widget<AnswerRow>(find.byWidgetPredicate((w) => w is AnswerRow && w.item.number == blank, skipOffstage: false));
      expect(row.expanded, isTrue);
    });

    testWidgets('late at night the reader Mobi stands sleepy', (tester) async {
      final d = detail();
      await pumpResultRoute(
        tester,
        location: '/result/a7',
        hour: 2,
        overrides: resultOverrides(attemptId: 'a7', data: _ready(mock7(withDetail: d), d)),
      );
      await _run(tester, 600);
      expect(tester.widget<Mobi>(find.byType(Mobi)).pose, MobiPose.sleepy);
    });
  });

  group('the finish screen late at night', () {
    testWidgets('Mobi is sleepy and says Goodnight beside it, then Today takes over', (tester) async {
      final d = detail();
      final router = await pumpResultRoute(
        tester,
        location: '/result/a7/recap/4',
        hour: 2,
        overrides: resultOverrides(attemptId: 'a7', data: _ready(mock7(withDetail: d), d), ritual: const RecapRitual(sheetsOpened: 1)),
      );
      await _run(tester, 1000);
      await tester.tap(find.text('Choose something else'));
      await _run(tester, 700);
      await tester.tap(find.text('Finish for now'));
      await _run(tester, 400);
      expect(find.text('Goodnight'), findsOneWidget);
      expect(find.byType(Mobi), findsOneWidget);
      expect(tester.widget<Mobi>(find.byType(Mobi)).pose, MobiPose.sleepy);
      await _run(tester, 4200);
      await tester.pumpAndSettle();
      expect(_at(router), '/today');
    });
  });
}
