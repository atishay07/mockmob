// I12 (owner, 19 Oct): "CUET UG 2027, Commerce" was shown to a science student (B.Sc. Physical Science
// with Computer Science; Physics, Chemistry, Biology, Computer Science, Mathematics). Every stream or
// course label now comes from the student's own course and subjects, and says no stream at all when
// the student has not chosen any.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/tools/colleges/colleges_copy.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/data/student_target.dart';
import 'package:mockmob/features/you/data/subject_catalog.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

const _science = ['physics', 'chemistry', 'biology', 'computer_science', 'mathematics'];
const _scienceCourse = 'B.Sc (Prog) Physical Science with Computer Science';

const _scienceStudent = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u2',
  email: 'atishay@example.com',
  name: 'Atishay',
  subjects: _science,
);

void main() {
  group('the stream word comes from the subjects', () {
    test('one stream, mixed, or none', () {
      expect(streamWordFor(_science), 'Science');
      expect(streamWordFor(['accountancy', 'business_studies', 'economics', 'english']), 'Commerce');
      expect(streamWordFor(['history', 'political_science', 'economics']), 'Humanities');
      expect(streamWordFor(['physics', 'accountancy']), 'Mixed subjects');
      expect(streamWordFor(const []), isNull, reason: 'no subjects yet: no stream word');
      expect(streamWordFor(['english', 'mathematics', 'economics', 'general_test']), isNull, reason: 'every stream takes these');
    });

    test('the sheet overline: the course, else the stream, else the exam alone', () {
      expect(YouCopy.sheetOverlineFor(2027, course: _scienceCourse, stream: 'Science'), 'CUET UG 2027, $_scienceCourse');
      expect(YouCopy.sheetOverlineFor(2027, stream: 'Science'), 'CUET UG 2027, Science');
      expect(YouCopy.sheetOverlineFor(2028), 'CUET UG 2028');
      expect(YouCopy.sheetOverlineFor(2027, course: '  '), 'CUET UG 2027');
    });

    test('no line says Commerce to every student', () {
      for (final line in [YouCopy.helpAboutLine, ChoicesCopy.courseSupport, OnboardingCopy.courseSupport, CollegesCopy.sampleNote]) {
        expect(line.toLowerCase(), isNot(contains('commerce')), reason: line);
        expect(line, isNot(contains('B.Com')), reason: line);
      }
    });
  });

  group('You for a science student', () {
    testWidgets('the overline names the B.Sc course, never Commerce', (tester) async {
      await pumpMockmob(
        tester,
        const YouHubScreen(),
        disableAnimations: true,
        wrapInScaffold: false,
        size: const Size(360, 2400),
        overrides: youOverrides(auth: _scienceStudent, target: const StudentTarget(course: _scienceCourse)),
      );
      await tester.pump();
      expect(find.text('CUET UG 2027, $_scienceCourse'), findsOneWidget);
      expect(find.textContaining('CUET UG 2027, Commerce'), findsNothing);
    });

    testWidgets('no course yet: the stream from the subjects', (tester) async {
      await pumpMockmob(
        tester,
        const YouHubScreen(),
        disableAnimations: true,
        wrapInScaffold: false,
        size: const Size(360, 2400),
        overrides: youOverrides(auth: _scienceStudent, target: StudentTarget.none),
      );
      await tester.pump();
      expect(find.text('CUET UG 2027, Science'), findsOneWidget);
    });
  });
}
