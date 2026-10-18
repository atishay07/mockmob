// The painted scene set in use: where Mobi and the seal land on the paintings, the welcome line
// never covering the pinned sheet, the seal moment following the hold (and letting go), the seal
// struck once however it is asked for, the Celebrations setting, and the right painting per
// theme in the milestone moment and the empty states.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show ProviderContainer, ProviderScope;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/steps/plan_step.dart';
import 'package:mockmob/features/onboarding/widgets/hold_to_seal.dart';
import 'package:mockmob/features/onboarding/widgets/plan_seal_moment.dart';
import 'package:mockmob/features/onboarding/widgets/welcome_scene.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart' show Celebration;
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_slot.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show CelebrationMode, celebrationModeProvider;

import '../../golden/art_scenes/scene_kit.dart';
import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

class _CountingHaptics implements HapticDriver {
  int selection = 0;
  int light = 0;
  int medium = 0;

  @override
  Future<void> selectionClick() async => selection++;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async => medium++;
}

PlanSealMoment _moment(WidgetTester tester) => tester.widget<PlanSealBackdrop>(find.byType(PlanSealBackdrop)).moment;

Future<_CountingHaptics> _atPlan(WidgetTester tester, {CelebrationMode mode = CelebrationMode.full, Brightness brightness = Brightness.dark}) async {
  final haptics = _CountingHaptics();
  await pumpMockmob(
    tester,
    const OnboardingFlow(skipColdOpen: true, startInDeck: true),
    size: kPhone,
    brightness: brightness,
    overrides: [
      ...onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)),
      celebrationModeProvider.overrideWithValue(mode),
      hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
    ],
  );
  // The flip and the plan's engraving play out.
  for (var i = 0; i < 30; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  return haptics;
}

