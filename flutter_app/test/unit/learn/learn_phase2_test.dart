// UI phase 2 for Learn: one intro block, one header, one answer surface in both themes, the
// pinned bar's fade, the run's leaving step taking no touches, and the Celebrations setting on
// the ending.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn/copy.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';
import 'package:mockmob/features/learn/screens/run_done_screen.dart';
import 'package:mockmob/features/learn/screens/run_screen.dart';
import 'package:mockmob/features/learn/widgets/offline_packs.dart';
import 'package:mockmob/features/learn/widgets/recall_card.dart';
import 'package:mockmob/features/learn/widgets/screen_bits.dart';
import 'package:mockmob/features/learn/widgets/untaught_chapters.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

import '../../golden/learn/golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/learn_fixtures.dart';

class _Counting implements HapticDriver {
  int calls = 0;

  @override
  Future<void> lightImpact() async => calls++;

  @override
  Future<void> mediumImpact() async => calls++;

  @override
  Future<void> selectionClick() async => calls++;
}

/// A run controller that holds whatever state a test gives it and records the taps.
class _ScriptedRun extends RunController {
  _ScriptedRun(super.runId, this.initial);

  final RunUiState initial;
  @override
  RunUiState build() => initial;

  void show(RunUiState next) => state = next;
}

