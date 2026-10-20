// Goldens for the after-sign-in sheet of a student who signed straight in (D183, owner 20 Oct 2026): "Are you 18
// or older?" with the note that usage data is on unless they say under 18, and the usage-data step that follows
// "Prefer not to say" (on by default, like 18 or older). 360 dp wide, Night and Day, at 1x and 1.3x text. And the save
// step's own note under the age question, one short line (D185), on a 360 by 640 phone at 1x and 1.3x text.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';

import 'support.dart';

/// The sheet body over the screen the student just left, as the app shows it.
Widget _sheet(Widget body) => Builder(
      builder: (context) => Stack(
        children: [
          const Positioned.fill(child: OnboardingFlow(skipColdOpen: true, startInDeck: true)),
          Positioned.fill(child: ColoredBox(color: context.mmColors.sheetScrim)),
          Align(
            alignment: Alignment.bottomCenter,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: context.mmColors.raised,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: Padding(padding: const EdgeInsets.fromLTRB(20, 28, 20, 40), child: body),
              ),
            ),
          ),
        ],
      ),
    );

void main() {
  const phone = Size(360, 780);
  // The save step stays visible under the scrim, as it does in the app.
  List<Override> saveStep() => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.ratherNot));
  for (final scale in const [1.0, 1.3]) {
    final suffix = scale == 1 ? '360' : '360_text130';
    onboardingGolden(
      'after_sign_in_age_$suffix',
      () => _sheet(AgeThenUsageView(usageStep: false, onAnswerAge: (_) {}, onSkip: () {}, onToggleUsage: (_) {}, onToggleEvents: () {}, onDone: () {})),
      size: phone,
      textScale: scale,
      overrides: saveStep,
    );
    onboardingGolden(
      'save_age_note_360x640${scale == 1 ? '' : '_text130'}',
      () => const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      size: const Size(360, 640),
      textScale: scale,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save)),
    );
    onboardingGolden(
      'after_sign_in_usage_not_say_$suffix',
      () => _sheet(
        AgeThenUsageView(usageStep: true, usageOn: true, savingAge: null, onAnswerAge: (_) {}, onSkip: () {}, onToggleUsage: (_) {}, onToggleEvents: () {}, onDone: () {}),
      ),
      size: phone,
      textScale: scale,
      overrides: saveStep,
    );
  }
}

