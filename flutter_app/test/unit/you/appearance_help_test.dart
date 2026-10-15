import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/settings/appearance_settings.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/you/appearance/appearance_screen.dart';
import 'package:mockmob/features/you/help/help_screen.dart';
import 'package:mockmob/features/you/copy.dart' show YouCopy;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider, rhythmPrefsProvider;
import 'package:mockmob/features/you/you_providers.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<ProviderContainer> _pumpAppearance(
  WidgetTester tester, {
  required MemoryPrefsStore store,
  required MemoryPrefsStore celebrations,
  bool systemReduces = false,
  List<Override> extra = const [],
}) async {
  await pumpMockmob(
    tester,
    const AppearanceScreen(),
    wrapInScaffold: false,
    disableAnimations: systemReduces,
    size: const Size(384, 2200),
    overrides: [...youOverrides(prefs: AppPrefs(store), rhythmStore: celebrations), ...extra],
  );
  await tester.pump();
  return ProviderScope.containerOf(tester.element(find.byType(AppearanceScreen)));
}

/// Whether the segment that shows [label] is the selected one: read from the segment's own
/// Semantics widget, which does not depend on how the semantics tree merges the nodes.
bool _segmentSelected(WidgetTester tester, String label) {
  final semantics = find.ancestor(of: find.text(label).first, matching: find.byWidgetPredicate((w) => w is Semantics && w.properties.selected != null));
  return tester.widget<Semantics>(semantics.first).properties.selected!;
}

/// Where the rhythm feature keeps the Celebrations choice for the test account.
const _celebrationKey = 'rhythm_celebrations_u1';

void main() {
  group('appearance and feel', () {
    testWidgets('lists every setting', (tester) async {
      await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: MemoryPrefsStore());
      for (final label in [
        'Night',
        'Day',
        'Match phone',
        'Glass',
        'Lite',
        'Reduce motion',
        'Touch feedback',
        'Show results straight away',
        'Late-night lines',
        'Celebrations',
        'Quiet',
      ]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      // Full and Off appear twice: once for glass, once for celebrations. Off also reads beside
      // each switch that is off (Reduce motion and Open results directly).
      expect(find.text('Full'), findsNWidgets(2));
      expect(find.text('Off'), findsNWidgets(4));
    });

    testWidgets('theme choice goes through the core provider and is saved', (tester) async {
      final store = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: store, celebrations: MemoryPrefsStore());
      // Night is the default identity (Night Sheet brief, section 3).
      expect(container.read(themeModeProvider), ThemeMode.dark);
      await tester.tap(find.text('Day'));
      await tester.pump();
      expect(container.read(themeModeProvider), ThemeMode.light);
      expect(await AppPrefs(store).theme(), ThemeChoice.light);
      await tester.tap(find.text('Match phone'));
      await tester.pump();
      expect(container.read(themeModeProvider), ThemeMode.system);
      expect(await AppPrefs(store).theme(), ThemeChoice.system);
    });

    testWidgets('glass quality is chosen here and kept', (tester) async {
      final store = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: store, celebrations: MemoryPrefsStore());
      expect(container.read(glassQualityProvider), GlassQuality.full);
      await tester.tap(find.text('Lite'));
      await tester.pump();
      expect(container.read(glassQualityProvider), GlassQuality.lite);
      expect(await AppPrefs(store).glassQuality(), 'lite');
    });

    testWidgets('while the app runs Lite for Full, Lite is the selected segment and the line says so', (tester) async {
      final container = await _pumpAppearance(
        tester,
        store: MemoryPrefsStore(),
        celebrations: MemoryPrefsStore(),
        extra: [glassBootProvider.overrideWithValue(const GlassBoot(chosen: GlassQuality.full, autoLite: true))],
      );
      expect(container.read(glassQualityProvider), GlassQuality.lite);
      expect(_segmentSelected(tester, 'Lite'), isTrue);
      expect(_segmentSelected(tester, 'Full'), isFalse);
      expect(find.text('Running Lite to keep scrolling smooth. Pick Full to try it again.'), findsOneWidget);
      expect(find.textContaining('Switched to Lite'), findsNothing);
      // Full is one tap away and then the line goes.
      await tester.tap(find.text('Full').first);
      await tester.pump();
      expect(container.read(glassQualityProvider), GlassQuality.full);
      expect(_segmentSelected(tester, 'Full'), isTrue);
      // The old line cross-fades out over 200 ms.
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Running Lite'), findsNothing);
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
      expect(find.text('On, from your phone'), findsOneWidget);
      expect(find.text('Change it in your phone settings, under accessibility.'), findsOneWidget);
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

      await tester.tap(find.text('Show results straight away'));
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
      expect(container.read(rhythmPrefsProvider).mode, CelebrationMode.full);
    });

    testWidgets('saved choices are loaded when the screen opens', (tester) async {
      final store = MemoryPrefsStore();
      final prefs = AppPrefs(store);
      await prefs.setOpenResultsDirectly(true);
      await prefs.setLateNightLines(false);
      final celebrations = MemoryPrefsStore()..values[_celebrationKey] = 'quiet';
      final container = await _pumpAppearance(tester, store: store, celebrations: celebrations);
      await tester.pump();
      await tester.pump();
      expect(container.read(openResultsDirectlyProvider), isTrue);
      expect(container.read(lateNightLinesProvider), isFalse);
      expect(container.read(rhythmPrefsProvider).mode, CelebrationMode.quiet);
    });

    testWidgets('the Celebrations choice is the one the rhythm feature reads, and it is saved', (tester) async {
      final celebrations = MemoryPrefsStore();
      final container = await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: celebrations);
      await tester.tap(find.text('Quiet'));
      await tester.pump();
      expect(container.read(celebrationModeProvider), CelebrationMode.quiet);
      expect(celebrations.values[_celebrationKey], 'quiet');
      expect(find.text(YouCopy.celebrationsQuietNote), findsOneWidget);
      await tester.tap(find.text('Off').last);
      await tester.pump();
      expect(celebrations.values[_celebrationKey], 'off');
    });

    testWidgets('the chosen theme is marked for TalkBack, not by colour alone', (tester) async {
      await _pumpAppearance(tester, store: MemoryPrefsStore(), celebrations: MemoryPrefsStore());
      expect(tester.getSemantics(find.bySemanticsLabel(RegExp(r'^Night\.'))), isSemantics(isSelected: true));
      expect(tester.getSemantics(find.bySemanticsLabel(RegExp(r'^Day\.'))), isSemantics(isSelected: false));
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
        size: const Size(384, 2200),
        overrides: youOverrides(mailer: mailer, opener: opener, version: version),
      );
      await tester.pump();
      return mailer;
    }

    testWidgets('shows the support address, the non-affiliation line and the version', (tester) async {
      await pump(tester);
      expect(find.text('support@mockmob.in'), findsOneWidget);
      expect(
        find.text('An independent practice app, not affiliated with NTA or the University of Delhi.'),
        findsOneWidget,
      );
      expect(find.text('NTA, cuet.nta.nic.in'), findsOneWidget);
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
