import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/steps/save_step.dart' show SaveView;
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/core/theme/theme.dart';

import 'support.dart';

Widget _flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

/// The after-sign-in sheet body, framed like the glass sheet over a dark Today.
Widget _sheet(Widget body) => Builder(
      builder: (context) => Align(
        alignment: Alignment.bottomCenter,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: context.mmColors.raised,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
          ),
          child: Padding(padding: const EdgeInsets.fromLTRB(20, 28, 20, 40), child: body),
        ),
      ),
    );

void main() {
  onboardingGolden('welcome', () => const OnboardingFlow(skipColdOpen: true));
  onboardingGolden(
    'welcome_late_night',
    () => const OnboardingFlow(skipColdOpen: true),
    overrides: () => onboardingOverrides(now: DateTime(2026, 10, 13, 23, 40)),
  );
  onboardingGolden(
    'welcome_return',
    () => const OnboardingFlow(skipColdOpen: true),
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects, step: Steps.worry)),
  );

  onboardingGolden('stage_empty', _flow, overrides: () => onboardingOverrides(answers: const OnboardingAnswers(step: Steps.stage)));
  onboardingGolden('stage_class12', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage)));

  onboardingGolden(
    'course_grid',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)),
  );
  onboardingGolden('course_ladder', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.course)));

  onboardingGolden(
    'subjects',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)),
  );
  onboardingGolden(
    'subjects_needs_maths',
    _flow,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.subjects).copyWith(courseId: 'b-a-hons-economics', colleges: const []),
    ),
  );

  onboardingGolden('worry', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.worry)));

  onboardingGolden(
    'question_open',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.worry, step: Steps.question)),
  );
  onboardingGolden('question_right', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.question)));
  onboardingGolden(
    'question_wrong',
    _flow,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.question).copyWith(
        warmup: const WarmupResult(questionId: 'acc-1', chosen: 1, correct: false, millis: 52000),
      ),
    ),
  );

  onboardingGolden('rhythm', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.rhythm)));

  onboardingGolden(
    'plan',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)),
  );
  onboardingGolden('plan_sealed', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan)));

  onboardingGolden(
    'save',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save)),
  );
  onboardingGolden(
    'save_ready',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
  );

  // Google handed over to the browser: what to do there, and a way to stop waiting.
  onboardingGolden(
    'save_in_browser',
    () => SaveView(age: AgeAnswer.adult, onAge: (_) {}, onGoogle: () {}, onEmail: () {}, onNotNow: () {}, googleInBrowser: true, onCancelBrowser: () {}),
  );

  onboardingGolden(
    'first_move',
    _flow,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(age: AgeAnswer.minor, notNow: true),
    ),
  );

  // None of the subjects has a starting-point check: the first move is plain practice, said so.
  onboardingGolden(
    'first_move_practice',
    _flow,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(
        age: AgeAnswer.minor,
        notNow: true,
        subjects: const [SheetSubject.physics, SheetSubject.chemistry, SheetSubject.mathematics],
        confidence: const {SheetSubject.physics: Confidence.shaky},
      ),
    ),
  );

  onboardingGolden(
    'after_sign_in_saving',
    () => _sheet(SheetSavedView(phase: SheetSyncPhase.saving, startLabel: 'Start now, about 10 minutes', laterLabel: 'Tomorrow at 8:00 PM', onStart: () {}, onLater: () {}, onRetry: () {}, onToggleUsage: (_) {}, onToggleEvents: () {}, onDone: () {})),
  );
  onboardingGolden(
    'after_sign_in_saved',
    () => _sheet(SheetSavedView(
      phase: SheetSyncPhase.saved,
      showUsage: true,
      startLabel: 'Start now, about 10 minutes',
      laterLabel: 'Tomorrow at 8:00 PM',
      onStart: () {},
      onLater: () {},
      onRetry: () {},
      onToggleUsage: (_) {},
      onToggleEvents: () {},
      onDone: () {},
    )),
  );
  onboardingGolden(
    'after_sign_in_failed',
    () => _sheet(SheetSavedView(phase: SheetSyncPhase.failed, offline: true, onRetry: () {}, onToggleUsage: (_) {}, onToggleEvents: () {}, onDone: () {})),
  );

  // The small phone (360 by 780) and large text (1.3x), where line breaks and overflow show first.
  const small = Size(360, 780);
  onboardingGolden('small_welcome', () => const OnboardingFlow(skipColdOpen: true), size: small);
  onboardingGolden('small_ladder', _flow, size: small, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.course)));
  onboardingGolden('small_plan_sealed', _flow, size: small, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan)));
  onboardingGolden(
    'small_save_ready',
    _flow,
    size: small,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
  );
  onboardingGolden('large_text_stage', _flow, textScale: 1.3, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage)));
  onboardingGolden('large_text_subjects', _flow, textScale: 1.3, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)));
  onboardingGolden(
    'large_text_first_move',
    _flow,
    textScale: 1.3,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(age: AgeAnswer.minor, notNow: true),
    ),
  );

  // The full subject list: search, the groups, and what CUET has that MockMob does not offer.
  Future<void> openPicker(WidgetTester tester) async {
    final add = find.text(OnboardingCopy.addSubject).first;
    await tester.ensureVisible(add);
    await tester.pump();
    await tester.tap(add);
    await tester.pumpAndSettle();
  }

  onboardingGolden('picker_open', _flow, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)), act: openPicker, withOverlays: true);
  onboardingGolden(
    'picker_not_offered',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)),
    act: (tester) async {
      await openPicker(tester);
      // The sheet's own list is the last scrollable; bring the not-offered block to the top.
      await tester.scrollUntilVisible(
        find.text(OnboardingCopy.languagesLabel),
        300,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.pumpAndSettle();
    },
    withOverlays: true,
  );
  onboardingGolden(
    'picker_search',
    _flow,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)),
    act: (tester) async {
      await openPicker(tester);
      await tester.enterText(find.byType(TextField), 'his');
      await tester.pumpAndSettle();
    },
    withOverlays: true,
  );

  // The shortest phone the app supports (360 by 640) and a tall one (430 by 950).
  const tiny = Size(360, 640);
  const tall = Size(430, 950);
  onboardingGolden('tiny_welcome', () => const OnboardingFlow(skipColdOpen: true), size: tiny);
  onboardingGolden('tiny_subjects', _flow, size: tiny, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)));
  onboardingGolden(
    'tiny_save_ready',
    _flow,
    size: tiny,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
  );
  onboardingGolden('tall_welcome', () => const OnboardingFlow(skipColdOpen: true), size: tall);
  onboardingGolden(
    'tall_save_ready',
    _flow,
    size: tall,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
  );
}
