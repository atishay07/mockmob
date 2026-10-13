// Goldens for You's editors (owner feedback 11-10, "there is no option to edit subject"): the
// sheet editor, the subjects editor in its states, the account with the plan card, and the name
// sheet. 384 by 853 logical px at DPR 2, Night and Daylight; long pages use a taller frame.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart' show Confidence;
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/data/student_target.dart';
import 'package:mockmob/features/you/sheet/sheet_editor_screen.dart';
import 'package:mockmob/features/you/subjects/subjects_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../unit/you/you_test_support.dart';
import 'you_golden_kit.dart';

/// Everything setup asked, answered.
const fullTarget = StudentTarget(
  course: 'B.Com (Hons)',
  courseId: 'bcom_hons',
  colleges: ['Shri Ram College of Commerce', 'Hansraj College', 'Kirori Mal College'],
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
  stage: Stage.classTwelve,
  worry: Worry.numericals,
  confidence: {'accountancy': Confidence.shaky, 'economics': Confidence.okay, 'english': Confidence.strong},
  week: StudentWeek(days: {0, 1, 3, 5}, window: StudyTime.evening, minutes: 20),
);

const _freeUser = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
  creditBalance: 40,
);

MockApi _patchApi({Object? error}) {
  final api = MockApi();
  when(() => api.patch(any(), body: any(named: 'body'))).thenAnswer((invocation) async {
    if (error != null) throw error;
    final body = invocation.namedArguments[#body] as Map<String, Object?>;
    return ApiResponse(200, {'id': 'u1', ...body});
  });
  return api;
}

Future<void> _tapText(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text).first);
  await tester.pump();
  await tester.tap(find.text(text).first);
  await tester.pump();
}

void main() {
  setUpGoldenFonts();

  sheetGolden(
    'sheet_editor',
    () => const SheetEditorScreen(),
    size: const Size(384, 1640),
    overrides: () => youOverrides(target: fullTarget),
  );

  sheetGolden('subjects', () => const SubjectsScreen(), overrides: () => youOverrides(target: fullTarget));

  sheetGolden(
    'subjects_full_page',
    () => const SubjectsScreen(),
    size: const Size(384, 1600),
    overrides: () => youOverrides(
      fakeAuth: FakeAuth(
        const AuthSnapshot(
          status: AuthStatus.signedIn,
          userId: 'u1',
          name: 'Asha Verma',
          subjects: ['accountancy', 'economics', 'english', 'entrepreneurship'],
        ),
      ),
    ),
  );

  // A fifth subject chosen, then a sixth refused: Mobi shrugs and the footer says why.
  sheetGolden(
    'subjects_cap',
    () => const SubjectsScreen(),
    overrides: () => youOverrides(target: fullTarget),
    interact: (tester) async {
      await _tapText(tester, 'General Test');
      await _tapText(tester, 'Mathematics');
      await tester.pump(const Duration(seconds: 2));
    },
  );

  // Saved only after the server answered: the receipt, and Mobi cheers.
  sheetGolden(
    'subjects_saved',
    () => const SubjectsScreen(),
    overrides: () => youOverrides(target: fullTarget, api: _patchApi()),
    interact: (tester) async {
      await _tapText(tester, 'General Test');
      await tester.tap(find.text('Save subjects'));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));
    },
  );

  sheetGolden(
    'subjects_failed',
    () => const SubjectsScreen(),
    overrides: () => youOverrides(target: fullTarget, api: _patchApi(error: offlineError())),
    interact: (tester) async {
      await _tapText(tester, 'General Test');
      await tester.tap(find.text('Save subjects'));
      await tester.pump();
      await tester.pump();
    },
  );

  sheetGolden(
    'account_free',
    () => const AccountScreen(),
    size: const Size(384, 980),
    overrides: () => youOverrides(fakeAuth: FakeAuth(_freeUser)),
  );

  sheetGolden(
    'name_sheet',
    () => const AccountScreen(),
    overrides: () => youOverrides(fakeAuth: FakeAuth(_freeUser), api: _patchApi()),
    interact: (tester) async {
      await tester.tap(find.text('Asha Verma'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Asha V.');
      await tester.pump();
    },
  );
}