/// Plays [ms] of time in 50 ms frames (a single long pump only starts a new animation).
Future<void> _run(WidgetTester tester, int ms) async {
  for (var t = 0; t < ms; t += 50) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

bool _sealedIn(WidgetTester tester) {
  final container = ProviderScope.containerOf(tester.element(find.byType(OnboardingFlow)));
  return _isSealed(container);
}

bool _isSealed(ProviderContainer c) => c.read(onboardingAnswersProvider).value?.sealed ?? false;

void main() {
  setUpAll(loadAppFonts);

  group('where things land on the paintings', () {
    test('Mobi stands in the welcome ellipse, as tall as the painting says', () {
      final l = WelcomeHeroLayout.of(kPhone, room: 520);
      final w = l.image.width;
      expect(w, greaterThanOrEqualTo(kPhone.width), reason: 'the painted room is at least the width of the screen');
      expect(l.image.left, closeTo((kPhone.width - w) / 2, 0.01), reason: 'grown, it stays centred');
      expect(l.image.top, greaterThanOrEqualTo(0), reason: 'room enough: the painting is never pushed up');
      expect(l.feet.dx, closeTo(l.image.left + WelcomeHeroLayout.footX * w, 0.01));
      expect(l.feet.dy, closeTo(WelcomeHeroLayout.footY * l.image.height, 0.01));
      expect(l.mobiHeight, closeTo(560 / 1080 * w, 0.01));
      expect(l.ellipse.center.dx, closeTo(l.feet.dx, 0.01));
    });

    test('on a short phone the room slides up so the ellipse stays above the words', () {
      const small = Size(360, 640);
      final l = WelcomeHeroLayout.of(small, room: 330, topLimit: 98);
      expect(l.image.top, lessThan(0));
      expect(l.ellipse.bottom, lessThanOrEqualTo(330 + 0.01));
      expect(l.feet.dy - l.mobiHeight, greaterThanOrEqualTo(98 - 0.01), reason: 'Mobi never runs up into the wordmark');
    });

    test('the code seal sits on the impression at the painting scale', () {
      final g = SealGeometry.of(kPhone);
      expect(g.centre.dx, closeTo(kPhone.width / 2, 0.01), reason: 'the impression is at the middle of the screen');
      expect(g.image.left + SealGeometry.impressionX * g.image.width, closeTo(g.centre.dx, 0.01));
      expect(g.centre.dy, closeTo(SealGeometry.impressionY * g.image.height, 0.01));
      expect(g.image.top, 0, reason: 'the painting is top aligned; the lamp shade stays cut by the screen edge');
      expect(g.disc, closeTo(0.1055 * g.image.width, 0.01));
      expect(g.teeth, closeTo(0.1345 * g.image.width, 0.01));
    });
  });

  group('welcome', () {
    testWidgets("Mobi's line sits left of the pinned sheet and above his head", (tester) async {
      await pumpMockmob(
        tester,
        const OnboardingFlow(skipColdOpen: true),
        size: kPhone,
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: onboardingOverrides(),
        wrapInScaffold: false,
      );
      await tester.pump(const Duration(milliseconds: 200));
      final bubble = tester.getRect(find.byType(MobiBubble));
      final mobi = tester.getRect(find.byType(MobiStage));
      final hero = tester.widget<WelcomeHero>(find.byType(WelcomeHero)).layout;
      final sheetLeft = hero.image.left + hero.image.width * WelcomeHeroLayout.sheetLeft;
      expect(bubble.right, lessThanOrEqualTo(sheetLeft + 0.5));
      expect(bubble.bottom, lessThanOrEqualTo(mobi.top + 0.5));
      expect(find.text(OnboardingCopy.mobiWelcome), findsOneWidget);
    });

    testWidgets('Day welcomes in the daylit room, Night in the lamp-lit one (design critic 3)', (tester) async {
      await pumpMockmob(
        tester,
        const OnboardingFlow(skipColdOpen: true),
        size: kPhone,
        brightness: Brightness.light,
        disableAnimations: true,
        overrides: onboardingOverrides(),
        wrapInScaffold: false,
      );
      await tester.pump(const Duration(milliseconds: 200));
      expect(Theme.of(tester.element(find.byType(MobiStage))).brightness, Brightness.light);
      final image = tester.widget<SceneImage>(find.byType(SceneImage));
      expect(image.art, SceneArt.allClearDay);
      // Mobi stands in the sunlit pool, and his line ends before the pinned sheet.
      final hero = tester.widget<WelcomeHero>(find.byType(WelcomeHero)).layout;
      final mobi = tester.getRect(find.byType(MobiStage));
      expect(mobi.bottom, closeTo(hero.feet.dy, 0.5));
      final bubble = tester.getRect(find.byType(MobiBubble));
      expect(bubble.right, lessThanOrEqualTo(hero.sheetX + 0.5));
    });

    test('the floor reaches the words: no dead band under the scene, Night or Day', () {
      for (final room in const [520.0, 560.0, 640.0]) {
        final night = WelcomeHeroLayout.of(kPhone, room: room, topLimit: 82);
        expect(room - night.ellipse.bottom, lessThanOrEqualTo(WelcomeHeroLayout.floorGap + WelcomeHeroLayout.maxSlide + 40), reason: 'room $room');
        expect(night.image.width, lessThanOrEqualTo(kPhone.width * WelcomeHeroLayout.maxGrow + 0.01));
        final day = WelcomeHeroLayout.day(kPhone, room: room, topLimit: 82);
        expect(day.image.bottom, greaterThanOrEqualTo(room), reason: 'the daylit floor runs into the words');
        expect(day.sheetX + 0.22 * day.image.width, lessThanOrEqualTo(kPhone.width), reason: 'the pinned sheet is whole on screen');
      }
    });
  });

  group('the plan seal moment', () {
    testWidgets('holding brings the sheet up and the seal down; letting go gives the card back', (tester) async {
      await _atPlan(tester);
      expect(_moment(tester).reveal, 0);
      final hold = await tester.startGesture(tester.getCenter(find.byType(HoldToSeal)));
      await _run(tester, 500);
      expect(_moment(tester).reveal, greaterThan(0.9));
      expect(_moment(tester).press, greaterThan(0.2));
      await hold.up();
      await _run(tester, 500);
      expect(_moment(tester).reveal, 0, reason: 'a hold let go early returns the plan card');
      expect(_sealedIn(tester), isFalse);
      // The words are laid out from the start (so the sheet stands above them) but unseen.
      final words = find.textContaining('Sealed. Week one');
      final shown = tester.widgetList<Opacity>(find.ancestor(of: words, matching: find.byType(Opacity))).map((o) => o.opacity);
      expect(shown, contains(0.0), reason: 'no words before the seal');
    });

    testWidgets('a full hold strikes once: a firm tap, the flecks, then the words', (tester) async {
      final haptics = await _atPlan(tester);
      final hold = await tester.startGesture(tester.getCenter(find.byType(HoldToSeal)));
      await _run(tester, 1300);
      await _run(tester, 50);
      expect(_sealedIn(tester), isTrue);
      expect(haptics.medium, 1);
      expect(_moment(tester).burst, greaterThan(0), reason: 'Full throws the foil flecks once');
      await hold.up();
      await _run(tester, 900);
      expect(_moment(tester).reveal, 1, reason: 'once struck, the sheet stays');
      expect(find.textContaining('Sealed. Week one'), findsOneWidget);
      expect(find.widgetWithText(KeyButton, OnboardingCopy.next), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('a double tap on the seal link seals once (regression)', (tester) async {
      final haptics = await _atPlan(tester);
      final link = find.byKey(PlanStep.tapToSealKey);
      await tester.tap(link);
      await _run(tester, 40);
      if (link.evaluate().isNotEmpty) await tester.tap(link, warnIfMissed: false);
      await _run(tester, 400);
      expect(haptics.medium, 1);
      expect(_sealedIn(tester), isTrue);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Quiet strikes with no flecks', (tester) async {
      final haptics = await _atPlan(tester, mode: CelebrationMode.quiet);
      await tester.tap(find.byKey(PlanStep.tapToSealKey));
      await _run(tester, 400);
      expect(haptics.medium, 0);
      expect(_moment(tester).burst, 0);
      expect(_moment(tester).land, greaterThan(0));
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Day draws the impression in code, no painted night room', (tester) async {
      await _atPlan(tester, brightness: Brightness.light);
      await tester.tap(find.byKey(PlanStep.tapToSealKey));
      await _run(tester, 400);
      expect(find.byType(SceneImage), findsNothing);
      expect(_moment(tester).reveal, 1);
      await tester.pump(const Duration(seconds: 3));
    });
  });

  group('the milestone moment', () {
    Future<void> pumpMoment(WidgetTester tester, Celebration c, Brightness b) async {
      await pumpMockmob(tester, CelebrationMoment(celebration: c), size: kPhone, brightness: b, disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
    }

    for (final (b, art) in [(Brightness.dark, SceneArt.milestoneNight), (Brightness.light, SceneArt.milestoneDay)]) {
      testWidgets('a first repair stands under the painted check (${b.name})', (tester) async {
        await pumpMoment(tester, momentOf(firstRepair), b);
        expect(find.byType(MilestoneArtBand), findsOneWidget);
        expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, art);
      });
    }

    testWidgets('Quiet is the words only: no painting', (tester) async {
      await pumpMoment(tester, momentOf(firstRepair, quiet: true), Brightness.dark);
      expect(find.byType(MilestoneArtBand), findsNothing);
    });

    testWidgets('a plain repair (L1) gets no painting', (tester) async {
      final plain = CelebrationEvent.repairFinished(attemptId: 'a2', firstRequestId: 'r2', at: DateTime(2026, 10, 14, 20));
      await pumpMoment(tester, momentOf(plain), Brightness.dark);
      expect(find.byType(MilestoneArtBand), findsNothing);
    });
  });

  group('empty states', () {
    Future<void> pumpState(WidgetTester tester, StateView view, Brightness b) async {
      await pumpMockmob(tester, view, size: kPhone, brightness: b, disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 100));
    }

    for (final (b, night) in [(Brightness.dark, true), (Brightness.light, false)]) {
      testWidgets('offline sits Mobi in the unplugged room (${b.name})', (tester) async {
        await pumpState(tester, const StateView(kind: StateViewKind.offline, title: 'You are offline'), b);
        expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, night ? SceneArt.offlineNight : SceneArt.offlineDay);
        expect(find.descendant(of: find.byType(SceneVignette), matching: find.byType(Mobi)), findsOneWidget);
      });

      testWidgets('all clear shows the fully marked sheet (${b.name})', (tester) async {
        await pumpState(tester, const StateView(kind: StateViewKind.empty, scene: StateScene.allClear, title: 'Nothing to repair'), b);
        expect(tester.widget<SceneImage>(find.byType(SceneImage)).art, night ? SceneArt.allClearNight : SceneArt.allClearDay);
      });
    }

    testWidgets('"nothing yet" is not "all clear": a plain empty state has no painting', (tester) async {
      await pumpState(tester, const StateView(kind: StateViewKind.empty, title: 'No papers yet'), Brightness.dark);
      expect(find.byType(SceneVignette), findsNothing);
      expect(find.byType(Mobi), findsOneWidget);
    });

    testWidgets('the scene never runs wider than the screen, and Mobi sits inside it', (tester) async {
      await pumpState(tester, const StateView(kind: StateViewKind.offline, title: 'You are offline'), Brightness.dark);
      final scene = tester.getRect(find.byType(SceneVignette));
      final mobi = tester.getRect(find.descendant(of: find.byType(SceneVignette), matching: find.byType(Mobi)));
      expect(scene.left, greaterThanOrEqualTo(0));
      expect(scene.right, lessThanOrEqualTo(kPhone.width));
      expect(mobi.bottom, lessThanOrEqualTo(scene.bottom));
    });
  });
}
