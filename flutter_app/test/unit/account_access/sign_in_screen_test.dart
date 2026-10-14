// auth-09: the real SignInScreen with the real providers (the sign-in controller, the methods
// and the Google button), driven through fake gateways. It proves the sign-in screen offers the
// methods, shows the Google browser fallback states and reaches the password form. The
// router-level test of the account-access routes belongs to the router package.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/account_access/access_copy.dart';
import 'package:mockmob/features/account_access/account_access.dart';
import 'package:mockmob/features/auth/auth_routes.dart';
import 'package:mockmob/features/auth/copy.dart';

import '../../helpers/fonts.dart';
import '../auth/fakes.dart';
import 'support.dart';

Future<void> _pumpSignIn(
  WidgetTester tester, {
  required FakeAccessGateway access,
  required FakeGateway core,
  AccessMethods methods = const AccessMethods(google: true, googleBrowser: true, phone: false),
}) async {
  tester.view.physicalSize = const Size(720, 1800);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: AppRoutes.signIn,
    routes: [
      GoRoute(
        path: AppRoutes.signIn,
        builder: signInScreen,
        routes: [GoRoute(path: 'code', builder: signInCodeScreen)],
      ),
    ],
  );
  addTearDown(router.dispose);
  final List<Override> overrides = [
    ...authOverrides(gateway: core),
    accountAccessGatewayProvider.overrideWithValue(access),
    accessMethodsProvider.overrideWithValue(methods),
    authSnapshotProvider.overrideWithBuild((ref, notifier) => AuthSnapshot.signedOut),
  ];
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(routerConfig: router, theme: buildTheme(Brightness.light), debugShowCheckedModeBanner: false),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('offers Google once, the email code and a password, and no phone by default', (tester) async {
    await _pumpSignIn(tester, access: FakeAccessGateway(), core: FakeGateway());
    expect(find.text(AccessCopy.continueWithGoogle), findsOneWidget, reason: 'Google is not shown twice');
    expect(find.text(AccessCopy.methodCode), findsOneWidget);
    expect(find.text(AccessCopy.methodPassword), findsOneWidget);
    expect(find.text(AuthCopy.sendCode), findsOneWidget, reason: 'the email-code block is the default method');
    expect(find.text(AccessCopy.usePhone), findsNothing);
  });

  testWidgets('the phone entry appears only when the build has it, and Google only when it has Google', (tester) async {
    await _pumpSignIn(
      tester,
      access: FakeAccessGateway(),
      core: FakeGateway(),
      methods: const AccessMethods(google: false, googleBrowser: false, phone: true),
    );
    expect(find.text(AccessCopy.continueWithGoogle), findsNothing);
    expect(find.text(AccessCopy.usePhone), findsOneWidget);
  });

  testWidgets('Google opening the browser says to finish there, and a closed browser says so', (tester) async {
    final access = FakeAccessGateway()..googleOutcome = GoogleOutcome.browserOpened;
    await _pumpSignIn(tester, access: access, core: FakeGateway());
    await tester.tap(find.text(AccessCopy.continueWithGoogle));
    await tester.pumpAndSettle();
    expect(find.text(AccessCopy.finishInBrowser), findsOneWidget, reason: 'the browser opening is not a quiet cancel');
    expect(find.text(AccessCopy.cancel), findsOneWidget);

    access.oauth.add(const OAuthReturn(OAuthReturnKind.cancelled));
    await tester.pumpAndSettle();
    expect(find.text(AccessCopy.finishInBrowser), findsNothing);
    expect(find.text(AccessCopy.googleClosed), findsOneWidget);
  });

  testWidgets('a failed browser return shows the problem with the next step', (tester) async {
    final access = FakeAccessGateway()..googleOutcome = GoogleOutcome.browserOpened;
    await _pumpSignIn(tester, access: access, core: FakeGateway());
    await tester.tap(find.text(AccessCopy.continueWithGoogle));
    await tester.pumpAndSettle();
    access.oauth.add(const OAuthReturn(OAuthReturnKind.failed, AccessFailure.googleUnavailable));
    await tester.pumpAndSettle();
    expect(find.text(AccessCopy.problem(AccessFailure.googleUnavailable)), findsOneWidget);
  });

  testWidgets('the password path is reachable and signs in through the access gateway', (tester) async {
    final access = FakeAccessGateway()..errors['password'] = AccessFailure.wrongPassword;
    await _pumpSignIn(tester, access: access, core: FakeGateway());
    await tester.tap(find.text(AccessCopy.methodPassword));
    await tester.pumpAndSettle();
    expect(find.byType(PasswordSignInForm), findsOneWidget);
    expect(find.text(AuthCopy.sendCode), findsNothing, reason: 'one method at a time');

    final fields = find.byType(TextField);
    expect(fields, findsNWidgets(2), reason: 'email and password');
    await tester.enterText(fields.at(0), 'asha@example.com');
    await tester.enterText(fields.at(1), 'hunter22');
    await tester.tap(find.text(AccessCopy.signIn).last);
    await tester.pumpAndSettle();
    expect(access.calls, ['password:asha@example.com:hunter22']);
    expect(find.text(AccessCopy.problem(AccessFailure.wrongPassword)), findsOneWidget);
  });

  testWidgets('sending a code from the sign-in screen still opens the code screen and says where it went', (tester) async {
    final core = FakeGateway();
    await _pumpSignIn(tester, access: FakeAccessGateway(), core: core);
    await tester.enterText(find.byType(TextField).first, 'asha@example.com');
    await tester.pump();
    await tester.tap(find.text(AuthCopy.sendCode));
    await tester.pumpAndSettle();
    expect(core.sent, ['asha@example.com']);
    expect(find.textContaining(AuthCopy.codeLeadPrefix.trim()), findsOneWidget);
  });
}
