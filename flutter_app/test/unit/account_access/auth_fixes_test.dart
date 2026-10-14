// onboarding-auth-02: a reset finishes signing out the other devices even when the student
// leaves while the password saves, and Back waits while it saves.
// onboarding-auth-06: once the Google callback link has arrived, a slow code exchange is not
// reported as "did not finish".
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/account_access/access_copy.dart';
import 'package:mockmob/features/account_access/account_access.dart';

import '../../helpers/fonts.dart';
import 'support.dart';

Finder _passwordField() => find.descendant(
      of: find.ancestor(of: find.text(AccessCopy.newPasswordLabel), matching: find.byType(Column)).first,
      matching: find.byType(TextField),
    );

Widget _resetForm(BuildContext context, GoRouterState state) => const Scaffold(
    body: SingleChildScrollView(child: SetPasswordForm(email: 'asha@example.com', endOtherSessions: true)));

void main() {
  setUpAll(loadAppFonts);

  group('after Forgot password', () {
    testWidgets('leaving while the password saves still signs out every other device', (tester) async {
      final gateway = FakeAccessGateway()..hold = Completer<void>();
      final router = await pumpAccess(
        tester,
        gateway: gateway,
        builder: _resetForm,
        extraRoutes: [GoRoute(path: '/away', builder: (_, _) => const Scaffold(body: Text('away')))],
      );
      await tester.enterText(_passwordField(), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pump();
      expect(gateway.calls, ['setPassword:long enough now']);

      router.go('/away');
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 200));
      }
      expect(find.byType(SetPasswordForm), findsNothing, reason: 'the form is gone');

      gateway.hold!.complete();
      await tester.pumpAndSettle();
      expect(gateway.calls, ['setPassword:long enough now', 'signOutOthers'],
          reason: 'the stolen session is cut off even though nobody is looking');
    });

    testWidgets('Back waits while the password saves', (tester) async {
      final gateway = FakeAccessGateway()..hold = Completer<void>();
      final router = await pumpAccess(
        tester,
        gateway: gateway,
        builder: (_, _) => const Scaffold(body: Text('home')),
        path: '/home',
        extraRoutes: [GoRoute(path: '/reset', builder: _resetForm)],
      );
      unawaited(router.push('/reset'));
      await tester.pumpAndSettle();
      await tester.enterText(_passwordField(), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pump();

      await tester.binding.handlePopRoute();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(SetPasswordForm), findsOneWidget, reason: 'the reset is not left half done');

      gateway.hold!.complete();
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.passwordSaved), findsOneWidget);
      expect(gateway.calls, ['setPassword:long enough now', 'signOutOthers']);
    });
  });

  group('GoogleSignInButton', () {
    testWidgets('once the callback link is here, a slow exchange is not called unfinished', (tester) async {
      final gateway = FakeAccessGateway()..googleOutcome = GoogleOutcome.browserOpened;
      await pumpAccess(
        tester,
        gateway: gateway,
        builder: (_, _) => const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: GoogleSignInButton())),
        auth: AuthSnapshot.signedOut,
      );
      await tester.tap(find.text(AccessCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.finishInBrowser), findsOneWidget);

      // Back from the browser; the link lands a moment later and the exchange is slow.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(seconds: 1));
      gateway.oauth.add(const OAuthReturn(OAuthReturnKind.exchanging));
      await tester.pump();
      await tester.pump(const Duration(seconds: 6));

      expect(find.text(AccessCopy.browserNotFinished), findsNothing);
      expect(find.text(AccessCopy.signingIn), findsOneWidget, reason: 'still setting up the session');
      final key = tester.widget<KeyButton>(find.ancestor(of: find.text(AccessCopy.signingIn), matching: find.byType(KeyButton)));
      expect(key.onPressed, isNull, reason: 'a second tap would replace the verifier this exchange needs');

      gateway.oauth.add(const OAuthReturn(OAuthReturnKind.signedIn));
      await tester.pump();
      expect(find.text(AccessCopy.signingIn), findsOneWidget);
    });

    testWidgets('without the link, coming back still says it did not finish', (tester) async {
      final gateway = FakeAccessGateway()..googleOutcome = GoogleOutcome.browserOpened;
      await pumpAccess(
        tester,
        gateway: gateway,
        builder: (_, _) => const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: GoogleSignInButton())),
        auth: AuthSnapshot.signedOut,
      );
      await tester.tap(find.text(AccessCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(seconds: 4));
      await tester.pump();
      expect(find.text(AccessCopy.browserNotFinished), findsOneWidget);
    });
  });
}