void main() {
  setUpAll(loadAppFonts);

  group('Concepts: one intro block before the one action (SPACING-AUDIT E1)', () {
    testWidgets('the first visit explains how Concepts work', (tester) async {
      await pumpScreen(
        tester,
        const LearnScreen(),
        brightness: Brightness.dark,
        overrides: learnOverrides(catalog: catalog(due: 12), firstVisit: true),
      );
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(LearnCopy.subtitle), findsOneWidget);
      expect(find.text(LearnCopy.howTitle), findsOneWidget);
    });

    testWidgets('every visit after it shows the two-line intro alone', (tester) async {
      await pumpScreen(tester, const LearnScreen(), brightness: Brightness.dark, overrides: learnOverrides(catalog: catalog(due: 12)));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(LearnCopy.subtitle), findsOneWidget);
      expect(find.text(LearnCopy.howTitle), findsNothing);
      expect(find.text(LearnCopy.howLine), findsNothing);
    });

    testWidgets('the intro, the hero and the subject headings share the 16 dp gutter (no 4 dp indents)', (tester) async {
      await pumpScreen(tester, const LearnScreen(), brightness: Brightness.light, size: const Size(360, 2400), overrides: learnOverrides(catalog: catalog(due: 12)));
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.getTopLeft(find.text(LearnCopy.subtitle)).dx, 16);
      expect(tester.getTopLeft(find.text(LearnCopy.chapterSummariesHeading).first).dx, 16);
      expect(tester.getTopLeft(find.text(LearnCopy.untaughtHeading).first).dx, 16);
      expect(tester.getTopLeft(find.text(LearnCopy.offlineHeading)).dx, 16);
    });
  });

  group('the page header', () {
    testWidgets('is the one page header of the app: the back arrow on the gutter, a 48 dp reach, and it goes back', (tester) async {
      var back = 0;
      await pumpMockmob(
        tester,
        Align(alignment: Alignment.topCenter, child: LearnPageHeader(onBack: () => back++, title: LearnCopy.title)),
        brightness: Brightness.dark,
        wrapInScaffold: true,
      );
      expect(find.byType(MmPageHeader), findsOneWidget);
      final arrow = tester.getRect(find.byIcon(LucideIcons.arrowLeft));
      expect(arrow.left, 16, reason: 'the glyph sits on the gutter');
      expect(tester.getTopLeft(find.text(LearnCopy.title)).dx, 56, reason: 'the title follows the arrow at 16 dp');
      final press = await tester.startGesture(arrow.center);
      await tester.pump(); // the press spring's first frame
      await tester.pump(const Duration(milliseconds: 80));
      final sink = tester.widget<Transform>(find.descendant(of: find.byType(MmPressable), matching: find.byType(Transform)).first).transform.storage[0];
      expect(sink, lessThan(1), reason: 'the key sinks on the next frames of the touch');
      await press.up();
      expect(back, 1);
      await tester.tapAt(Offset(arrow.left - 12, arrow.center.dy));
      expect(back, 2, reason: 'the target reaches past the glyph');
    });
  });

  group('the pinned bar', () {
    testWidgets('has a 24 dp fade into the ground above it and no hairline, and content never sits under it', (tester) async {
      await pumpMockmob(
        tester,
        Column(
          children: [
            Expanded(child: ListView(children: [for (var i = 0; i < 30; i++) SizedBox(height: 40, child: Text('row $i'))])),
            const PinnedActions(children: [SizedBox(height: 56, child: Text('key'))]),
          ],
        ),
        brightness: Brightness.dark,
      );
      final barTop = tester.getTopLeft(find.text('key')).dy - 8;
      final fade = find.byWidgetPredicate((w) => w is DecoratedBox && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).gradient is LinearGradient);
      expect(fade, findsOneWidget);
      final rect = tester.getRect(fade);
      expect(rect.height, PinnedActions.fade);
      expect(rect.bottom, barTop, reason: 'the fade ends where the solid bar begins');
      // The bar is the ground itself: the fade replaces the old hairline.
      final bar = tester.widget<ColoredBox>(find.ancestor(of: find.text('key'), matching: find.byType(ColoredBox)).first);
      expect(bar.color, tester.element(find.text('key')).mmColors.ground);
    });
  });

  group('the answer is the strongest surface in both themes (SPACING-AUDIT E2, G6)', () {
    for (final brightness in Brightness.values) {
      testWidgets('the revealed answer panel in ${brightness.name}', (tester) async {
        await pumpMockmob(
          tester,
          const Padding(padding: EdgeInsets.all(16), child: AnswerPanel(answer: 'Old share', explanation: 'Start from the old share.')),
          brightness: brightness,
          disableAnimations: true,
        );
        final colors = tester.element(find.byType(AnswerPanel)).mmColors;
        final decoration = tester.widget<DecoratedBox>(find.descendant(of: find.byType(AnswerPanel), matching: find.byType(DecoratedBox)).first).decoration as ShapeDecoration;
        if (brightness == Brightness.dark) {
          expect(decoration.color, colors.raised2, reason: 'Night lifts it above the card');
        } else {
          expect(decoration.color, colors.raised, reason: 'Day must not turn it into a taupe slab (raised2 is darker than the ground)');
          expect(decoration.color, isNot(colors.raised2));
        }
        final side = (decoration.shape as OutlinedBorder).side;
        expect(side.width, greaterThanOrEqualTo(1.5), reason: 'an ink rim carries the state in both themes');
      });
    }
  });

  group('lists', () {
    testWidgets('the whole offline row is the switch, and it answers a press', (tester) async {
      final changes = <(String, bool)>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: OfflinePacks(
            subjects: const [LearnSubject(id: 'accountancy', title: 'Accountancy')],
            state: const OfflineLearnState(),
            onChanged: (s, keep) => changes.add((s, keep)),
          ),
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      await tester.tap(find.text('Accountancy'));
      expect(changes, [('accountancy', true)]);
      expect(find.byType(MmRowGroup), findsOneWidget, reason: 'the same grouped list as the lessons');
    });

    testWidgets('opening the untaught chapters never resizes through an AnimatedSize', (tester) async {
      await pumpMockmob(
        tester,
        UntaughtChapters(chapters: const ['Admission of a Partner'], onPractise: (_) {}),
        brightness: Brightness.dark,
      );
      // The key eases its own width when its label changes (KeyButtonFace); only the card's
      // height is under test here.
      int cardSizers() =>
          find.byType(AnimatedSize).evaluate().length -
          find.descendant(of: find.byType(KeyButton), matching: find.byType(AnimatedSize)).evaluate().length;
      expect(cardSizers(), 0);
      expect(find.text(LearnCopy.practiseKey), findsNothing);
      await tester.tap(find.text(LearnCopy.untaughtHeading));
      await tester.pump();
      expect(find.text(LearnCopy.practiseKey), findsOneWidget, reason: 'the height changes at once');
      expect(cardSizers(), 0);
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    });
  });

  group('the run', () {
    testWidgets('the step that is leaving takes no touches', (tester) async {
      late _ScriptedRun scripted;
      final first = RunUiState(load: RunLoad.ready, run: run(cursor: 0, revision: 1));
      final second = RunUiState(load: RunLoad.ready, run: run(cursor: 1, revision: 2, item: choiceCard()));
      await pumpScreen(
        tester,
        const LearnRunScreen(runId: 'run-1'),
        brightness: Brightness.dark,
        overrides: [
          ...learnOverrides(),
          runControllerProvider('run-1').overrideWith(() => scripted = _ScriptedRun('run-1', first)),
        ],
      );
      expect(find.text(LearnCopy.showAnswer), findsOneWidget);
      scripted.show(second);
      await tester.pump(const Duration(milliseconds: 40));
      // The old card is still fading out under the new one: its key is on screen, and dead.
      final old = find.ancestor(of: find.text(LearnCopy.showAnswer), matching: find.byType(IgnorePointer));
      expect(find.text(LearnCopy.showAnswer), findsOneWidget);
      expect(tester.widgetList<IgnorePointer>(old).any((w) => w.ignoring), isTrue);
      // The step that is arriving takes touches from its first frame.
      final arriving = find.ancestor(of: find.text(LearnCopy.checkAnswer), matching: find.byType(IgnorePointer));
      expect(tester.widgetList<IgnorePointer>(arriving).any((w) => w.ignoring), isFalse);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(LearnCopy.showAnswer), findsNothing);
      expect(find.text(LearnCopy.checkAnswer), findsOneWidget);
    });
  });

  group('the ending and the Celebrations setting (MOTION.md 1.2)', () {
    // 20 steps keep the pips inking for 1.4 s, longer than the harness's own settling.
    final finished = run(
      state: 'complete',
      mode: 'learn',
      cursor: 20,
      total: 20,
      revision: 40,
      item: null,
      updatedAt: '2026-10-12T12:42:00.000Z',
      title: 'Sacrificing and gaining ratios',
    );

    Future<_Counting> pump(WidgetTester tester, CelebrationMode mode, {Brightness brightness = Brightness.dark}) async {
      final haptics = _Counting();
      await pumpScreen(
        tester,
        const LearnRunDoneScreen(runId: 'run-1'),
        brightness: brightness,
        overrides: [
          ...learnOverrides(catalog: catalog(due: 0), runs: {'run-1': RunUiState(load: RunLoad.ready, run: finished)}),
          celebrationModeProvider.overrideWithValue(mode),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
      );
      return haptics;
    }

    testWidgets('Full: Mobi cheers once the pips have inked, and one success tick follows', (tester) async {
      final haptics = await pump(tester, CelebrationMode.full);
      expect(find.byType(Mobi), findsNothing, reason: 'Mobi acts after the state has landed, not before');
      expect(haptics.calls, 0);
      await tester.pump(const Duration(seconds: 3));
      expect(tester.widget<Mobi>(find.byType(Mobi)).pose, MobiPose.cheer);
      expect(haptics.calls, greaterThan(0));
    });

    testWidgets('Quiet: the pips ink and the words stand, Mobi sits still', (tester) async {
      await pump(tester, CelebrationMode.quiet);
      await tester.pump(const Duration(seconds: 3));
      final mobi = tester.widget<Mobi>(find.byType(Mobi));
      expect(mobi.pose, MobiPose.rest);
      expect(mobi.motion, MobiMotion.none);
    });

    testWidgets('Off: words only, no Mobi, no inking, no tick', (tester) async {
      final haptics = await pump(tester, CelebrationMode.off);
      await tester.pump(const Duration(seconds: 3));
      expect(find.byType(Mobi), findsNothing);
      expect(haptics.calls, 0);
      expect(find.textContaining('Lesson finished'), findsOneWidget);
    });

    testWidgets('a tap anywhere skips the moment to its end state', (tester) async {
      await pump(tester, CelebrationMode.full);
      expect(find.byType(Mobi), findsNothing);
      await tester.tapAt(const Offset(180, 300));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.byType(Mobi), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 300)); // the success tick's own timer
    });

    testWidgets('the content is weighted to the optical centre, not stacked at the top', (tester) async {
      await pump(tester, CelebrationMode.off, brightness: Brightness.light);
      await tester.pump(const Duration(seconds: 3));
      final title = tester.getRect(find.textContaining('Lesson finished'));
      // Off has no art: the title block alone sits near 40% of the free height, with air above.
      expect(title.top, greaterThan(180));
      expect(title.left, 24, reason: 'a moment uses the 24 dp gutter');
    });
  });
}
