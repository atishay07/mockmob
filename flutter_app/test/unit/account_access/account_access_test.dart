import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/router/router.dart' show intendedRouteProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/account_access/access_copy.dart';
import 'package:mockmob/features/account_access/access_gateway.dart';
import 'package:mockmob/features/account_access/account_access.dart';

import '../../helpers/fonts.dart';
import 'support.dart';

Finder field(String label) => find.descendant(
      of: find.ancestor(of: find.text(label), matching: find.byType(Column)).first,
      matching: find.byType(TextField),
    );

void main() {
  setUpAll(loadAppFonts);

  group('phone numbers', () {
    test('Indian mobiles are normalised to E.164; anything else is refused', () {
      expect(indianMobileE164('98123 45678'), '+919812345678');
      expect(indianMobileE164('+91 98123 45678'), '+919812345678');
      expect(indianMobileE164('09812345678'), '+919812345678');
      expect(indianMobileE164('12345 67890'), isNull);
      expect(indianMobileE164('98123'), isNull);
    });
  });

  group('PasswordSignInForm', () {
    Widget form(BuildContext context, GoRouterState state) =>
        const Scaffold(body: SingleChildScrollView(child: PasswordSignInForm(onForgotPassword: _noop)));

    testWidgets('checks the email and password before calling anyone', (tester) async {
      final gateway = FakeAccessGateway();
      await pumpAccess(tester, gateway: gateway, builder: form, auth: AuthSnapshot.signedOut);
      await tester.enterText(field(AccessCopy.emailLabel), 'not-an-email');
      await tester.tap(find.text(AccessCopy.signIn));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.problem(AccessFailure.invalidEmail)), findsOneWidget);
      await tester.enterText(field(AccessCopy.emailLabel), 'asha@example.com');
      await tester.tap(find.text(AccessCopy.signIn));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.enterPassword), findsOneWidget);
      expect(gateway.calls, isEmpty);
    });

    testWidgets('shows the working state, then a wrong password with what to do, keeping what was typed', (tester) async {
      final gateway = FakeAccessGateway()
        ..hold = Completer<void>()
        ..errors['password'] = AccessFailure.wrongPassword;
      await pumpAccess(tester, gateway: gateway, builder: form, auth: AuthSnapshot.signedOut);
      await tester.enterText(field(AccessCopy.emailLabel), ' Asha@Example.com ');
      await tester.enterText(field(AccessCopy.passwordLabel), 'hunter22');
      await tester.tap(find.text(AccessCopy.signIn));
      await tester.pump();
      expect(find.text(AccessCopy.signingIn), findsOneWidget);
      gateway.hold!.complete();
      await tester.pumpAndSettle();
      expect(gateway.calls.single, 'password:asha@example.com:hunter22');
      expect(find.text(AccessCopy.problem(AccessFailure.wrongPassword)), findsOneWidget);
      final passwordField = tester.widget<TextField>(field(AccessCopy.passwordLabel));
      expect(passwordField.controller!.text, 'hunter22');
      expect(passwordField.obscureText, isTrue);
      expect(passwordField.autofillHints, contains(AutofillHints.password));
    });

    testWidgets('a password sign-in means this account has a password: the nudge stays away', (tester) async {
      final prefs = MemoryPrefsStore();
      final gateway = FakeAccessGateway();
      await pumpAccess(tester, gateway: gateway, builder: form, prefs: prefs);
      await tester.enterText(field(AccessCopy.emailLabel), 'asha@example.com');
      await tester.enterText(field(AccessCopy.passwordLabel), 'hunter22');
      await tester.tap(find.text(AccessCopy.signIn));
      // The form stays "Signing in" until the router replaces it, so it never settles here.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(gateway.calls.single, 'password:asha@example.com:hunter22');
      expect(prefs.values['access.password_set.u1'], isTrue);
    });

    testWidgets('Show reveals the password and is a named control', (tester) async {
      await pumpAccess(tester, gateway: FakeAccessGateway(), builder: form, auth: AuthSnapshot.signedOut);
      await tester.tap(find.bySemanticsLabel(AccessCopy.showPassword));
      await tester.pump();
      expect(tester.widget<TextField>(field(AccessCopy.passwordLabel)).obscureText, isFalse);
    });
  });

  group('SetPasswordForm', () {
    Widget form(BuildContext context, GoRouterState state) =>
        const Scaffold(body: SingleChildScrollView(child: SetPasswordForm(email: 'asha@example.com', onSkip: _noop)));

    testWidgets('a short password is refused on the spot', (tester) async {
      final gateway = FakeAccessGateway();
      await pumpAccess(tester, gateway: gateway, builder: form);
      await tester.enterText(field(AccessCopy.newPasswordLabel), 'short');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.problem(AccessFailure.weakPassword)), findsOneWidget);
      expect(gateway.calls, isEmpty);
    });

    testWidgets('"Password saved" appears only after the server acknowledged it', (tester) async {
      final prefs = MemoryPrefsStore();
      final gateway = FakeAccessGateway()..hold = Completer<void>();
      await pumpAccess(tester, gateway: gateway, builder: form, prefs: prefs);
      await tester.enterText(field(AccessCopy.newPasswordLabel), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pump();
      expect(find.text(AccessCopy.savingPassword), findsOneWidget);
      expect(find.text(AccessCopy.passwordSaved), findsNothing);
      gateway.hold!.complete();
      await tester.pumpAndSettle();
      expect(gateway.calls.single, 'setPassword:long enough now');
      expect(find.text(AccessCopy.passwordSaved), findsOneWidget);
      expect(find.text(AccessCopy.passwordSavedFor('asha@example.com')), findsOneWidget);
      expect(prefs.values['access.password_set.u1'], isTrue, reason: 'the nudge will not come back');
    });

    testWidgets('a failure keeps the typed password and says what to do', (tester) async {
      final gateway = FakeAccessGateway()..errors['setPassword'] = AccessFailure.reauthRequired;
      await pumpAccess(tester, gateway: gateway, builder: form);
      await tester.enterText(field(AccessCopy.newPasswordLabel), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.problem(AccessFailure.reauthRequired)), findsOneWidget);
      expect(tester.widget<TextField>(field(AccessCopy.newPasswordLabel)).controller!.text, 'long enough now');
    });
  });

  group('after Forgot password', () {
    Widget resetForm(BuildContext context, GoRouterState state) => const Scaffold(
        body: SingleChildScrollView(child: SetPasswordForm(email: 'asha@example.com', endOtherSessions: true)));

    testWidgets('the new password is saved, then every other device is signed out', (tester) async {
      final gateway = FakeAccessGateway();
      await pumpAccess(tester, gateway: gateway, builder: resetForm);
      await tester.enterText(field(AccessCopy.newPasswordLabel), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pumpAndSettle();
      expect(gateway.calls, ['setPassword:long enough now', 'signOutOthers']);
      expect(find.text(AccessCopy.passwordSaved), findsOneWidget);
      expect(find.text(AccessCopy.otherDevicesSignedOut), findsOneWidget);
    });

    testWidgets('if other devices cannot be signed out, the password still counts and the next step is named', (tester) async {
      final gateway = FakeAccessGateway()..errors['signOutOthers'] = AccessFailure.offline;
      await pumpAccess(tester, gateway: gateway, builder: resetForm);
      await tester.enterText(field(AccessCopy.newPasswordLabel), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.passwordSaved), findsOneWidget);
      expect(find.text(AccessCopy.otherDevicesStillIn), findsOneWidget);
    });

    testWidgets('a plain "Set a password" leaves other devices alone', (tester) async {
      final gateway = FakeAccessGateway();
      await pumpAccess(
        tester,
        gateway: gateway,
        builder: (context, state) =>
            const Scaffold(body: SingleChildScrollView(child: SetPasswordForm(email: 'asha@example.com'))),
      );
      await tester.enterText(field(AccessCopy.newPasswordLabel), 'long enough now');
      await tester.tap(find.text(AccessCopy.savePassword));
      await tester.pumpAndSettle();
      expect(gateway.calls, ['setPassword:long enough now']);
    });
  });

  group('SignOutOtherDevicesCard', () {
    Widget card(BuildContext context, GoRouterState state) =>
        const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: SignOutOtherDevicesCard()));

    testWidgets('shows the working state, then confirms', (tester) async {
      final gateway = FakeAccessGateway()..hold = Completer<void>();
      await pumpAccess(tester, gateway: gateway, builder: card);
      await tester.tap(find.text(AccessCopy.signOutOthersAction));
      await tester.pump();
      expect(find.text(AccessCopy.signingOutOthers), findsOneWidget);
      gateway.hold!.complete();
      await tester.pumpAndSettle();
      expect(gateway.calls, ['signOutOthers']);
      expect(find.text(AccessCopy.signOutOthersDone), findsOneWidget);
    });

    testWidgets('a failure names the next step and the key works again', (tester) async {
      final gateway = FakeAccessGateway()..errors['signOutOthers'] = AccessFailure.offline;
      await pumpAccess(tester, gateway: gateway, builder: card);
      await tester.tap(find.text(AccessCopy.signOutOthersAction));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.problem(AccessFailure.offline)), findsOneWidget);
      expect(find.text(AccessCopy.signOutOthersAction), findsOneWidget);
    });
  });

  group('GoogleSignInButton', () {
    Widget button(BuildContext context, GoRouterState state) =>
        const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: GoogleSignInButton()));

    testWidgets('the browser flow shows that it is waiting, then acknowledges the return', (tester) async {
      final gateway = FakeAccessGateway()..googleOutcome = GoogleOutcome.browserOpened;
      await pumpAccess(tester, gateway: gateway, builder: button, auth: AuthSnapshot.signedOut);
      await tester.tap(find.text(AccessCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.finishInBrowser), findsOneWidget);
      gateway.oauth.add(const OAuthReturn(OAuthReturnKind.signedIn));
      await tester.pump();
      await tester.pump();
      expect(find.text(AccessCopy.signingIn), findsOneWidget);
    });

    testWidgets('closing Google in the browser returns quietly to the key', (tester) async {
      final gateway = FakeAccessGateway()..googleOutcome = GoogleOutcome.browserOpened;
      await pumpAccess(tester, gateway: gateway, builder: button, auth: AuthSnapshot.signedOut);
      await tester.tap(find.text(AccessCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      gateway.oauth.add(const OAuthReturn(OAuthReturnKind.cancelled));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.googleClosed), findsOneWidget);
      expect(find.text(AccessCopy.continueWithGoogle), findsOneWidget);
    });

    testWidgets('a closed account sheet offers the browser as a second way', (tester) async {
      final gateway = FakeAccessGateway()..googleOutcome = GoogleOutcome.cancelled;
      await pumpAccess(tester, gateway: gateway, builder: button, auth: AuthSnapshot.signedOut);
      await tester.tap(find.text(AccessCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.googleClosed), findsOneWidget);
      await tester.tap(find.text(AccessCopy.useBrowserInstead));
      await tester.pumpAndSettle();
      expect(gateway.calls, ['google', 'googleBrowser']);
      expect(find.text(AccessCopy.finishInBrowser), findsOneWidget);
    });

    testWidgets('a failure names the next step', (tester) async {
      final gateway = FakeAccessGateway()..errors['google'] = AccessFailure.offline;
      await pumpAccess(tester, gateway: gateway, builder: button, auth: AuthSnapshot.signedOut);
      await tester.tap(find.text(AccessCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.problem(AccessFailure.offline)), findsOneWidget);
    });
  });

  group('SignInMethods', () {
    Widget methods(BuildContext context, GoRouterState state) => const Scaffold(
          body: SingleChildScrollView(child: SignInMethods(emailCode: Text('email code block'))),
        );

    testWidgets('offers Google, then the email code or a password', (tester) async {
      await pumpAccess(tester, gateway: FakeAccessGateway(), builder: methods, auth: AuthSnapshot.signedOut);
      expect(find.text(AccessCopy.continueWithGoogle), findsOneWidget);
      expect(find.text('email code block'), findsOneWidget);
      expect(find.text(AccessCopy.usePhone), findsNothing, reason: 'phone is off by default');
      await tester.tap(find.text(AccessCopy.methodPassword));
      await tester.pumpAndSettle();
      expect(find.byType(PasswordSignInForm), findsOneWidget);
      expect(find.text('email code block'), findsNothing);
    });

    testWidgets('no Google key when the build has no Google, and phone only when switched on', (tester) async {
      await pumpAccess(
        tester,
        gateway: FakeAccessGateway(),
        builder: methods,
        auth: AuthSnapshot.signedOut,
        methods: const AccessMethods(google: false, googleBrowser: false, phone: true),
      );
      expect(find.text(AccessCopy.continueWithGoogle), findsNothing);
      expect(find.text(AccessCopy.usePhone), findsOneWidget);
    });
  });

  group('ForgotPasswordScreen', () {
    testWidgets('sends the code, then signs in and continues to "Choose a new password"', (tester) async {
      final gateway = FakeAccessGateway();
      await pumpAccess(
        tester,
        gateway: gateway,
        auth: AuthSnapshot.signedOut,
        builder: (context, state) => const ForgotPasswordScreen(email: 'asha@example.com'),
      );
      await tester.tap(find.text(AccessCopy.emailMeCode));
      await tester.pumpAndSettle();
      expect(gateway.calls, ['sendEmailCode:asha@example.com']);
      expect(find.text(AccessCopy.codeSentTo('asha@example.com')), findsOneWidget);
      expect(find.text(AccessCopy.resendIn(60)), findsOneWidget);
      await tester.enterText(field(AccessCopy.codeLabel), '12345678');
      await tester.tap(find.text(AccessCopy.continueLabel));
      await tester.pump();
      expect(gateway.calls.last, 'verifyEmailCode:asha@example.com:12345678');
      final container = ProviderScope.containerOf(tester.element(find.byType(ForgotPasswordScreen)));
      expect(container.read(intendedRouteProvider).location, AccountAccessRoutes.setPasswordAfterReset);
      expect(find.text(AccessCopy.checking), findsOneWidget, reason: 'held until the router moves on');
      await tester.pump(const Duration(seconds: 61));
    });

    testWidgets('a wrong code says so and lets the student try again', (tester) async {
      final gateway = FakeAccessGateway()..errors['verifyEmailCode'] = AccessFailure.invalidCode;
      await pumpAccess(
        tester,
        gateway: gateway,
        auth: AuthSnapshot.signedOut,
        builder: (context, state) => const ForgotPasswordScreen(email: 'asha@example.com'),
      );
      await tester.tap(find.text(AccessCopy.emailMeCode));
      await tester.pumpAndSettle();
      await tester.enterText(field(AccessCopy.codeLabel), '12345678');
      await tester.tap(find.text(AccessCopy.continueLabel));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.problem(AccessFailure.invalidCode)), findsOneWidget);
      expect(find.text(AccessCopy.continueLabel), findsOneWidget);
      final container = ProviderScope.containerOf(tester.element(find.byType(ForgotPasswordScreen)));
      expect(container.read(intendedRouteProvider).location, isNull, reason: 'a failed code leaves no detour behind');
      await tester.pump(const Duration(seconds: 61));
    });
  });

  group('SetPasswordNudge', () {
    Widget nudge(BuildContext context, GoRouterState state) =>
        const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: SetPasswordNudge(onSetPassword: _noop)));

    testWidgets('shows once for a signed-in student; Not now hides it for this account', (tester) async {
      final prefs = MemoryPrefsStore();
      await pumpAccess(tester, gateway: FakeAccessGateway(), builder: nudge, prefs: prefs);
      expect(find.text(AccessCopy.nudgeTitle), findsOneWidget);
      await tester.tap(find.text(AccessCopy.notNow));
      await tester.pumpAndSettle();
      expect(find.text(AccessCopy.nudgeTitle), findsNothing);
      expect(prefs.values['access.password_nudge_dismissed.u1'], isTrue);
    });

    testWidgets('never shows while signed out or after a password was set here', (tester) async {
      await pumpAccess(tester, gateway: FakeAccessGateway(), builder: nudge, auth: AuthSnapshot.signedOut);
      expect(find.text(AccessCopy.nudgeTitle), findsNothing);
    });

    testWidgets('does not show when a password was already set on this phone', (tester) async {
      final prefs = MemoryPrefsStore()..values['access.password_set.u1'] = true;
      await pumpAccess(tester, gateway: FakeAccessGateway(), builder: nudge, prefs: prefs);
      expect(find.text(AccessCopy.nudgeTitle), findsNothing);
    });
  });
}

void _noop() {}
