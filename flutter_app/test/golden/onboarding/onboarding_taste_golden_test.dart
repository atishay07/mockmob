import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/data/subject_sets.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/state/colleges_move.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/onboarding/widgets/swipe_preview.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';

import 'support.dart';

/// The v15 taste pass (owner, 18 Oct 7:40 pm, D89-D90; OWNER-TASTE-PROFILE.md), on the owner's
/// phone (360 by 800) and a tall 412 by 915, Night and Day, and at 1.3x text.
Widget _flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

const Map<String, Size> _sizes = {'360': Size(360, 800), '412': Size(412, 915)};

OnboardingAnswers _notSure(String step) => studentUpTo(Steps.stage, step: step).copyWith(courseUndecided: true).mark(Steps.course);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

/// The sheet after sign-in, saved, as the student sees it on a first install.
Widget _savedSheet() => Builder(
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
                startTitle: 'Your starting point',
                startLabel: 'Start now, about 10 minutes',
                laterLabel: 'Tomorrow at 8:00 PM',
                onStart: () {},
                onLater: () {},
                onRetry: () {},
                onToggleUsage: (_) {},
                onToggleEvents: () {},
                onDone: () {},
                showSwipePreview: true,
                swipeDemo: false,
              ),
            ),
          ),
        ),
      ),
    );

/// Holds the preview card [dx] dp off home (the frame a nudge or a drag passes through).
Future<void> _holdPreview(WidgetTester tester, double dx) async {
  final g = await tester.startGesture(tester.getCenter(find.byType(SwipePreviewCard)) - const Offset(0, 20));
  await g.moveBy(Offset(dx.sign * 20, 0));
  await g.moveBy(Offset(dx - dx.sign * 20, 0));
  await tester.pump();
}

void main() {
  for (final e in _sizes.entries) {
    // Subjects: a set tap brings the ratings up under the chosen set; the other sets fold.
    onboardingGolden(
      'taste_subjects_set_${e.key}',
      _flow,
      size: e.value,
      overrides: () => onboardingOverrides(answers: _notSure(Steps.subjects)),
      act: (tester) => _tap(tester, find.text(SubjectSets.commerce.title)),
    );
    // After sign-in: the swipe preview at rest, and held where it shows each side's meaning.
    onboardingGolden('taste_swipe_preview_${e.key}', _savedSheet, size: e.value, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.minor)));
    onboardingGolden(
      'taste_swipe_preview_right_${e.key}',
      _savedSheet,
      size: e.value,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.minor)),
      act: (tester) => _holdPreview(tester, 24),
    );
    onboardingGolden(
      'taste_swipe_preview_left_${e.key}',
      _savedSheet,
      size: e.value,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.minor)),
      act: (tester) => _holdPreview(tester, -110),
    );
    // Stage: short titles, the tick clear of them, the caption the only year.
    onboardingGolden('taste_stage_${e.key}', _flow, size: e.value, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage)));
    // Marks: a fourth pick replaces the Third and Mobi names it.
    onboardingGolden(
      'taste_worry_swap_${e.key}',
      _flow,
      size: e.value,
      overrides: () => onboardingOverrides(
        answers: studentUpTo(Steps.subjects, step: Steps.worry).copyWith(worries: const [Worry.knewIt, Worry.passages, Worry.time]).mark(Steps.worry),
      ),
      act: (tester) => _tap(tester, find.text(Worry.syllabus.option)),
    );
    // Save: the keys at full strength before the age; the age answers as tiles.
    onboardingGolden('taste_save_ask_${e.key}', _flow, size: e.value, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save)));
  }
  onboardingGolden(
    'taste_save_ask_large_text',
    _flow,
    size: _sizes['360']!,
    textScale: 1.3,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save)),
  );
  onboardingGolden(
    'taste_swipe_preview_large_text',
    _savedSheet,
    size: _sizes['360']!,
    textScale: 1.3,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.minor)),
  );
  onboardingGolden('taste_stage_large_text', _flow, size: _sizes['360']!, textScale: 1.3, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage)));
  onboardingGolden(
    'taste_subjects_set_large_text',
    _flow,
    size: _sizes['360']!,
    textScale: 1.3,
    overrides: () => onboardingOverrides(answers: _notSure(Steps.subjects)),
    act: (tester) => _tap(tester, find.text(SubjectSets.commerce.title)),
  );
}
