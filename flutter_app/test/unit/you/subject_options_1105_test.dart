// LK94 (owner, 5 Nov 2026): the subject options are editable where the subjects are, You > Subjects, as at the onboarding. A
// chosen subject with options asks it under its row: the saved one ticked (Key cards keep it), a subject just added with its
// default, a held one with nothing saved with neither. Save writes the subjects, then each changed option; "saved" only after
// the server answered. Where Key cards are off (or not read) nothing is asked, since nothing could keep it.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/domain/subject_options.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmPressable;
import 'package:mockmob/features/keycards/data/keycards_providers.dart';
import 'package:mockmob/features/onboarding/widgets/subject_option_picker.dart';
import 'package:mockmob/features/you/edit_copy.dart';
import 'package:mockmob/features/you/subjects/subjects_screen.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import '../keycards/support/keycards_fakes.dart';
import 'you_test_support.dart';

const _user = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
  creditBalance: 40,
);

MockApi _api({Object? optionError}) {
  final api = MockApi();
  when(() => api.patch(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((invocation) async {
    final body = invocation.namedArguments[#body] as Map<String, Object?>;
    return ApiResponse(200, {'id': 'u1', ...body});
  });
  when(() => api.put(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((invocation) async {
    if (optionError != null) throw optionError;
    final body = invocation.namedArguments[#body] as Map<String, Object?>;
    return ApiResponse(200, body);
  });
  return api;
}

Future<void> _pump(WidgetTester tester, {required MockApi api, FakeKeyCardsApi? keyCards}) => pumpMockmob(
      tester,
      const SubjectsScreen(),
      wrapInScaffold: false,
      disableAnimations: true,
      size: const Size(384, 2400),
      overrides: [
        ...youOverrides(fakeAuth: FakeAuth(_user), api: api),
        keyCardsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        if (keyCards != null) keyCardsApiProvider.overrideWithValue(keyCards),
      ],
    );

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

bool _ticked(WidgetTester tester, String subject, String id) =>
    tester.widget<MmPressable>(find.descendant(of: find.byKey(SubjectOptionPicker.choiceKey(subject, id)), matching: find.byType(MmPressable))).selected == true;

List<Map<String, Object?>> _optionPuts(MockApi api) => [
      for (final c in verify(() => api.put('/api/me/subject-options', body: captureAny(named: 'body'), expectUserId: 'u1')).captured)
        Map<String, Object?>.from(c as Map),
    ];

void main() {
  testWidgets('the saved option is ticked; changing it turns Save on, and Save writes only that option', (tester) async {
    final api = _api();
    final keyCards = FakeKeyCardsApi()..options['accountancy'] = 'CAS';
    await _pump(tester, api: api, keyCards: keyCards);
    await tester.pumpAndSettle();
    expect(find.byKey(SubjectOptionPicker.keyFor('accountancy')), findsOneWidget);
    expect(find.text(kSubjectOptions['accountancy']!.question), findsOneWidget);
    expect(_ticked(tester, 'accountancy', 'CAS'), isTrue, reason: 'what the account holds');
    expect(find.text(EditCopy.subjectsUnchanged), findsOneWidget, reason: 'nothing to save yet');

    await _tap(tester, find.byKey(SubjectOptionPicker.choiceKey('accountancy', 'AFS')));
    expect(_ticked(tester, 'accountancy', 'AFS'), isTrue);
    await _tap(tester, find.text(EditCopy.subjectsSave));
    expect(_optionPuts(api), [
      {'subject': 'accountancy', 'option': 'AFS'},
    ]);
    verifyNever(() => api.patch(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId')));
    expect(find.textContaining('Learn now shows Analysis of Financial Statements.'), findsOneWidget);
    expect(_ticked(tester, 'accountancy', 'AFS'), isTrue, reason: 'the saved choice stays ticked');
  });

  testWidgets('a subject just added asks with its default ticked; Save writes the subjects, then its option', (tester) async {
    final api = _api();
    await _pump(tester, api: api, keyCards: FakeKeyCardsApi());
    await tester.pumpAndSettle();
    expect(find.byKey(SubjectOptionPicker.keyFor('mathematics')), findsNothing, reason: 'only chosen subjects ask');
    await _tap(tester, find.text('Mathematics'));
    expect(find.byKey(SubjectOptionPicker.keyFor('mathematics')), findsOneWidget);
    expect(_ticked(tester, 'mathematics', 'B1'), isTrue, reason: 'the default, as at the onboarding');
    await _tap(tester, find.byKey(SubjectOptionPicker.choiceKey('mathematics', 'B2')));
    await _tap(tester, find.text(EditCopy.subjectsSave));
    final patched = verify(() => api.patch('/api/users/u1', body: captureAny(named: 'body'), expectUserId: 'u1')).captured.single as Map;
    expect(patched['subjects'], contains('mathematics'));
    expect(_optionPuts(api), [
      {'subject': 'mathematics', 'option': 'B2'},
    ]);
    expect(find.textContaining('Subjects saved at'), findsOneWidget);
  });

  testWidgets('a held subject with nothing saved ticks neither; a pick turns Save on', (tester) async {
    final api = _api();
    final keyCards = FakeKeyCardsApi()..options.remove('accountancy');
    await _pump(tester, api: api, keyCards: keyCards);
    await tester.pumpAndSettle();
    expect(_ticked(tester, 'accountancy', 'AFS'), isFalse, reason: 'nothing is shown as saved that is not');
    expect(_ticked(tester, 'accountancy', 'CAS'), isFalse);
    expect(find.text(EditCopy.subjectsUnchanged), findsOneWidget);
    await _tap(tester, find.byKey(SubjectOptionPicker.choiceKey('accountancy', 'CAS')));
    expect(find.text(EditCopy.subjectsUnchanged), findsNothing);
  });

  testWidgets('an option that fails says so in one line; the subjects saved before it stay saved', (tester) async {
    final api = _api(optionError: const ApiError(kind: ApiErrorKind.server, code: 'server', status: 500));
    await _pump(tester, api: api, keyCards: FakeKeyCardsApi());
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Mathematics'));
    await _tap(tester, find.text(EditCopy.subjectsSave));
    expect(find.text('Your subjects are saved. The choice for Mathematics did not save. Try again.'), findsOneWidget);
    expect(find.textContaining('Subjects saved at'), findsNothing, reason: 'never "saved" for what was not');
    expect(find.text(EditCopy.subjectsSave), findsOneWidget);
  });

  testWidgets('Key cards off: no option is asked, and the editor is as before', (tester) async {
    await _pump(tester, api: _api());
    await tester.pumpAndSettle();
    expect(find.byKey(SubjectOptionPicker.keyFor('accountancy')), findsNothing);
  });
}
