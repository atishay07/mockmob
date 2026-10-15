// The four steps of a mistake in plain words, the same on the app and the website, and Mobi beside
// the outcome's line on the repair run, never in a row of his own (owner recording, 15 Oct, items 5
// and 6).
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiCharacter;
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/widgets/life_row.dart';
import 'package:mockmob/features/review/widgets/mistake_view.dart' show StageMoment;
import 'package:mockmob/features/review/widgets/repair_mobi.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  // Real fonts, so the step words are measured as a phone draws them.
  setUpAll(loadAppFonts);

  group('the four steps', () {
    test('use the website words (RUN_COPY.stages and laterSteps in repairRun.js)', () {
      expect([ReviewCopy.found, ReviewCopy.repaired, ReviewCopy.retested, ReviewCopy.stillRight], ['Found', 'Repaired', 'Retested', 'Still right']);
      expect(ReviewCopy.lifeCaption, 'The last two steps test you with new questions on the same idea. They are not ready yet.');
      // One line for one fact: the entry, the ending and the record all say the same.
      expect(ReviewCopy.checkedLater, ReviewCopy.lifeCaption);
      expect(ReviewCopy.checksGate, ReviewCopy.lifeCaption);
    });

    test('are plain: no old step names, no exclamation marks, no dashes', () {
      final all = [
        ReviewCopy.lifeCaption,
        ReviewCopy.checkedNotYet,
        for (final now in [ReviewCopy.lifeFound, ReviewCopy.lifeRepaired, ReviewCopy.lifeReviewed, ReviewCopy.lifeSetAside]) ReviewCopy.lifeSpoken(now),
      ];
      for (final line in all) {
        expect(line, isNot(contains('Checked')), reason: line);
        expect(line, isNot(contains('Holds')), reason: line);
        expect(line, isNot(matches(RegExp('[!—–]'))), reason: line);
      }
    });

    for (final (stage, said) in [
      (MistakeStage.found, 'Found, not repaired yet. The last two steps, retested and still right, are not ready yet.'),
      (MistakeStage.repaired, 'Found and repaired. The last two steps, retested and still right, are not ready yet.'),
      (MistakeStage.reviewed, 'Found and read with the key, not repaired yet. The last two steps, retested and still right, are not ready yet.'),
      (MistakeStage.setAside, 'Found, set aside while the key is checked. The last two steps, retested and still right, are not ready yet.'),
    ]) {
      testWidgets('a screen reader hears where a ${stage.name} mistake is, and that the last two are not ready', (tester) async {
        await pumpMockmob(tester, LifeRow(stage: stage), disableAnimations: true, overrides: reviewOverrides());
        expect(tester.getSemantics(find.byType(LifeRow)), isSemantics(label: said));
        for (final word in ['Found', 'Repaired', 'Retested', 'Still right']) {
          expect(find.text(word), findsOneWidget);
        }
      });
    }

    testWidgets('a repair opened again shows Repaired at once, with no draw', (tester) async {
      await pumpMockmob(tester, const StageMoment(repaired: true, animate: false), overrides: reviewOverrides());
      expect(tester.widget<LifeRow>(find.byType(LifeRow)).stage, MistakeStage.repaired);
      expect(tester.widget<LifeRow>(find.byType(LifeRow)).animate, isFalse);
    });
  });

  group('Mobi on the repair run', () {
    const line = Key('line');

    testWidgets('stands beside the line, centred on it, never above it or over it', (tester) async {
      // A 360 dp phone with the run's 16 dp gutters: the steps get 360 - 32 - 76 - 12 = 240 dp.
      await pumpMockmob(
        tester,
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: RepairMobi(stepKey: 'm7/q1', outcome: null, beside: StageMoment(repaired: true, animate: false, key: line)),
        ),
        size: const Size(360, 640),
        disableAnimations: true,
        overrides: reviewOverrides(),
      );
      final mobi = tester.getRect(find.byType(MobiCharacter));
      final steps = tester.getRect(find.byKey(line));
      expect(steps.left, greaterThanOrEqualTo(mobi.right + RepairMobi.gap - 0.5), reason: 'the steps start after Mobi and the air beside him');
      expect((steps.center.dy - mobi.center.dy).abs(), lessThan(4), reason: 'one row, centred together');
      // The longest step word fits its column on a 360 dp phone with Mobi beside it.
      for (final word in ['Repaired', 'Retested', 'Still right']) {
        final text = tester.renderObject<RenderParagraph>(find.text(word));
        expect(text.didExceedMaxLines, isFalse, reason: word);
      }
    });

    testWidgets('on a 320 dp phone the step words still sit whole inside their own columns', (tester) async {
      await pumpMockmob(
        tester,
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: RepairMobi(stepKey: 'm7/q1', outcome: null, beside: StageMoment(repaired: true, animate: false, key: line)),
        ),
        size: const Size(320, 640),
        disableAnimations: true,
        overrides: reviewOverrides(),
      );
      final steps = tester.getRect(find.byKey(line));
      final column = steps.width / 4;
      final words = ['Found', 'Repaired', 'Retested', 'Still right'];
      for (var i = 0; i < words.length; i++) {
        final word = tester.getRect(find.text(words[i]));
        expect(word.left, greaterThanOrEqualTo(steps.left + column * i - 0.5), reason: words[i]);
        expect(word.right, lessThanOrEqualTo(steps.left + column * (i + 1) + 0.5), reason: words[i]);
      }
    });

    testWidgets('with celebrations off only the line is shown', (tester) async {
      await pumpMockmob(
        tester,
        const RepairMobi(stepKey: 'm7/q1', outcome: null, beside: Text('The line', key: line)),
        disableAnimations: true,
        overrides: reviewOverrides(celebration: CelebrationMode.off),
      );
      expect(find.byType(MobiCharacter), findsNothing);
      expect(find.byKey(line), findsOneWidget);
    });
  });
}
