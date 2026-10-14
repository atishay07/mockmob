import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/screens/welcome_view.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  Future<WelcomeView> welcomeAt(WidgetTester tester, DateTime now) async {
    await pumpMockmob(
      tester,
      const OnboardingFlow(skipColdOpen: true),
      size: kPhone,
      brightness: Brightness.dark,
      disableAnimations: true,
      overrides: onboardingOverrides(now: now),
      wrapInScaffold: false,
    );
    await tester.pump(const Duration(milliseconds: 100));
    return tester.widget<WelcomeView>(find.byType(WelcomeView));
  }

  group('the hour on Welcome uses the shared late-night window, 11 PM to 5 AM', () {
    testWidgets('9:40 PM: Mobi waves and says hello', (tester) async {
      final view = await welcomeAt(tester, DateTime(2026, 10, 13, 21, 40));
      expect(view.lateNight, isFalse);
      expect(view.entrance, MobiAct.hello);
      expect(find.text(OnboardingCopy.mobiWelcome), findsOneWidget);
    });

    testWidgets('11:40 PM: sleepy, with the late line', (tester) async {
      final view = await welcomeAt(tester, DateTime(2026, 10, 13, 23, 40));
      expect(view.lateNight, isTrue);
      expect(view.entrance, MobiAct.sleepy);
      expect(find.text(OnboardingCopy.lateNight), findsOneWidget);
    });

    testWidgets('4:30 AM is still late (the old 4 AM edge is gone); Mobi sleeps until tapped', (tester) async {
      final view = await welcomeAt(tester, DateTime(2026, 10, 14, 4, 30));
      expect(view.lateNight, isTrue);
      expect(view.entrance, MobiAct.sleep);
      expect(find.text(OnboardingCopy.lateNight), findsNothing, reason: 'a sleeping Mobi says nothing');
      expect(find.bySemanticsLabel(OnboardingCopy.mobiAsleep), findsOneWidget);

      await tester.tap(find.byType(MobiCharacter));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(OnboardingCopy.lateNight), findsOneWidget, reason: 'woken, he says the late line');
    });

    testWidgets('5:00 AM: morning, a plain hello', (tester) async {
      final view = await welcomeAt(tester, DateTime(2026, 10, 14, 5));
      expect(view.lateNight, isFalse);
      expect(view.entrance, MobiAct.hello);
    });
  });

  group('Welcome never overflows, on any phone or text size (router test 19)', () {
    for (final size in const [Size(320, 568), Size(360, 640), Size(360, 780), Size(384, 853), Size(412, 915)]) {
      for (final scale in const [1.0, 1.3, 2.0]) {
        testWidgets('${size.width.toInt()} by ${size.height.toInt()} at text ${scale}x, with every extra line shown', (tester) async {
          await pumpMockmob(
            tester,
            WelcomeView(
              onStart: () {},
              onHaveAccount: () {},
              onStartOver: () {},
              returning: true,
              filled: 3,
              lateNight: true,
              notice: 'We could not read your saved sheet on this phone.',
            ),
            size: size,
            textScale: scale,
            disableAnimations: true,
            overrides: onboardingOverrides(),
            wrapInScaffold: false,
          );
          await tester.pump(const Duration(milliseconds: 100));
          expect(tester.takeException(), isNull, reason: 'a RenderFlex overflow shows as an exception here');
          // Where the words are taller than the screen they scroll: the key is always reachable.
          await tester.ensureVisible(find.text(OnboardingCopy.continuePlan));
          await tester.pump();
          final key = tester.getRect(find.text(OnboardingCopy.continuePlan));
          expect(key.bottom, lessThanOrEqualTo(size.height));
          expect(find.text(OnboardingCopy.continuePlan).hitTestable(), findsOneWidget);
        });
      }
    }
  });

  testWidgets('a Mobi shown asleep wakes once when Welcome is seen again after 5 AM', (tester) async {
    final entrance = ValueNotifier<MobiAct>(MobiAct.sleep);
    addTearDown(entrance.dispose);
    await pumpMockmob(
      tester,
      ValueListenableBuilder<MobiAct>(
        valueListenable: entrance,
        builder: (context, act, _) => WelcomeView(onStart: () {}, onHaveAccount: () {}, entrance: act, lateNight: true),
      ),
      size: kPhone,
      disableAnimations: true,
      overrides: onboardingOverrides(),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text(OnboardingCopy.lateNight), findsNothing);

    // The same view, rebuilt after 5 AM: he wakes (once) and talks.
    entrance.value = MobiAct.hello;
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text(OnboardingCopy.lateNight), findsOneWidget);
    expect(find.bySemanticsLabel(OnboardingCopy.mobiAsleep), findsNothing);
  });
}
