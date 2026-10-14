// Goldens for the four places the painted scene set lives (14 Oct 2026 final set): the welcome
// room with the live Mobi in its lit ellipse, the plan seal struck into the sheet's impression,
// the first-repair and first-week milestone moments under the painted check, and the all-clear
// and offline empty states. Night and Day each.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_slot.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../onboarding/support.dart';
import 'scene_kit.dart';

void _golden(
  String name,
  Widget Function() build, {
  List<Override> Function()? overrides,
  Future<void> Function(WidgetTester tester)? act,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      MobiRation.reset();
      addTearDown(MobiRation.reset);
      tester.view.padding = const FakeViewPadding(top: 56, bottom: 40);
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(
          key: boundary,
          child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: build())),
        ),
        brightness: brightness,
        size: kPhone,
        disableAnimations: true,
        overrides: overrides?.call() ?? onboardingOverrides(),
      );
      if (act != null) await act(tester);
      await precacheScenes(tester);
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      await preview(tester, boundary, '${name}_$tag');
    });
  }
}

/// A moment on the ground at the app's gutter, the way Today and the repair ending place it.
Widget _onGround(Widget child) => Builder(
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [child]),
        ),
      ),
    );

void main() {
  setUpAll(loadAppFonts);

  _golden('welcome', () => const OnboardingFlow(skipColdOpen: true));

  _golden(
    'plan_seal_struck',
    () => const OnboardingFlow(skipColdOpen: true, startInDeck: true),
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)),
    act: (tester) async {
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.widgetWithText(KeyButton, OnboardingCopy.sealIt));
      await tester.pump(const Duration(milliseconds: 600));
    },
  );

  _golden(
    'milestone_first_repair',
    () => _onGround(CelebrationMoment(celebration: momentOf(firstRepair))),
  );

  _golden(
    'milestone_first_week',
    () => _onGround(CelebrationMoment(celebration: momentOf(firstWeek))),
  );

  _golden(
    'empty_all_clear',
    () => const StateView(
      kind: StateViewKind.empty,
      scene: StateScene.allClear,
      title: 'Nothing waiting to repair',
      message: "Every mistake you've found is repaired.",
    ),
  );

  _golden(
    'empty_offline',
    () => StateView(
      kind: StateViewKind.offline,
      title: 'You are offline',
      message: 'Your answers stay on this phone and go when you are back.',
      primary: StateAction('Try again', () {}),
    ),
  );
}
