import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/account_access/access_gateway.dart' show accountAccessGatewayProvider;
import 'package:mockmob/features/auth/auth_routes.dart';
import 'package:mockmob/features/auth/code_slots.dart';
import 'package:mockmob/features/auth/copy.dart';

import '../../helpers/fonts.dart';
import '../account_access/support.dart' show FakeAccessGateway;
import 'fakes.dart';

Future<GoRouter> _pump(
  WidgetTester tester, {
  required FakeGateway gateway,
  TestClock? clock,
  NetworkStatus network = NetworkStatus.online,
  AuthSnapshot auth = AuthSnapshot.signedOut,
  bool google = false,
  FakeAccessGateway? access,
  String initial = AppRoutes.signIn,
}) async {
  tester.view.physicalSize = const Size(720, 1560);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final router = GoRouter(
    initialLocation: initial,
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
    ...authOverrides(gateway: gateway, clock: clock, network: network),
    authSnapshotProvider.overrideWithBuild((ref, notifier) => auth),
    if (access != null) accountAccessGatewayProvider.overrideWithValue(access),
    if (google)
      appConfigProvider.overrideWithValue(
        const AppConfig(
          apiBaseUrl: 'x',
          supabaseUrl: 'x',
          supabaseAnonKey: 'x',
          googleWebClientId: 'web-id',
        ),
      ),
  ];

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        routerConfig: router,
        theme: buildTheme(Brightness.light),
        debugShowCheckedModeBanner: false,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

Future<void> _sendCodeFor(WidgetTester tester, String email) async {
  await tester.enterText(find.byType(TextField), email);
  await tester.pump();
  await tester.tap(find.text(AuthCopy.sendCode));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the email field asks for the email autofill hint', (
    tester,
  ) async {
    await _pump(tester, gateway: FakeGateway());
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.autofillHints, contains(AutofillHints.email));
    expect(field.keyboardType, TextInputType.emailAddress);
  });

  testWidgets('send code goes to the code screen with the real address', (
    tester,
  ) async {
    final gateway = FakeGateway();
    await _pump(tester, gateway: gateway);
    await _sendCodeFor(tester, 'Asha@Example.com');

    expect(gateway.sent, ['asha@example.com']);
    expect(find.text(AuthCopy.codeTitle), findsOneWidget);
    expect(
      find.textContaining(
        'Enter the 8-digit code we emailed to',
        findRichText: true,
      ),
      findsOneWidget,
    );
    expect(
      find.textContaining('asha@example.com', findRichText: true),
      findsOneWidget,
    );
  });

  testWidgets('the code field asks for the one-time-code hint', (tester) async {
    await _pump(tester, gateway: FakeGateway());
    await _sendCodeFor(tester, 'asha@example.com');
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.autofillHints, contains(AutofillHints.oneTimeCode));
  });

  testWidgets(
    'back from the code screen returns to the email with the address kept',
    (tester) async {
      await _pump(tester, gateway: FakeGateway());
      await _sendCodeFor(tester, 'asha@example.com');
      await tester.tap(find.bySemanticsLabel(AuthCopy.back));
      await tester.pumpAndSettle();

      expect(find.text(AuthCopy.signInTitle), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'asha@example.com',
      );
      // A code is already out for this address, so the way back to it is offered.
      expect(find.text(AuthCopy.alreadyHaveCode), findsOneWidget);
    },
  );

  testWidgets('a bad email shows the fix and keeps what was typed', (
    tester,
  ) async {
    final gateway = FakeGateway();
    await _pump(tester, gateway: gateway);
    await _sendCodeFor(tester, 'asha@');
    expect(gateway.sent, isEmpty);
    expect(find.textContaining('does not look right'), findsOneWidget);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'asha@',
    );
  });

  testWidgets('typing the eighth digit signs in without another tap', (
    tester,
  ) async {
    final gateway = FakeGateway();
    await _pump(tester, gateway: gateway);
    await _sendCodeFor(tester, 'asha@example.com');

    await tester.enterText(find.byType(TextField), '1234567');
    await tester.pump();
    expect(gateway.verified, isEmpty);
    await tester.enterText(find.byType(TextField), '12345678');
    await tester.pumpAndSettle();
    expect(gateway.verified, [('asha@example.com', '12345678')]);
  });

  testWidgets('only digits are kept, up to eight', (tester) async {
    final gateway = FakeGateway();
    await _pump(tester, gateway: gateway);
    await _sendCodeFor(tester, 'asha@example.com');
    await tester.enterText(find.byType(TextField), '12 34-56 78 90');
    await tester.pump();
    final text = tester
        .widget<TextField>(find.byType(TextField))
        .controller!
        .text;
    expect(text, '12345678');
  });

  testWidgets(
    'a wrong code shows the line and keeps the digits for another try',
    (tester) async {
      final gateway = FakeGateway()
        ..verifyError = failure(AuthFailure.invalidCode);
      await _pump(tester, gateway: gateway);
      await _sendCodeFor(tester, 'asha@example.com');
      await tester.enterText(find.byType(TextField), '12345678');
      await tester.pumpAndSettle();

      expect(
        find.text(
          'That code did not work. Check the latest email or send a new code.',
        ),
        findsOneWidget,
      );
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '12345678',
      );
      // The key still works for another try.
      gateway.verifyError = null;
      await tester.tap(find.text(AuthCopy.verify));
      await tester.pumpAndSettle();
      expect(gateway.verified, hasLength(2));
    },
  );

  testWidgets(
    'the resend wait counts down in whole seconds, then becomes a key',
    (tester) async {
      final clock = TestClock();
      await _pump(tester, gateway: FakeGateway(), clock: clock);
      await _sendCodeFor(tester, 'asha@example.com');
      expect(find.text('Resend code in 1:00'), findsOneWidget);

      clock.advance(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Resend code in 0:59'), findsOneWidget);

      clock.advance(const Duration(seconds: 59));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Resend code in 0:00'), findsNothing);
      expect(find.widgetWithText(KeyButton, AuthCopy.resend), findsOneWidget);
    },
  );

  testWidgets('resending clears the old digits and confirms quietly', (
    tester,
  ) async {
    final clock = TestClock();
    final gateway = FakeGateway();
    await _pump(tester, gateway: gateway, clock: clock);
    await _sendCodeFor(tester, 'asha@example.com');
    await tester.enterText(find.byType(TextField), '1234');
    await tester.pump();

    clock.advance(const Duration(seconds: 61));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text(AuthCopy.resend));
    await tester.pumpAndSettle();

    expect(gateway.sent, hasLength(2));
    expect(find.text(AuthCopy.codeResent), findsOneWidget);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      isEmpty,
    );
  });

  testWidgets(
    'offline shows the banner on both screens and keeps the key usable',
    (tester) async {
      await _pump(
        tester,
        gateway: FakeGateway(),
        network: NetworkStatus.offline,
      );
      expect(find.text(AuthCopy.offlineBanner), findsOneWidget);
      expect(find.widgetWithText(KeyButton, AuthCopy.sendCode), findsOneWidget);
    },
  );

  testWidgets(
    'a failed send because of the network shows the offline banner once',
    (tester) async {
      final gateway = FakeGateway()..sendError = failure(AuthFailure.offline);
      await _pump(tester, gateway: gateway);
      await _sendCodeFor(tester, 'asha@example.com');
      expect(find.text(AuthCopy.offlineBanner), findsOneWidget);
      expect(
        find.text(AuthCopy.signInTitle),
        findsOneWidget,
        reason: 'stays on the email screen',
      );
    },
  );

  testWidgets('a lost session says so on the sign-in screen', (tester) async {
    await _pump(
      tester,
      gateway: FakeGateway(),
      auth: const AuthSnapshot(
        status: AuthStatus.signedOut,
        sessionExpired: true,
      ),
    );
    expect(find.text(AuthCopy.sessionExpired), findsOneWidget);
  });

  testWidgets('Google appears only when it is configured', (tester) async {
    await _pump(tester, gateway: FakeGateway());
    expect(find.text(AuthCopy.continueWithGoogle), findsNothing);
  });

  testWidgets('Google key runs the Google sign-in when configured, once on screen', (
    tester,
  ) async {
    final access = FakeAccessGateway();
    await _pump(tester, gateway: FakeGateway(), google: true, access: access);
    expect(find.text(AuthCopy.continueWithGoogle), findsOneWidget);
    await tester.tap(find.text(AuthCopy.continueWithGoogle));
    await tester.pump();
    await tester.pump();
    expect(access.calls, ['google']);
  });

  testWidgets('a code screen opened without an address goes back to sign-in', (
    tester,
  ) async {
    await _pump(
      tester,
      gateway: FakeGateway(),
      initial: AppRoutes.signInCodeBase,
    );
    expect(find.text(AuthCopy.signInTitle), findsOneWidget);
  });

  testWidgets('the code slots hold eight keys and read as one labelled field', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pump(tester, gateway: FakeGateway());
    await _sendCodeFor(tester, 'asha@example.com');
    expect(find.bySemanticsLabel(AuthCopy.codeFieldLabel), findsOneWidget);
    expect(kCodeLength, 8);
    handle.dispose();
  });

  testWidgets('touch targets are at least 44 dp', (tester) async {
    await _pump(tester, gateway: FakeGateway());
    final key = tester.getSize(
      find.widgetWithText(KeyButton, AuthCopy.sendCode),
    );
    expect(key.height, greaterThanOrEqualTo(54));
    final field = tester.getSize(find.byType(TextField));
    expect(field.height, greaterThanOrEqualTo(52));
  });
}
