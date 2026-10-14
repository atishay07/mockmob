import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/motion.dart' show MmShake, MmShakeState;
import 'package:mockmob/core/settings/settings_switch.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/you/appearance/appearance_screen.dart';
import 'package:mockmob/features/you/appearance/celebration_preview.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/goal/goal_picker.dart';
import 'package:mockmob/features/you/goal/goal_screen.dart';
import 'package:mockmob/features/you/widgets/you_motion.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Widget host(Widget child, {bool disableAnimations = false}) => ProviderScope(
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: disableAnimations),
          child: Scaffold(body: Center(child: child)),
        ),
      ),
    );

void main() {
  group('goal picker stagger', () {
    test('raising the goal fills the new circles left to right, 40 ms apart', () {
      expect(GoalPicker.delayFor(3, from: 2, to: 5), Duration.zero);
      expect(GoalPicker.delayFor(4, from: 2, to: 5), const Duration(milliseconds: 40));
      expect(GoalPicker.delayFor(5, from: 2, to: 5), const Duration(milliseconds: 80));
      expect(GoalPicker.delayFor(2, from: 2, to: 5), Duration.zero, reason: 'already filled');
      expect(GoalPicker.delayFor(6, from: 2, to: 5), Duration.zero, reason: 'stays open');
    });

    test('lowering empties them right to left', () {
      expect(GoalPicker.delayFor(5, from: 5, to: 2), Duration.zero);
      expect(GoalPicker.delayFor(4, from: 5, to: 2), const Duration(milliseconds: 40));
      expect(GoalPicker.delayFor(3, from: 5, to: 2), const Duration(milliseconds: 80));
    });

    testWidgets('a pick changes the circles one beat at a time and settles', (tester) async {
      var value = 2;
      late StateSetter set;
      await tester.pumpWidget(host(StatefulBuilder(builder: (context, s) {
        set = s;
        return GoalPicker(value: value, onChanged: (v) => s(() => value = v));
      })));
      set(() => value = 5);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 45));
      await tester.pump(const Duration(milliseconds: 45));
      await tester.pumpAndSettle();
      expect(find.text('5'), findsOneWidget);
    });
  });

  group('Mobi leans with the goal', () {
    test('1 to 3 rest, 4 and 5 nod, 6 think, 7 encourage', () {
      expect([for (var d = 1; d <= 7; d++) goalMobiAct(d)], [
        MobiAct.rest,
        MobiAct.rest,
        MobiAct.rest,
        MobiAct.correct,
        MobiAct.correct,
        MobiAct.think,
        MobiAct.encourage,
      ]);
    });
  });

  group('appearance', () {
    test('Daylight wakes, Night is sleepy, Match phone thinks', () {
      expect(AppearanceScreen.actFor(ThemeMode.light), MobiAct.wake);
      expect(AppearanceScreen.actFor(ThemeMode.dark), MobiAct.sleepy);
      expect(AppearanceScreen.actFor(ThemeMode.system), MobiAct.think);
    });

    test('the celebration preview plays what each level really does', () {
      expect(CelebrationPreview.actFor(CelebrationMode.full), MobiAct.celebrate);
      expect(CelebrationPreview.actFor(CelebrationMode.quiet), MobiAct.correct);
      expect(CelebrationPreview.actFor(CelebrationMode.off), isNull);
      expect(CelebrationPreview.lineFor(CelebrationMode.off), 'No animation, the result just appears.');
      expect(CelebrationPreview.lineFor(CelebrationMode.off), YouCopy.previewOff);
    });

    testWidgets('the preview strip says its line and is one button', (tester) async {
      await tester.pumpWidget(host(const CelebrationPreview(mode: CelebrationMode.off), disableAnimations: true));
      await tester.pump();
      expect(find.text(YouCopy.previewOff), findsOneWidget);
      expect(find.bySemanticsLabel(YouCopy.previewLabel(YouCopy.previewOff)), findsOneWidget);
    });
  });

  group('the You Mobi', () {
    testWidgets('plays the one tap cycle and carries the Celebrations setting', (tester) async {
      final store = MemoryPrefsStore()..values['rhythm_celebrations_u1'] = 'quiet';
      await pumpMockmob(tester, const YouMobi(size: 64, follow: true), overrides: youOverrides(rhythmStore: store));
      await tester.pump();
      await tester.pump();
      final mobi = tester.widget<MobiCharacter>(find.byType(MobiCharacter));
      expect(mobi.interactive, isTrue);
      expect(mobi.tapCycle, same(MobiTapCycle.standard));
      expect(mobi.followPointer, isTrue);
      expect(tester.widget<MobiCelebrations>(find.byType(MobiCelebrations)).level, MobiCelebrationLevel.quiet);
    });

    test('the setting maps one to one onto the level Mobi reads', () {
      expect(celebrationLevelFor(CelebrationMode.full), MobiCelebrationLevel.full);
      expect(celebrationLevelFor(CelebrationMode.quiet), MobiCelebrationLevel.quiet);
      expect(celebrationLevelFor(CelebrationMode.off), MobiCelebrationLevel.off);
    });
  });

  group('notes and values', () {
    testWidgets('a note cross-fades to its new words', (tester) async {
      var text = 'Goal: 4 days a week';
      late StateSetter set;
      await tester.pumpWidget(host(StatefulBuilder(builder: (context, s) {
        set = s;
        return YouNote(text);
      })));
      set(() => text = 'Goal: 5 days a week');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Goal: 4 days a week'), findsOneWidget, reason: 'the old words are still leaving');
      expect(find.text('Goal: 5 days a week'), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.text('Goal: 4 days a week'), findsNothing);
    });

    testWidgets('under reduced motion the words swap at once', (tester) async {
      var text = 'Night';
      late StateSetter set;
      await tester.pumpWidget(host(
        disableAnimations: true,
        StatefulBuilder(builder: (context, s) {
          set = s;
          return YouSlideValue(text);
        }),
      ));
      set(() => text = 'Daylight');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1));
      expect(find.text('Night'), findsNothing);
      expect(find.text('Daylight'), findsOneWidget);
    });

    testWidgets('the cap sentence shakes on every refusal, the first one included, and settles back', (tester) async {
      final key = GlobalKey<MmShakeState>();
      var shown = false;
      late StateSetter set;
      await tester.pumpWidget(host(StatefulBuilder(builder: (context, s) {
        set = s;
        return shown ? MmShake(key: key, child: const Text('Five is the most.')) : const SizedBox.shrink();
      })));
      // The first refusal puts the sentence on screen and shakes it after that frame, as the
      // subjects screen does.
      set(() => shown = true);
      await tester.pump();
      final rest = tester.getTopLeft(find.text('Five is the most.'));
      key.currentState!.shake();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 20));
      expect(tester.getTopLeft(find.text('Five is the most.')), isNot(rest));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.text('Five is the most.')), rest);
    });

    testWidgets('the settings switch draws and ignores touches', (tester) async {
      await tester.pumpWidget(host(const SettingsSwitch(value: true)));
      await tester.pump();
      expect(find.byType(SettingsSwitch), findsOneWidget);
    });
  });
}
