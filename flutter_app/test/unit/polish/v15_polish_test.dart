// v15 polish (owner, 17 Oct night: N3, N5, N6, N9; v13 walk findings): one sliding indicator, one
// CUET subject maximum, the stem printed once, nothing floating over content.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/cuet_rules.dart';
import 'package:mockmob/core/models/models.dart' show distinctBody;
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart' show kMaxSubjects;
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/you/data/profile_editor.dart' show kMaxProfileSubjects;
import 'package:mockmob/features/you/edit_copy.dart';

import '../../helpers/golden_harness.dart';

/// The offset, in slots, of the one thumb of a segmented control.
double _thumbSlots(WidgetTester tester) {
  final moves = find.descendant(of: find.byType(MmSlidingIndicator), matching: find.byType(FractionalTranslation));
  expect(moves, findsOneWidget, reason: 'one indicator, one transform');
  return tester.widget<FractionalTranslation>(moves).translation.dx;
}

Widget _control(String value, ValueChanged<String> on) => Center(
      child: SizedBox(
        width: 320,
        child: MmSegmented<String>(
          segments: const [MmSegment('a', 'Easy'), MmSegment('b', 'Medium'), MmSegment('c', 'Hard'), MmSegment('d', 'Mixed')],
          value: value,
          onChanged: on,
          semanticsLabel: 'Difficulty',
        ),
      ),
    );

void main() {
  group('N5: every segmented control has ONE indicator that slides from the old option to the new', () {
    testWidgets('a change slides the single thumb in 220 ms, ease out, with no second box', (tester) async {
      var value = 'a';
      late StateSetter set;
      await pumpMockmob(tester, StatefulBuilder(builder: (context, setState) {
        set = setState;
        return _control(value, (v) => setState(() => value = v));
      }));
      expect(_thumbSlots(tester), 0);
      expect(find.byType(MmSlidingIndicator), findsOneWidget);

      set(() => value = 'c');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 110));
      final mid = _thumbSlots(tester);
      // Ease out: past the half way point at half the time, and not arrived yet.
      expect(mid, greaterThan(1.0));
      expect(mid, lessThan(2.0));
      await tester.pump(const Duration(milliseconds: 120));
      expect(_thumbSlots(tester), 2);
      expect(MmSlidingIndicator.duration, const Duration(milliseconds: 220));
    });

    testWidgets('a second tap mid-slide carries on from where the thumb is (never snaps back)', (tester) async {
      var value = 'a';
      late StateSetter set;
      await pumpMockmob(tester, StatefulBuilder(builder: (context, setState) {
        set = setState;
        return _control(value, (v) => setState(() => value = v));
      }));
      set(() => value = 'd');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      final before = _thumbSlots(tester);
      expect(before, greaterThan(0));
      set(() => value = 'b');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      // It started from where it was (past 0) and heads for slot 1 without jumping to either end.
      expect(_thumbSlots(tester), greaterThan(0));
      await tester.pump(const Duration(milliseconds: 300));
      expect(_thumbSlots(tester), 1);
    });

    testWidgets('reduced motion: the thumb is there at once', (tester) async {
      var value = 'a';
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(builder: (context, setState) {
          set = setState;
          return _control(value, (v) => setState(() => value = v));
        }),
        disableAnimations: true,
      );
      set(() => value = 'd');
      await tester.pump();
      expect(_thumbSlots(tester), 3);
    });
  });

  group('N9: Ask Mobi opens over the page and closes with a clear mark', () {
    testWidgets('a closing header shows a close key, not a back arrow', (tester) async {
      await pumpMockmob(tester, const Align(alignment: Alignment.topCenter, child: MmPageHeader(title: 'Ask Mobi', closes: true)));
      expect(find.bySemanticsLabel('Close'), findsOneWidget);
      expect(find.bySemanticsLabel('Back'), findsNothing);
    });
  });

  group('N6: one CUET subject maximum, five, languages and the General Test included', () {
    test('every picker shares it', () {
      expect(kCuetMaxSubjects, 5);
      expect(kMaxSubjects, kCuetMaxSubjects);
      expect(kMaxProfileSubjects, kCuetMaxSubjects);
    });

    test('the copy says the same number and why', () {
      expect(OnboardingCopy.fiveMax, contains('CUET'));
      expect(OnboardingCopy.pickerCount(0), contains('five'));
      expect(OnboardingCopy.pickerCount(0), contains('General Test'));
      expect(OnboardingCopy.pickerCount(3), '3 of 5 on your sheet.');
      expect(EditCopy.subjectsCount(4), '4 of 5 chosen');
      expect(EditCopy.subjectsCap, contains('CUET'));
      expect(EditCopy.subjectsHint, contains('Pick up to 5'));
      expect(kCuetRuleNote, contains('General Test'));
    });
  });

  group('N3: the fine-tune line is trust, not a shrug', () {
    test('NTA mode says it is built the NTA way and nothing needs choosing', () {
      expect(PracticeCopy.fineTuneNta, "We build it exactly the NTA way. You don't need to choose anything.");
    });

    test('Smart practice says nothing needs choosing, and does not claim the NTA mix', () {
      expect(PracticeCopy.fineTuneSmart, endsWith("You don't need to choose anything."));
      expect(PracticeCopy.fineTuneSmart, isNot(contains('NTA')));
    });
  });

  group('finding 1: the question stem prints once', () {
    test('a body that opens with the stem and adds something prints only the addition', () {
      expect(distinctBody('Which entry is made?', 'Which entry is made? Assume a 10 rupee share.'), 'Assume a 10 rupee share.');
      expect(distinctBody('Which  entry is MADE?', 'which entry is made?\n\nTake the issue price as 12.'), 'Take the issue price as 12.');
    });

    test('a body that only restates the stem prints nothing', () {
      expect(distinctBody('A firm decides. Which area?', 'A firm decides. Which area?'), isNull);
      expect(distinctBody('A firm decides. Which area?', 'A firm decides. Which area?  '), isNull);
    });

    test('a different body stays whole', () {
      expect(distinctBody('Which entry is made?', 'Assume a 10 rupee share.'), 'Assume a 10 rupee share.');
    });
  });

  group('finding 7: one notice', () {
    test('the Review tab hides the marked pill (it has its own card); other tabs keep it', () {
      const marked = BarMarked(attemptId: 'a1', paper: 'Mock 5', subject: 'Business Studies');
      expect(visibleLive(marked, dismissed: const {}, todayCovers: const {}, onToday: false, onReview: true), isNull);
      expect(visibleLive(marked, dismissed: const {}, todayCovers: const {}, onToday: false), marked);
    });
  });
}
