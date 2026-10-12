import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/settings/appearance_settings.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/you/appearance/appearance_screen.dart';
import 'package:mockmob/features/you/help/help_screen.dart';
import 'package:mockmob/features/you/you_providers.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<ProviderContainer> _pumpAppearance(
  WidgetTester tester, {
  required MemoryPrefsStore store,
  required MemoryPrefsStore celebrations,
  bool systemReduces = false,
}) async {
  await pumpMockmob(
    tester,
    const AppearanceScreen(),
    wrapInScaffold: false,
    disableAnimations: systemReduces,
    size: const Size(360, 1400),
    overrides: youOverrides(prefs: AppPrefs(store), celebrationStore: celebrations),
  );
  return ProviderScope.containerOf(tester.element(find.byType(AppearanceScreen)));
}

void main() {
  group('appearance and feel', () {
    testWidgets('lists every setting of spec 5.12.2', (tester) async {
      await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: MemoryPrefsStore());
      for (final label in [
        'Match phone',
        'Light',
        'Dark',
        'Reduce motion',
        'Touch feedback',
        'Open results directly',
        'Late-night lines',
        'Full',
        'Quiet',
        'Off',
      ]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
    });

    testWidgets('theme choice goes through the core provider and is saved', (tester) async {
      final store = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: store, celebrations: MemoryPrefsStore());
      expect(container.read(themeModeProvider), ThemeMode.system);
      await tester.tap(find.text('Dark'));
      await tester.pump();
      expect(container.read(themeModeProvider), ThemeMode.dark);
      expect(await AppPrefs(store).theme(), ThemeChoice.dark);
      await tester.tap(find.text('Light'));
      await tester.pump();
      expect(container.read(themeModeProvider), ThemeMode.light);
      expect(await AppPrefs(store).theme(), ThemeChoice.light);
    });

    testWidgets('Reduce motion sets the in-app override and clears it again', (tester) async {
      final store = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: store, celebrations: MemoryPrefsStore());
      await tester.tap(find.text('Reduce motion'));
      await tester.pump();
      expect(container.read(reducedMotionOverrideProvider), isTrue);
      expect(await AppPrefs(store).reduceMotionOverride(), isTrue);
      await tester.tap(find.text('Reduce motion'));
      await tester.pump();
      expect(container.read(reducedMotionOverrideProvider), isFalse);
      expect(await AppPrefs(store).reduceMotionOverride(), isNull, reason: 'back to following the phone');
    });

    testWidgets('when the phone removes animations the switch reads on and cannot be undone here', (tester) async {
      final container = await _pumpAppearance(
        tester,
        store: MemoryPrefsStore(),
        celebrations: MemoryPrefsStore(),
        systemReduces: true,
      );
      expect(find.text('Your phone is set to remove animations, so motion is already reduced.'), findsOneWidget);
      await tester.tap(find.text('Reduce motion'));
      await tester.pump();
      expect(container.read(reducedMotionOverrideProvider), isFalse);
    });

    testWidgets('Touch feedback, Open results directly and Late-night lines persist', (tester) async {
      final store = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: store, celebrations: MemoryPrefsStore());
      final prefs = AppPrefs(store);

      await tester.tap(find.text('Touch feedback'));
      await tester.pump();
      expect(container.read(touchFeedbackProvider), isFalse);
      expect(await prefs.touchFeedback(), isFalse);

      await tester.tap(find.text('Open results directly'));
      await tester.pump();
      expect(container.read(openResultsDirectlyProvider), isTrue);
      expect(await prefs.openResultsDirectly(), isTrue);

      await tester.tap(find.text('Late-night lines'));
      await tester.pump();
      expect(container.read(lateNightLinesProvider), isFalse);
      expect(await prefs.lateNightLines(), isFalse);
    });

    testWidgets('defaults: touch feedback on, open directly off, late-night on, celebrations full', (tester) async {
      final container = await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: MemoryPrefsStore());
      expect(container.read(touchFeedbackProvider), isTrue);
      expect(container.read(openResultsDirectlyProvider), isFalse);
      expect(container.read(lateNightLinesProvider), isTrue);
      expect(container.read(celebrationModeProvider), CelebrationMode.full);
    });

    testWidgets('saved choices are loaded when the screen opens', (tester) async {
      final store = MemoryPrefsStore();
      final prefs = AppPrefs(store);
      await prefs.setOpenResultsDirectly(true);
      await prefs.setLateNightLines(false);
      final celebrations = MemoryPrefsStore()..values[celebrationPrefKey] = 'quiet';
      final container = await _pumpAppearance(tester, store: store, celebrations: celebrations);
      await tester.pump();
      await tester.pump();
      expect(container.read(openResultsDirectlyProvider), isTrue);
      expect(container.read(lateNightLinesProvider), isFalse);
      expect(container.read(celebrationModeProvider), CelebrationMode.quiet);
    });

    testWidgets('Celebrations choice is saved', (tester) async {
      final celebrations = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: celebrations);
      await tester.tap(find.text('Quiet'));
      await tester.pump();
      expect(container.read(celebrationModeProvider), CelebrationMode.quiet);
      expect(celebrations.values[celebrationPrefKey], 'quiet');
      await tester.tap(find.text('Off'));
      await tester.pump();
      expect(celebrations.values[celebrationPrefKey], 'off');
    });

    testWidgets('the selected option is marked in words for TalkBack, not colour alone', (tester) async {
      await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: MemoryPrefsStore());
      expect(find.bySemanticsLabel(RegExp('^Match phone\\. .*Selected')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('^Full\\. .*Selected')), findsOneWidget);
    });
  });

  group('help', () {
    Future<RecordingMailer> pump(WidgetTester tester, {bool composes = true, RecordingOpener? opener, String? version = '1.0.0 (1)'}) async {
      final mailer = RecordingMailer(composes: composes);
      await pumpMockmob(
        tester,
        const HelpScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: youOverrides(mailer: mailer, opener: opener, version: version),
      );
      await tester.pump();
      return mailer;
    }

    testWidgets('shows the support address, the non-affiliation line and the version', (tester) async {
      await pump(tester);
      expect(find.text('support@mockmob.in'), findsOneWidget);
      expect(find.text('MockMob is not affiliated with NTA or Delhi University.'), findsOneWidget);
      expect(find.text('Version 1.0.0 (1)'), findsOneWidget);
    });

    testWidgets('the version line is left out when the platform cannot say', (tester) async {
      await pump(tester, version: null);
      expect(find.textContaining('Version'), findsNothing);
    });

    testWidgets('Email support opens the mail app, and a failure says what to do', (tester) async {
      final mailer = await pump(tester, composes: false);
      await tester.tap(find.text('Email support'));
      await tester.pump();
      await tester.pump();
      expect(mailer.composed, 1);
      expect(find.text('We could not open an email app. You can copy the address instead.'), findsOneWidget);
    });

    testWidgets('Copy address confirms after the copy', (tester) async {
      final mailer = await pump(tester);
      await tester.tap(find.text('Copy address'));
      await tester.pump();
      await tester.pump();
      expect(mailer.copied, 1);
      expect(find.text('Address copied.'), findsOneWidget);
    });

    testWidgets('policies open in a Custom Tab on www.mockmob.in', (tester) async {
      final opener = RecordingOpener();
      await pump(tester, opener: opener);
      await tester.tap(find.text('Privacy policy'));
      await tester.pump();
      await tester.tap(find.text('Terms of use'));
      await tester.pump();
      expect(opener.opened.map((u) => u.toString()), ['https://www.mockmob.in/privacy', 'https://www.mockmob.in/terms']);
    });
  });
}
