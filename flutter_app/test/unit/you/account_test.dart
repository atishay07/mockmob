import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
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
    overrides: youOverrides(fakeAuth: auth, drafts: draftsWithUnsent(unsent)),
  );
  return auth;
}

ApiResponse _deleteResponse({required DateTime requestedAt, String message = 'We delete your account and study records within 30 days. Payment records required by law are kept.'}) =>
    ApiResponse(200, {'status': 'pending', 'requestedAt': requestedAt.toUtc().toIso8601String(), 'message': message});

void main() {
  group('account', () {
    testWidgets('shows the email, the Free plan and where plans are managed', (tester) async {
      await _pumpAccount(tester);
      expect(find.text('asha.verma@example.com'), findsOneWidget);
      expect(find.text('Free'), findsOneWidget);
      expect(find.text('Credit balance not loaded'), findsOneWidget);
      expect(find.text('Plans are managed on mockmob.in. Pro bought there works here.'), findsOneWidget);
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
      expect(find.textContaining('are on this phone and not sent'), findsNothing);
      await tester.tap(find.text('Sign out').last);
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 1);
    });

    testWidgets('unsent answers are warned about with the exact sentence', (tester) async {
      final auth = await _pumpAccount(tester, unsent: 3);
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(find.text('3 answers are on this phone and not sent. Sign out anyway?'), findsOneWidget);
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
      expect(find.text('1 answer is on this phone and not sent. Sign out anyway?'), findsOneWidget);
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
        overrides: youOverrides(fakeAuth: auth, api: api, drafts: draftsWithUnsent(unsent)),
      );
      await tester.pump();
      return (auth, api);
    }

    testWidgets('states the consequences exactly', (tester) async {
      await pump(tester);
      expect(find.text('Delete your MockMob account'), findsOneWidget);
      expect(
        find.text(
          'We delete your account and study records within 30 days. Payment records required by law '
          'are kept. You will be signed out.',
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

    testWidgets('success shows the returned message and signs out only when the student continues', (tester) async {
      final (auth, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'))).thenAnswer((_) async => _deleteResponse(requestedAt: DateTime(2026, 10, 12, 22, 39)));
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      verify(() => api.post('/api/me/delete', body: {'source': 'android'})).called(1);
      expect(find.text('Your request is with us'), findsOneWidget);
      expect(find.textContaining('We delete your account and study records within 30 days. Payment records required by law are kept.'), findsOneWidget);
      expect(find.textContaining('Request recorded on the server at'), findsOneWidget);
      expect(auth.signOutCalls, 0, reason: 'sign-out is a separate step after the request is recorded');

      await tester.tap(find.text('Sign out'));
      await tester.pump();
      await tester.pump();
      expect(auth.signOutCalls, 1);
    });

    testWidgets('a repeat request says it is already with us', (tester) async {
      final (_, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body')))
          .thenAnswer((_) async => _deleteResponse(requestedAt: DateTime(2026, 10, 9, 20, 0)));
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Your request is already with us.'), findsOneWidget);
      expect(find.textContaining('Requested on'), findsOneWidget);
    });

    testWidgets('a failed request signs nobody out and offers another try', (tester) async {
      final (auth, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'))).thenThrow(offlineError());
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('You are offline. Nothing was requested. Try again when you are connected.'), findsOneWidget);
      expect(find.text('Request deletion'), findsOneWidget);
      expect(auth.signOutCalls, 0);
    });

    testWidgets('a server fault is a plain "nothing was requested"', (tester) async {
      final (_, api) = await pump(tester);
      when(() => api.post('/api/me/delete', body: any(named: 'body'))).thenThrow(unavailableError());
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
      expect(find.text('We could not send your request. Nothing was requested. Try again.'), findsOneWidget);
    });

    testWidgets('the screen never says the account is deleted', (tester) async {
      await pump(tester);
      final all = tester.widgetList<Text>(find.byType(Text)).map((t) => (t.data ?? '').toLowerCase()).join(' ');
      expect(all.contains('has been deleted'), isFalse);
      expect(all.contains('is deleted'), isFalse);
    });
  });
}
