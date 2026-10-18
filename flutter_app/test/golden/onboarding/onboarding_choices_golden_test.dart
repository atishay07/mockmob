import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/colleges_move.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/onboarding/widgets/course_list_sheet.dart';

import 'support.dart';

/// The owner's 18 Oct notes on the onboarding choices (D41, D42, D45, D46, D47, D49), on his
/// phone's size (a 20:9 Android, about 360 by 800 dp) and at 390 by 844, Night and Day.
Widget _flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

const Size _phone360 = Size(360, 800);
const Size _phone390 = Size(390, 844);
const Map<String, Size> _sizes = {'360': _phone360, '390': _phone390};

OnboardingAnswers _notSure(String step) => studentUpTo(Steps.stage, step: step).copyWith(courseUndecided: true).mark(Steps.course);

Future<void> _scrollTo(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  for (final e in _sizes.entries) {
    final size = e.value;
    final tag = e.key;

    // D41, G4: in order of aspirant demand, each with its Bulletin combination; More courses under them.
    onboardingGolden('choices_course_$tag', _flow, size: size, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)));
    onboardingGolden(
      'choices_course_more_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)),
      act: (tester) => _scrollTo(tester, find.text(ChoicesCopy.moreCourses)),
    );

    // D42: "Not sure yet" assumes nothing: Add a subject leads, the sets wait for a tap.
    onboardingGolden('choices_subjects_open_$tag', _flow, size: size, overrides: () => onboardingOverrides(answers: _notSure(Steps.subjects)));

    // D45: three picks, each with its place.
    onboardingGolden(
      'choices_worry_three_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(
        answers: studentUpTo(Steps.subjects, step: Steps.worry).copyWith(worries: const [Worry.time, Worry.numericals, Worry.passages]).mark(Steps.worry),
      ),
    );

    // D46, D47: the pace step's top, then scrolled to the readout and the runway.
    onboardingGolden('choices_rhythm_$tag', _flow, size: size, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.question, step: Steps.rhythm)));
    onboardingGolden(
      'choices_rhythm_runway_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.question, step: Steps.rhythm)),
      act: (tester) => _scrollTo(tester, find.textContaining(ChoicesCopy.weeksLeft)),
    );

    // D49: an adult's usage switch on by default, with where to turn it off.
    onboardingGolden(
      'choices_usage_on_$tag',
      () => Builder(
        builder: (context) => Align(
          alignment: Alignment.bottomCenter,
          child: DecoratedBox(
            decoration: BoxDecoration(color: context.mmColors.raised, borderRadius: const BorderRadius.vertical(top: Radius.circular(32))),
            child: SizedBox(
              width: double.infinity,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 40),
                child: SheetSavedView(
                  phase: SheetSyncPhase.saved,
                  colleges: CollegesMove.moved,
                  showUsage: true,
                  usageOn: true,
                  startLabel: 'Start now, about 10 minutes',
                  laterLabel: 'Tomorrow at 8:00 PM',
                  onStart: () {},
                  onLater: () {},
                  onRetry: () {},
                  onToggleUsage: (_) {},
                  onToggleEvents: () {},
                  onDone: () {},
                ),
              ),
            ),
          ),
        ),
      ),
      size: size,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
    );
  }

  // 360 only: BMS ticks only what it needs, labelled; and the full course list, searched.
  onboardingGolden(
    'choices_subjects_bms_360',
    _flow,
    size: _phone360,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.stage, step: Steps.subjects).copyWith(courseId: 'bachelor-of-management-studies-bms').mark(Steps.course),
    ),
  );
  onboardingGolden(
    'choices_course_list_360',
    () => Builder(
      builder: (context) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
        child: CourseList(selected: 'b-com-hons', onPick: (_) {}),
      ),
    ),
    size: _phone360,
  );
}
