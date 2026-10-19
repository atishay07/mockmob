import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

Future<void> _run(WidgetTester tester, int ms) async {
  await tester.pump();
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// Design critic packet D (16 Oct): the last recap card, the result bar, the Sankey axis and the
/// open sheet.
void main() {
  setUpAll(loadAppFonts);

  Future<GoRouter> open(
    WidgetTester tester,
    String location,
    RecapModel m,
    AttemptDetail d, {
    Size size = const Size(384, 853),
    double textScale = 1,
  }) async {
    final router = await pumpResultRoute(
      tester,
      location: location,
      size: size,
      textScale: textScale,
      overrides: resultOverrides(attemptId: m.attemptId, data: RecapData(model: m, attempt: d.attempt, detail: d), ritual: const RecapRitual(sheetsOpened: 1)),
    );
    await _run(tester, 1500);
    return router;
  }

  group('card 4 says what it counts', () {
    testWidgets('the key is short and the chapter is the line above it, with its denominator', (tester) async {
      await open(tester, '/result/a7/recap/4', mock7(), detail());
      final key = tester.getRect(find.text('Repair 3 mistakes'));
      final line = find.text('Admission of a partner, 3 of its 4 wrong answers.\nAbout 10 minutes. The other 12 are in Your papers.');
      expect(line, findsOneWidget);
      expect(tester.getRect(line).bottom, lessThanOrEqualTo(key.top), reason: 'the chapter line sits above the key, never under or over it');
      expect(find.textContaining('The repair starts with'), findsNothing, reason: 'the chapter is said once, above the key');
    });

    testWidgets('a wrong answer already repaired: the count reads "N of M" and names the rest', (tester) async {
      final base = mock7();
      final repaired = {base.candidates.first.questionId};
      final m = mock7(repaired: repaired);
      expect(m.candidates.length, base.candidates.length - 1);
      await open(tester, '/result/a7/recap/4', m, detail());
      expect(find.text('14 of 15 wrong answers ready to repair.'), findsOneWidget);
      expect(find.text('The other one is repaired already, or its answer key is being checked.'), findsOneWidget);
    });

    testWidgets('the status block sits in the middle of the free height, not above a hole at the key', (tester) async {
      await open(tester, '/result/a7/recap/4', mock7(), detail());
      final head = tester.getRect(find.text(ResultCopy.inRecord('Mock 7')));
      final last = tester.getRect(find.text(ResultCopy.shareSheet));
      final line = tester.getRect(find.textContaining('Admission of a partner, 3 of its'));
      final above = head.top - 56;
      final below = line.top - last.bottom;
      expect((above - below).abs(), lessThan(56), reason: 'centred: $above above, $below below');
    });

    testWidgets('Share your sheet is one 48 dp chip, and a screen reader still hears that no marks are on it', (tester) async {
      await open(tester, '/result/a7/recap/4', mock7(), detail());
      final chip = find.ancestor(of: find.text(ResultCopy.shareSheet), matching: find.byType(DecoratedBox)).first;
      expect(tester.getSize(chip).height, greaterThanOrEqualTo(48));
      expect(find.text(ResultCopy.shareSheetHint), findsNothing, reason: 'no second line of fine print under the chip');
      expect(find.bySemanticsLabel('${ResultCopy.shareSheet}. ${ResultCopy.shareSheetHint}'), findsOneWidget);
    });

    testWidgets('no overflow mark beside the quiet key: Finish for now and the options wait in its sheet', (tester) async {
      final router = await open(tester, '/result/a7/recap/4', mock7(), detail());
      expect(find.bySemanticsLabel('More'), findsNothing);
      await tester.tap(find.text(ResultCopy.chooseElse));
      await _run(tester, 700);
      expect(find.text(ResultCopy.somethingElse), findsOneWidget);
      expect(find.text(ResultCopy.finishForNow), findsOneWidget);
      await tester.tap(find.text(ResultCopy.otherOptions));
      await _run(tester, 700);
      expect(find.textContaining('AT /today/alternatives'), findsOneWidget, reason: 'pushed over the recap');
      expect(router.canPop(), isTrue);
    });
  });

  group('the result bar', () {
    testWidgets('the paper is one line and its subject a second smaller one, so nothing wraps against Replay recap', (tester) async {
      await open(tester, '/result/a7', mock7(), detail());
      final title = find.text('Mock 7');
      final subject = find.text('Accountancy');
      expect(title, findsWidgets);
      expect(tester.renderObject<RenderParagraph>(title.first).didExceedMaxLines, isFalse);
      final topLine = tester.getRect(title.first);
      final subjectLine = tester.getRect(subject.first);
      expect(subjectLine.top, greaterThanOrEqualTo(topLine.bottom - 2));
      expect(tester.renderObject<RenderParagraph>(subject.first).text.style!.fontSize!, greaterThanOrEqualTo(12));
    });

    testWidgets('scrolled, a row under the bar dissolves into the ground instead of showing through', (tester) async {
      await open(tester, '/result/a7', mock7(), detail());
      expect(find.byType(Scrollable), findsWidgets);
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -400));
      await _run(tester, 400);
      final scrim = find.byWidgetPredicate((w) => w is DecoratedBox && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).gradient != null);
      expect(scrim, findsWidgets);
    });
  });

  group('type floors', () {
    testWidgets('the Sankey axis reads at 12 sp', (tester) async {
      await open(tester, '/result/a7/recap/2', mock7(), detail());
      final axis = find.text('250');
      expect(axis, findsOneWidget);
      expect(tester.renderObject<RenderParagraph>(axis).text.style!.fontSize!, greaterThanOrEqualTo(12));
    });
  });
}
