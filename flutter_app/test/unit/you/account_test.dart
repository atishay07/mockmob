import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mockmob/features/you/account/sign_out_flow.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<FakeAuth> _pumpAccount(
  WidgetTester tester, {
  bool pro = false,
  DateTime? until,
  int unsent = 0,
  Object? signOutError,
}) async {
  final auth = FakeAuth(userWith(pro: pro, until: until), signOutError: signOutError);
  await pumpMockmob(
    tester,
    const AccountScreen(),
    wrapInScaffold: false,
    disableAnimations: true,
    // Tall enough for the Security section and the sign-out key below it to be built.
    size: const Size(360, 1700),
    overrides: youOverrides(fakeAuth: auth, drafts: draftsWithUnsent(unsent)),
  );
  return auth;
}

ApiResponse _deleteResponse({required DateTime requestedAt, String message = 'We delete your account and study records within 30 days. Payment records required by law are kept.'}) =>
    ApiResponse(200, {'status': 'pending', 'requestedAt': requestedAt.toUtc().toIso8601String(), 'message': message});

/// Types the confirmation word the delete page asks for, so the request key turns on.
Future<void> _typeDelete(WidgetTester tester, [String word = 'DELETE']) async {
  await tester.enterText(find.byType(TextField), word);
  await tester.pump();
}

