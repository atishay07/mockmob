import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/colleges_move.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

import 'support.dart';

Widget _flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

/// The after-sign-in sheet body, framed like the glass sheet over the screen the student just
/// left: that screen (the save step) stays visible under the scrim, as it does in the app.
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

/// A sign-in that is waiting on the browser (Google handed over), for the save step's golden.
class _InBrowserSignIn extends SignInController {
  @override
  SignInState build() => super.build().copyWith(googleInBrowser: true);
}

List<Override> _saveOverrides({bool inBrowser = false}) => [
      ...onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
      if (inBrowser) signInControllerProvider.overrideWith(_InBrowserSignIn.new),
    ];

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

  // The Aim step at 390 dp: "Find a college" with a search typed, and eight picks at the limit.
  const phone390 = Size(390, 844);
  // Every step with a pinned key at 390 dp: the scroll body stands clear of the key (L28).
  onboardingGolden('course_grid_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)));
  onboardingGolden('course_ladder_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.course)));
  onboardingGolden('subjects_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.subjects)));
  onboardingGolden('rhythm_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.rhythm)));
  onboardingGolden('plan_sealed_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan)));
  // The steps that share the pill row and the pinned key, at 390 dp (the pill label is never cut).
  onboardingGolden('welcome_390', () => const OnboardingFlow(skipColdOpen: true), size: phone390);
  onboardingGolden('stage_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage)));
  onboardingGolden('worry_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.worry)));
  onboardingGolden('question_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.worry, step: Steps.question)));
  onboardingGolden(
    'first_move_390',
    _flow,
    size: phone390,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(age: AgeAnswer.minor, notNow: true)),
  );
  // The save step at 390 dp: the quiet line about the live question bank sits under the sheet.
  onboardingGolden('save_ready_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)));
  // The count could not be read: the same line, without the number.
  onboardingGolden('save_nobank_390', _flow, size: phone390, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult), bank: null));
  onboardingGolden(
    'course_ladder_search',
    _flow,
    size: phone390,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.course).copyWith(colleges: const ['Shri Ram College of Commerce']),
    ),
    act: (tester) async {
      await tester.enterText(find.byType(TextField), 'hansrj');
      await tester.pumpAndSettle();
    },
  );
  final eight = [for (final o in DuCatalog.course('b-com-hons')!.ladder('UR').take(8)) o.college];
  onboardingGolden(
    'course_ladder_eight',
    _flow,
    size: phone390,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.course).copyWith(colleges: eight)),
    act: (tester) async {
      // The end of the scroll: the last control stands fully clear of the pinned key.
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -900));
      await tester.pumpAndSettle();
    },
  );
  // Keyboard open on a 360 by 800 phone (the keyboard is 300 dp): the field and rungs stay above it,
  // the key and the sheet strip step aside.
  onboardingGolden(
    'course_ladder_keyboard',
    _flow,
    size: const Size(360, 800),
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.course).copyWith(colleges: const [])),
    act: (tester) async {
      await tester.tap(find.byType(TextField));
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: 600);
      addTearDown(tester.view.resetViewInsets);
      await tester.enterText(find.byType(TextField), 'ram');
      await tester.pumpAndSettle();
    },
  );

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

  // Google handed over to the browser: what to do there, and a way to stop waiting. Rendered in
  // the flow, so it has the same gutters, back arrow and Mobi as the ready state above.
  onboardingGolden('save_in_browser', _flow, overrides: () => _saveOverrides(inBrowser: true));

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
    overrides: _saveOverrides,
  );
  onboardingGolden(
    'after_sign_in_saved',
    () => _sheet(SheetSavedView(
      phase: SheetSyncPhase.saved,
      colleges: CollegesMove.moved,
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
    overrides: _saveOverrides,
  );
  // The colleges could not move yet: the line says so, and claims nothing else.
  onboardingGolden(
    'after_sign_in_colleges_later',
    () => _sheet(SheetSavedView(
      phase: SheetSyncPhase.saved,
      colleges: CollegesMove.later,
      startLabel: 'Start now, about 10 minutes',
      laterLabel: 'Tomorrow at 8:00 PM',
      onStart: () {},
      onLater: () {},
      onRetry: () {},
      onToggleUsage: (_) {},
      onToggleEvents: () {},
      onDone: () {},
    )),
    overrides: _saveOverrides,
  );
  onboardingGolden(
    'after_sign_in_saved_390',
    () => _sheet(SheetSavedView(
      phase: SheetSyncPhase.saved,
      colleges: CollegesMove.moved,
      startLabel: 'Start now, about 10 minutes',
      laterLabel: 'Tomorrow at 8:00 PM',
      onStart: () {},
      onLater: () {},
      onRetry: () {},
      onToggleUsage: (_) {},
      onToggleEvents: () {},
      onDone: () {},
    )),
    size: phone390,
    overrides: _saveOverrides,
  );
  onboardingGolden(
    'after_sign_in_failed',
    () => _sheet(SheetSavedView(phase: SheetSyncPhase.failed, offline: true, onRetry: () {}, onToggleUsage: (_) {}, onToggleEvents: () {}, onDone: () {})),
    overrides: _saveOverrides,
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
  // At 1.3x the first move scrolls; the golden is taken at the end of the scroll, to show the
  // week strip is fully reachable (dates and "Today" whole, clear of the foot).
  onboardingGolden(
    'large_text_first_move',
    _flow,
    textScale: 1.3,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(age: AgeAnswer.minor, notNow: true),
    ),
    act: (tester) async {
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -900));
      await tester.pumpAndSettle();
    },
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
