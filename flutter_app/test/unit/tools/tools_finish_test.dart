// The bar and tools packet, finishing pass: one Mobi per tools screen and one entrance for him, a
// refused target or subject shakes with the warn haptic beside the line that says why, the
// combo cards open to a truthful comparison, paper bubbles show the best combination against
// the limit, the score sheet's live strip rolls with the typed score, and the guide rail fills
// when it is in view (not off screen).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/tools/combo/combo_card.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';
import 'package:mockmob/features/tools/compass/compass_controller.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/guide/guide_2027_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core/motion/motion_harness.dart' show RecordingHaptics;
import 'tools_test_support.dart';

Finder _mobis() => find.byType(Mobi);

const _pool = ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'];

void main() {
  setUpAll(loadAppFonts);

  group('one Mobi per tools screen', () {
    Future<void> compass(WidgetTester tester, String subjects) async {
      await pumpMockmob(
        tester,
        const CompassScreen(),
        size: const Size(384, 6000),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCompass(subjects)),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('with nothing open the hero Mobi thinks and the page has no second one', (tester) async {
      await compass(tester, 'english,business_studies,economics');
      expect(find.text(ToolsCopy.noneOpenLine), findsOneWidget);
      expect(_mobis(), findsOneWidget);
      expect(tester.widget<Mobi>(_mobis()).pose, MobiPose.think);
      expect(tester.widget<Mobi>(_mobis()).size, 56);
    });

    testWidgets('with programmes open there is still the one, and he greets', (tester) async {
      await compass(tester, 'english,accountancy,business_studies,economics');
      expect(_mobis(), findsOneWidget);
      expect(tester.widget<Mobi>(_mobis()).entrance, MobiAct.hello);
    });

    testWidgets('his entrance does not change when the count does: later changes are reactions', (tester) async {
      await compass(tester, 'english,business_studies,economics');
      final before = tester.widget<Mobi>(_mobis()).entrance;
      expect(before, MobiAct.think);
      final container = ProviderScope.containerOf(tester.element(find.byType(CompassScreen)));
      container.read(compassControllerProvider.notifier).toggle(const DuPick.domain('mathematics'));
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.noneOpenLine), findsNothing, reason: 'Mathematics opens programmes');
      expect(_mobis(), findsOneWidget);
      expect(tester.widget<Mobi>(_mobis()).entrance, before, reason: 'one entrance for the life of the card');
    });
  });

  group('a refused target', () {
    final full = [
      'b-com-hons',
      'b-a-hons-economics',
      'b-a-hons-english',
      'b-a-hons-political-science',
      'b-a-hons-psychology',
      'b-a-hons-hindustani-music-percussion-tabla-pakhawaj',
    ];

    testWidgets('a tap on a chip that cannot be added shakes the targets with the warn haptic', (tester) async {
      final haptics = RecordingHaptics();
      await pumpMockmob(
        tester,
        const ComboScreen(),
        size: const Size(384, 3200),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          ...toolsOverrides(prefs: savedCombo(full, _pool)),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
      );
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.targetFull), findsOneWidget, reason: 'the line that says why is on screen');
      final lightBefore = haptics.count('light');
      await tester.tap(find.text('B.A. (Programme)'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(haptics.count('light'), greaterThan(lightBefore), reason: 'warn is a pair of light impacts');
      expect(find.text('B.A. (Programme)'), findsOneWidget);
      await tester.pumpAndSettle();
    });

    testWidgets('a chip that can be added still just adds (no shake, no warn)', (tester) async {
      final haptics = RecordingHaptics();
      await pumpMockmob(
        tester,
        const ComboScreen(),
        size: const Size(384, 3200),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          ...toolsOverrides(prefs: savedCombo(['b-com-hons'], _pool)),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
      );
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.targetFull), findsNothing);
      await tester.tap(find.text('B.A. (Hons.) Economics'));
      await tester.pumpAndSettle();
      expect(haptics.count('light'), 0, reason: 'only the selection tick, no warn');
    });
  });

  group('combo cards and paper bubbles', () {
    testWidgets('the header opens to how the ranking works; another card opens to a real comparison', (tester) async {
      await pumpMockmob(
        tester,
        const ComboScreen(),
        size: const Size(384, 3600),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCombo(['b-com-hons', 'b-a-hons-economics'], _pool)),
      );
      await tester.pumpAndSettle();
      expect(find.text(ComboWords.rankRule), findsNothing);
      await tester.tap(find.text('Best fit'));
      await tester.pumpAndSettle();
      expect(find.text(ComboWords.rankRule), findsOneWidget);
      await tester.tap(find.text('Best fit'));
      await tester.pumpAndSettle();
      expect(find.text(ComboWords.rankRule), findsNothing, reason: 'it closes again');

      final cards = tester.widgetList<ComboCard>(find.byType(ComboCard)).toList();
      if (cards.length > 1) {
        await tester.tap(find.text(ToolsCopy.option(2)));
        await tester.pumpAndSettle();
        expect(find.textContaining('Compared with best:'), findsOneWidget);
      }
    });

    testWidgets('with no targets the rule leaves out the targets step', (tester) async {
      await pumpMockmob(
        tester,
        const ComboScreen(),
        size: const Size(384, 3600),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCombo(const [], _pool)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Best fit'));
      await tester.pumpAndSettle();
      expect(find.text(ComboWords.rankRuleNoTargets), findsOneWidget);
      expect(find.text(ComboWords.rankRule), findsNothing);
    });

    testWidgets('paper bubbles ink the papers the best combination uses, out of the limit', (tester) async {
      await pumpMockmob(tester, const PaperBubbles(used: 3, limit: 5), disableAnimations: true);
      final bubbles = tester.widgetList<Bubble>(find.byType(Bubble)).toList();
      expect(bubbles, hasLength(5));
      expect(bubbles.where((b) => b.state == BubbleState.filled), hasLength(3));
      expect(bubbles.where((b) => b.state == BubbleState.hollow), hasLength(2));
      expect(find.text(ComboWords.papersUsed(3, 5)), findsOneWidget);
    });

    testWidgets('no combination yet, no bubbles', (tester) async {
      await pumpMockmob(tester, const PaperBubbles(used: 0, limit: 4), disableAnimations: true);
      expect(find.byType(Bubble), findsNothing);
    });
  });

  group('the score sheet live strip', () {
    final scoreField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == ToolsCopy.scoreHint);

    testWidgets('a typed score shows how many could clear in a 48 dp ring, and clearing it takes the strip away', (tester) async {
      await pumpMockmob(
        tester,
        const CompassScreen(),
        size: const Size(384, 2400),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text(ToolsCopy.categoryHeading));
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.couldClearWord), findsNothing, reason: 'no score, no strip');

      await tester.enterText(scoreField, '720');
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.couldClearWord), findsOneWidget);
      expect(tester.getSize(find.byKey(const ValueKey('clear-ring'))), const Size(48, 48));
      final open = tester.widget<KeyButton>(find.byWidgetPredicate((w) => w is KeyButton && w.label.startsWith('Show '))).label;
      expect(open, matches(RegExp(r'^Show \d+ programmes$')));

      await tester.enterText(scoreField, '');
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.couldClearWord), findsNothing);
    });
  });

  group('the guide rail', () {
    List<double> fills(WidgetTester tester) => [
      for (final p in tester.widgetList<CustomPaint>(find.byType(CustomPaint)))
        if (p.painter.runtimeType.toString() == '_RailPainter' && (p.painter! as dynamic).fill != null) (p.painter! as dynamic).fraction as double,
    ];

    testWidgets('segments in view fill as the page opens; one below the fold fills when it scrolls in', (tester) async {
      await pumpMockmob(
        tester,
        const Guide2027Screen(),
        size: const Size(360, 520),
        wrapInScaffold: false,
        overrides: toolsOverrides(now: DateTime(2027, 7)),
      );
      await tester.pump(const Duration(milliseconds: 1500));
      final opened = fills(tester);
      expect(opened, isNotEmpty);
      expect(opened.first, 1, reason: 'the first segment is in view and has filled');
      expect(opened.last, 0, reason: 'the last one is below the fold, waiting');

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -1500));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 900));
      expect(fills(tester), everyElement(1.0), reason: 'it filled once it was in view');
    });

    testWidgets('under reduced motion every segment is simply drawn', (tester) async {
      await pumpMockmob(
        tester,
        const Guide2027Screen(),
        size: const Size(360, 520),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(now: DateTime(2027, 7)),
      );
      await tester.pump(const Duration(milliseconds: 50));
      expect(fills(tester).every((f) => f == 1), isTrue);
    });
  });
}