void main() {
  group('account', () {
    testWidgets('shows the email, the Free plan and the plan footer', (tester) async {
      await _pumpAccount(tester);
      expect(find.text('asha.verma@example.com'), findsOneWidget);
      expect(find.text('Free'), findsOneWidget);
      expect(find.text('Credits did not load.'), findsOneWidget);
      expect(find.text('Credit balance not loaded'), findsNothing);
      expect(find.text('Your plan and credits as of the last check.'), findsNothing);
    });

    testWidgets('an unloaded credit balance has a Try again key that reads the profile again', (tester) async {
      final auth = await _pumpAccount(tester);
      final retry = find.text('Try again');
      expect(retry, findsOneWidget);
      expect(tester.getSize(find.ancestor(of: retry, matching: find.byType(KeyButton)).first).height, greaterThanOrEqualTo(48));
      await tester.tap(retry);
      await tester.pumpAndSettle();
      expect(auth.reloads, 1);
    });

    testWidgets('Pro with a date reads "Pro is active until 31 July 2027."', (tester) async {
      await _pumpAccount(tester, pro: true, until: DateTime(2027, 7, 31, 12));
      expect(find.text('Pro is active until 31 July 2027.'), findsOneWidget);
      expect(find.text('Unlimited practice'), findsOneWidget);
      expect(find.text('Free'), findsNothing);
    });

    testWidgets('has no price, upgrade or purchase wording anywhere', (tester) async {
      await _pumpAccount(tester);
      final all = tester.widgetList<Text>(find.byType(Text)).map((t) => t.data ?? '').join(' ').toLowerCase();
      for (final word in ['upgrade', 'buy ', 'price', 'checkout', 'subscribe', '₹', 'rs.', ' inr']) {
        expect(all.contains(word), isFalse, reason: word);
      }
    });

    testWidgets('sign out with nothing unsent asks once, then signs out', (tester) async {
      final auth = await _pumpAccount(tester);
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(find.text('Sign out of MockMob?'), findsOneWidget);
      // Staying is the volt primary; signing out is the quiet glass key (P3-30).
      KeyVariant variantOf(String label) => tester.widget<KeyButton>(find.widgetWithText(KeyButton, label).last).variant;
      expect(variantOf('Stay signed in'), KeyVariant.primary);
      expect(variantOf('Sign out'), KeyVariant.secondary);
      expect(find.textContaining('are on this phone and not sent'), findsNothing);
      await tester.tap(find.text('Sign out').last);
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 1);
    });

    testWidgets('unsent answers are warned about with the exact sentence', (tester) async {
      final auth = await _pumpAccount(tester, unsent: 3);
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(find.text('3 answers are on this phone and not sent.'), findsOneWidget);
      expect(find.text('Stay signed in'), findsOneWidget);
      await tester.tap(find.text('Stay signed in'));
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 0);

      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out anyway'));
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 1);
    });

    testWidgets('one unsent answer is singular', (tester) async {
      await _pumpAccount(tester, unsent: 1);
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(find.text('1 answer is on this phone and not sent.'), findsOneWidget);
    });

    testWidgets('a failed sign-out is reported and can be repeated', (tester) async {
      await _pumpAccount(tester, signOutError: StateError('boom'));
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out').last);
      await tester.pumpAndSettle();
      expect(find.text('We could not sign you out. Try again.'), findsOneWidget);
    });
  });

  group('delete account', () {
    Future<(FakeAuth, MockApi)> pump(WidgetTester tester, {int unsent = 0}) async {
      final auth = FakeAuth(youUser);
      final api = MockApi();
      await pumpMockmob(
        tester,
        const DeleteScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 1700),
        overrides: youOverrides(fakeAuth: auth, api: api, drafts: draftsWithUnsent(unsent)),
      );
      await tester.pump();
      return (auth, api);
    }

    testWidgets('states the consequences exactly', (tester) async {
      await pump(tester);
      expect(find.text('Delete your account'), findsOneWidget);
      expect(
        find.text(
          'We delete your account and study records within 30 days. Payment records required by law '
          'are kept.',
        ),
        findsOneWidget,
      );
      expect(find.text('Request deletion'), findsOneWidget);
      expect(find.text('Keep my account'), findsOneWidget);
    });

    testWidgets('warns about answers that are only on this phone', (tester) async {
      await pump(tester, unsent: 2);
      expect(find.text('2 answers on this phone have not been sent. They will be removed when you are signed out.'), findsOneWidget);
    });

    testWidgets('the request key stays off until DELETE is typed, in any case', (tester) async {
      final (_, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((_) async => _deleteResponse(requestedAt: DateTime(2026, 10, 12, 22, 39)));
      expect(find.text('Type DELETE to confirm'), findsOneWidget);
      await tester.tap(find.text('Request deletion'), warnIfMissed: false);
      await tester.pump();
      verifyNever(() => api.post(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId')));
      await _typeDelete(tester, 'delet');
      await tester.tap(find.text('Request deletion'), warnIfMissed: false);
      await tester.pump();
      verifyNever(() => api.post(any(), body: any(named: 'body'), expectUserId: any(named: 'expectUserId')));
      await _typeDelete(tester, 'delete');
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      verify(() => api.post('/api/me/delete', body: {'source': 'android'}, expectUserId: 'u1')).called(1);
    });

    testWidgets('success shows the returned message and signs out only when the student continues', (tester) async {
      final (auth, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenAnswer((_) async => _deleteResponse(requestedAt: DateTime(2026, 10, 12, 22, 39)));
      await _typeDelete(tester);
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      verify(() => api.post('/api/me/delete', body: {'source': 'android'}, expectUserId: 'u1')).called(1);
      expect(find.text('Your request is with us'), findsOneWidget);
      expect(find.text('Your request is recorded. Sign out when you are ready.'), findsOneWidget);
      expect(find.textContaining('You will be signed out'), findsNothing, reason: 'sign-out is manual, so the page must not promise it');
      expect(find.text('Request recorded at 10:39 PM.'), findsOneWidget);
      expect(auth.signOutCalls, 0, reason: 'sign-out is a separate step after the request is recorded');

      // The Sign out key took over the Request key's place in the tree, and a key ignores a second
      // commit for 300 ms (KeyButton.tapLock): a student takes longer than that to read the receipt.
      await tester.pump(const Duration(milliseconds: 350));
      await tester.tap(find.text('Sign out'));
      await tester.pump();
      await tester.pump();
      expect(auth.signOutCalls, 1);
    });

    testWidgets('a repeat request says it is already with us', (tester) async {
      final (_, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId')))
          .thenAnswer((_) async => _deleteResponse(requestedAt: DateTime(2026, 10, 9, 20, 0)));
      await _typeDelete(tester);
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Your request is already with us.'), findsOneWidget);
      expect(find.textContaining('Requested on'), findsOneWidget);
    });

    testWidgets('a failed request signs nobody out and offers another try', (tester) async {
      final (auth, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenThrow(offlineError());
      await _typeDelete(tester);
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('You are offline. Nothing was requested. Try again when you are connected.'), findsOneWidget);
      expect(find.text('Request deletion'), findsOneWidget);
      expect(auth.signOutCalls, 0);
    });

    testWidgets('a server fault is a plain "nothing was requested"', (tester) async {
      final (_, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenThrow(unavailableError());
      await _typeDelete(tester);
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('We could not send your request. Nothing was requested. Try again.'), findsOneWidget);
    });

    testWidgets('an unexpected error does not leave the key spinning', (tester) async {
      final (auth, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'), expectUserId: any(named: 'expectUserId'))).thenThrow(const FormatException('bad body'));
      await _typeDelete(tester);
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('We could not send your request. Nothing was requested. Try again.'), findsOneWidget);
      expect(find.text('Request deletion'), findsOneWidget);
      expect(auth.signOutCalls, 0);
    });

    testWidgets('the screen never says the account is deleted', (tester) async {
      await pump(tester);
      final all = tester.widgetList<Text>(find.byType(Text)).map((t) => (t.data ?? '').toLowerCase()).join(' ');
      expect(all.contains('has been deleted'), isFalse);
      expect(all.contains('is deleted'), isFalse);
    });
  });

  // R3 of the 14 Oct audit: the deletion screen promises unsent answers are removed, so the
  // account's unsent onboarding sheet goes too, and a plain sign-out keeps putting it away.
  group('the unsent onboarding sheet at sign-out', () {
    final sheet = OnboardingAnswers(
      stage: Stage.classTwelve,
      subjects: const [SheetSubject.english, SheetSubject.accountancy],
      days: const {0, 2, 4},
      window: StudyTime.late,
      sealedAt: DateTime(2026, 10, 13, 21, 40),
      owner: 'u1',
    );

    Future<(WidgetRef, AnswersStore, FakeAuth)> pumpWith(WidgetTester tester) async {
      final store = AnswersStore(MemoryPrefsStore());
      await store.save(sheet);
      final auth = FakeAuth(youUser);
      late WidgetRef captured;
      await tester.pumpWidget(ProviderScope(
        overrides: [
          authSnapshotProvider.overrideWith(() => auth),
          answersStoreProvider.overrideWithValue(store),
        ],
        child: Consumer(builder: (context, ref, _) {
          captured = ref;
          return const SizedBox();
        }),
      ));
      // The sheet is not read here: the deletion reads it itself before removing it.
      return (captured, store, auth);
    }

    testWidgets('account deletion removes it before signing out, with the queued writes', (tester) async {
      final (ref, store, auth) = await pumpWith(tester);
      await store.park(sheet.copyWith(window: StudyTime.early), DateTime.now());
      await performSignOut(ref, keepQueuedWork: false);
      expect(auth.lastKeepQueuedWork, isFalse);
      expect(await store.parked('u1', DateTime.now()), isNull);
      expect((await store.load()).blank, isTrue);
    });

    testWidgets('a plain sign-out leaves it to be put away for the account', (tester) async {
      final (ref, store, auth) = await pumpWith(tester);
      await performSignOut(ref);
      expect(auth.lastKeepQueuedWork, isTrue);
      expect((await store.load()).owner, 'u1', reason: 'the sign-out flow puts it away, not this step');
    });
  });
}
