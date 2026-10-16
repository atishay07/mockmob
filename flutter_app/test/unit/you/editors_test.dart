// You's editors: the hub opens them, subjects save only after the server answered, the sixth
// subject is refused, the name sheet patches the profile, the plan card reads the balance, and
// the usual length follows the study preferences' revision.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/onboarding/model/choices.dart' show Stage;
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/data/study_length.dart';
import 'package:mockmob/features/you/sheet/sheet_editor_screen.dart';
import 'package:mockmob/features/you/subjects/subjects_screen.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

const _user = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
  creditBalance: 40,
);

MockApi _api({Object? error}) {
  final api = MockApi();
  when(() => api.patch(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((invocation) async {
    if (error != null) throw error;
    final body = invocation.namedArguments[#body] as Map<String, Object?>;
    return ApiResponse(200, {'id': 'u1', ...body});
  });
  return api;
}

Future<void> _pump(WidgetTester tester, Widget screen, {MockApi? api, FakeAuth? auth, double height = 1400}) => pumpMockmob(
      tester,
      screen,
      wrapInScaffold: false,
      disableAnimations: true,
      size: Size(384, height),
      overrides: youOverrides(fakeAuth: auth ?? FakeAuth(_user), api: api),
    );

Future<void> _tap(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text).first);
  await tester.pump();
  await tester.tap(find.text(text).first);
  await tester.pump();
}

void main() {
  group('hub', () {
    testWidgets('Edit opens the sheet editor', (tester) async {
      await _pump(tester, const YouHubScreen(), height: 6000);
      await tester.tap(find.bySemanticsLabel('Edit your profile'));
      await tester.pumpAndSettle();
      expect(find.byType(SheetEditorScreen), findsOneWidget);
    });

    testWidgets('the subjects field opens the subjects editor', (tester) async {
      await _pump(tester, const YouHubScreen(), height: 6000);
      await tester.tap(find.bySemanticsLabel(RegExp('^Edit subjects')));
      await tester.pumpAndSettle();
      expect(find.byType(SubjectsScreen), findsOneWidget);
    });

    testWidgets('Plan and credits shows both balances, each named for its pool', (tester) async {
      await _pump(tester, const YouHubScreen(), height: 6000);
      expect(find.bySemanticsLabel(RegExp(r'^Practice credits, 38\. For mocks and practice sets')), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'^AI credits, 8\. For Ask Mobi and repair explanations')), findsOneWidget);
    });

    testWidgets('a tools slot replaces the website rows', (tester) async {
      await _pump(tester, const YouHubScreen(tools: Text('tools shelf')), height: 6000);
      await tester.dragUntilVisible(find.text('tools shelf'), find.byType(ListView), const Offset(0, -300));
      expect(find.text('tools shelf'), findsOneWidget);
      expect(find.text('Combo Planner'), findsNothing);
    });
  });

  group('sheet', () {
    testWidgets('where you are is kept on the phone sheet', (tester) async {
      await _pump(tester, const SheetEditorScreen());
      await tester.tap(find.text('Where you are'));
      await tester.pumpAndSettle();
      expect(find.text('Kept on this phone.'), findsOneWidget);
      await tester.tap(find.text(Stage.classEleven.option));
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(tester.element(find.byType(SheetEditorScreen)));
      expect(container.read(onboardingAnswersProvider).value?.stage, Stage.classEleven);
    });

    testWidgets('the study times sit in a 2 by 2 grid of equal pills', (tester) async {
      await _pump(tester, const SheetEditorScreen());
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Late, 10:00 PM'), 300, scrollable: find.byType(Scrollable).first);
      await tester.pump();
      const early = 'Early, 6:00 AM';
      const afternoon = 'Afternoon, 5:00 PM';
      const evening = 'Evening, 8:00 PM';
      const late = 'Late, 10:00 PM';
      Offset at(String label) => tester.getTopLeft(find.text(label));
      // Two columns: the first pills line up, so do the second.
      expect(at(early).dx, closeTo(at(evening).dx, 3));
      expect(at(afternoon).dx, closeTo(at(late).dx, 3));
      expect(at(early).dy, closeTo(at(afternoon).dy, 3));
      expect(at(evening).dy, greaterThan(at(early).dy));
    });
  });

  group('subjects', () {
    testWidgets('save waits for a change, then patches the profile and says saved', (tester) async {
      final api = _api();
      final auth = FakeAuth(_user);
      await _pump(tester, const SubjectsScreen(), api: api, auth: auth);
      expect(find.text('Pick or remove a subject to save.'), findsOneWidget);
      await _tap(tester, 'General Test');
      expect(find.text('5 of 5 chosen'), findsOneWidget);
      await tester.tap(find.text('Save subjects'));
      await tester.pump();
      await tester.pump();
      final body = verify(() => api.patch('/api/users/u1', body: captureAny(named: 'body'), expectUserId: 'u1')).captured.single as Map;
      expect(body['subjects'], ['accountancy', 'business_studies', 'economics', 'english', 'general_test']);
      expect(auth.reloads, 1);
      expect(find.textContaining('Subjects saved at 10:39 PM'), findsOneWidget);
    });

    testWidgets('a sixth subject is refused inline', (tester) async {
      await _pump(tester, const SubjectsScreen(), api: _api());
      await _tap(tester, 'General Test');
      await _tap(tester, 'Mathematics');
      expect(find.text('5 of 5 chosen'), findsOneWidget);
      expect(find.text('Five is the most. Remove one to add another.'), findsWidgets);
    });

    testWidgets('the first refused sixth subject shakes the sentence and it lands back', (tester) async {
      await pumpMockmob(
        tester,
        const SubjectsScreen(),
        wrapInScaffold: false,
        size: const Size(384, 1400),
        overrides: youOverrides(fakeAuth: FakeAuth(_user), api: _api()),
      );
      await _tap(tester, 'General Test');
      // The Save key's reason closes under it (KeyReveal, 200 ms) once the choice changes; let
      // the footer settle so only the shake moves the sentence.
      await tester.pump(const Duration(milliseconds: 300));
      await tester.ensureVisible(find.text('Mathematics').first);
      await tester.pump();
      await tester.tap(find.text('Mathematics').first);
      await tester.pump();
      await tester.pump();
      final sentence = find.text('Five is the most. Remove one to add another.');
      expect(sentence, findsWidgets);
      final rest = tester.getTopLeft(sentence.first);
      await tester.pump(const Duration(milliseconds: 25));
      expect(tester.getTopLeft(sentence.first), isNot(rest), reason: 'the first refusal already shakes');
      await tester.pump(const Duration(seconds: 1));
      expect(tester.getTopLeft(sentence.first), rest);
    });

    testWidgets('a failed save keeps the choice and says nothing changed', (tester) async {
      await _pump(tester, const SubjectsScreen(), api: _api(error: offlineError()));
      await _tap(tester, 'General Test');
      await tester.tap(find.text('Save subjects'));
      await tester.pump();
      await tester.pump();
      expect(find.text('You are offline. Your subjects were not changed. Try again when you are connected.'), findsOneWidget);
      expect(find.text('5 of 5 chosen'), findsOneWidget);
      expect(find.textContaining('Subjects saved'), findsNothing);
    });

    testWidgets('a saved subject practice cannot open is listed with the reason', (tester) async {
      const auth = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', subjects: ['accountancy', 'entrepreneurship']);
      await _pump(tester, const SubjectsScreen(), auth: FakeAuth(auth));
      expect(find.text('Entrepreneurship'), findsOneWidget);
      expect(find.text('Practice for this paper is not open yet. Your other subjects are ready.'), findsOneWidget);
    });
  });

  group('account', () {
    testWidgets('the plan card reads the balance; the name sheet patches the name', (tester) async {
      final api = _api();
      await _pump(tester, const AccountScreen(), api: api);
      expect(find.bySemanticsLabel('40 Practice credits'), findsOneWidget);
      await tester.tap(find.text('Asha Verma'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '  Asha V.  ');
      await tester.pump();
      await tester.tap(find.text('Save name'));
      await tester.pumpAndSettle();
      final body = verify(() => api.patch('/api/users/u1', body: captureAny(named: 'body'), expectUserId: 'u1')).captured.single as Map;
      expect(body, {'name': 'Asha V.'});
      expect(find.text('Name saved at 10:39 PM.'), findsOneWidget);
    });
  });

  group('usual length', () {
    late MockApi api;
    late ProviderContainer container;

    setUp(() {
      api = MockApi();
      container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
      addTearDown(container.dispose);
    });

    void prefs(Map<String, Object?> answer) =>
        when(() => api.get(StudyLength.path)).thenAnswer((_) async => ApiResponse(200, answer));

    test('stays on the phone while study preferences are off', () async {
      prefs({'state': 'disabled', 'minutes': 20});
      expect(await container.read(studyLengthProvider).save(30), LengthSync.notOpen);
      verifyNever(() => api.put(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId')));
    });

    test('does not write what the server already has', () async {
      prefs({'state': 'ready', 'minutes': 30, 'revision': 3});
      expect(await container.read(studyLengthProvider).save(30), LengthSync.unchanged);
      verifyNever(() => api.put(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId')));
    });

    test('writes with the revision it read, and reads again once after a conflict', () async {
      prefs({'state': 'ready', 'minutes': 20, 'revision': 3});
      var calls = 0;
      when(() => api.put(StudyLength.path, body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((_) async {
        if (calls++ == 0) throw const ApiError(status: 409, kind: ApiErrorKind.conflict, code: 'conflict');
        return ApiResponse(200, const {});
      });
      expect(await container.read(studyLengthProvider).save(10), LengthSync.saved);
      final bodies = verify(() => api.put(StudyLength.path, body: captureAny(named: 'body'), expectUserId: any(named: 'expectUserId'))).captured;
      expect(bodies.last, {'minutes': 10, 'expectedRevision': 3});
      verify(() => api.get(StudyLength.path)).called(2);
    });
  });
}
