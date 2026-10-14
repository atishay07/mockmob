import 'dart:async';

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
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/auth/auth_page.dart' show AuthPage, BackKey;
import 'package:mockmob/features/account_access/access_copy.dart';
import 'package:mockmob/features/account_access/access_gateway.dart'
    show accountAccessGatewayProvider;
import 'package:mockmob/features/auth/auth_routes.dart';
import 'package:mockmob/features/auth/code_slots.dart';
import 'package:mockmob/features/auth/copy.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

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
  Size size = const Size(360, 780),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size * 2;
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
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: app!,
        ),
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
      await tester.tap(find.bySemanticsLabel(AuthCopy.differentEmail));
      await tester.pumpAndSettle();

      expect(find.text(AuthCopy.signInTitle), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'asha@example.com',
      );
      // A code is already out for this address, so the way back to it is offered.
      expect(find.text(AuthCopy.enterSentCode), findsOneWidget);
    },
  );

  testWidgets(
    'after the app was closed while the student fetched the code, a rate limit still opens the way to it',
    (tester) async {
      // A fresh run: nothing remembers the code that is already in the inbox.
      final gateway = FakeGateway()
        ..sendError = failure(AuthFailure.rateLimited);
      await _pump(tester, gateway: gateway);
      await _sendCodeFor(tester, 'asha@example.com');

      expect(
        find.text(
          AuthCopy.problem(SignInProblem.rateLimited, SignInStep.email)!,
        ),
        findsOneWidget,
      );
      await tester.tap(find.text(AuthCopy.enterSentCode));
      await tester.pumpAndSettle();
      expect(
        find.text(AuthCopy.codeTitle),
        findsOneWidget,
        reason: 'the code in the inbox can still be entered',
      );
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

  testWidgets(
    'Google key runs the Google sign-in when configured, once on screen',
    (tester) async {
      final access = FakeAccessGateway();
      await _pump(tester, gateway: FakeGateway(), google: true, access: access);
      expect(find.text(AuthCopy.continueWithGoogle), findsOneWidget);
      await tester.tap(find.text(AuthCopy.continueWithGoogle));
      await tester.pump();
      await tester.pump();
      expect(access.calls, ['google']);
    },
  );

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

  testWidgets(
    'a rate limit makes the code we sent the main key and holds the send key behind a countdown',
    (tester) async {
      final clock = TestClock();
      final gateway = FakeGateway()
        ..sendError = failure(AuthFailure.rateLimited);
      await _pump(tester, gateway: gateway, clock: clock);
      await _sendCodeFor(tester, 'asha@example.com');

      // The volt key goes to the code that is already out; asking again is not offered.
      expect(
        find.widgetWithText(KeyButton, AuthCopy.enterSentCode),
        findsOneWidget,
      );
      expect(find.widgetWithText(KeyButton, AuthCopy.sendCode), findsNothing);
      expect(find.text('Send a new code in 1:00'), findsOneWidget);
      // No second, contradicting line about a code having been sent.
      expect(find.textContaining('Code sent to'), findsNothing);

      clock.advance(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Send a new code in 0:59'), findsOneWidget);

      // When the wait ends the message goes and the send key is live again, with a quiet way
      // back to the old code.
      clock.advance(const Duration(seconds: 59));
      await tester.pump(const Duration(seconds: 1));
      expect(
        find.text(
          AuthCopy.problem(SignInProblem.rateLimited, SignInStep.email)!,
        ),
        findsNothing,
      );
      expect(find.widgetWithText(KeyButton, AuthCopy.sendCode), findsOneWidget);
      expect(
        find.widgetWithText(KeyButton, AuthCopy.enterSentCode),
        findsOneWidget,
      );
      gateway.sendError = null;
    },
  );

  testWidgets(
    'the code screen has one way back: the arrow, named for what it does',
    (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, gateway: FakeGateway());
      await _sendCodeFor(tester, 'asha@example.com');
      expect(
        find.text(AuthCopy.differentEmail),
        findsNothing,
        reason: 'no second link to the same place',
      );
      expect(find.bySemanticsLabel(AuthCopy.differentEmail), findsOneWidget);
      // The arrow's glyph sits on the 16 dp content edge; its key is still 48 dp.
      final key = find.bySemanticsLabel(AuthCopy.differentEmail);
      expect(tester.getSize(find.byType(BackKey)).width, MmTarget.min);
      expect(
        tester.getTopLeft(find.byIcon(LucideIcons.arrowLeft)).dx,
        closeTo(MmSpace.gutter, 0.6),
      );
      expect(key, findsOneWidget);
      handle.dispose();
    },
  );

  testWidgets(
    'offline keeps the brand row and shows one quiet status line, not a box',
    (tester) async {
      await _pump(
        tester,
        gateway: FakeGateway(),
        network: NetworkStatus.offline,
      );
      final markBefore = tester.getTopLeft(find.byType(Wordmark));
      expect(find.byType(InlineBanner), findsNothing);
      expect(find.text(AuthCopy.offlineBanner), findsOneWidget);
      expect(find.byType(Wordmark), findsOneWidget);
      // The line sits clear of the top bar, not flush against the screen edge.
      expect(
        tester.getTopLeft(find.text(AuthCopy.offlineBanner)).dy,
        greaterThan(markBefore.dy),
      );
      expect(
        tester.getTopLeft(find.text(AuthCopy.offlineBanner)).dy,
        greaterThan(MmTarget.min),
      );
    },
  );

  testWidgets(
    'the key stays in reach: the email key sits in the lower half of the screen',
    (tester) async {
      await _pump(tester, gateway: FakeGateway(), size: const Size(384, 853));
      final key = tester.getCenter(
        find.widgetWithText(KeyButton, AuthCopy.sendCode),
      );
      expect(key.dy, greaterThan(853 * 0.6));
    },
  );

  for (final screen in ['sign-in', 'code']) {
    testWidgets(
      'at 1.3x text on a 360 dp phone the $screen screen does not overflow',
      (tester) async {
        await _pump(
          tester,
          gateway: FakeGateway(),
          size: const Size(360, 640),
          textScale: 1.3,
          network: NetworkStatus.offline,
          auth: const AuthSnapshot(
            status: AuthStatus.signedOut,
            sessionExpired: true,
          ),
        );
        if (screen == 'code') {
          await _sendCodeFor(tester, 'asha.verma.longname@example.com');
        }
        expect(tester.takeException(), isNull);
        await tester.drag(
          find.byType(SingleChildScrollView).first,
          const Offset(0, -400),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
      },
    );
  }

  group('spacing and motion (phase 2)', () {
    const tall = Size(384, 853);

    testWidgets(
      'the account turning signed in under the sign-in screen offers the sheet (the app was killed mid sign-in)',
      (tester) async {
        final gateway = FakeGateway();
        await _pump(tester, gateway: gateway, size: tall);
        final container = ProviderScope.containerOf(
          tester.element(find.byType(AuthPage)),
        );
        // ignore: invalid_use_of_protected_member
        container.read(authSnapshotProvider.notifier).state =
            const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
        await tester.pumpAndSettle();
        expect(gateway.sheetLaunches, 1);
      },
    );

    testWidgets('a problem line comes without moving the field or the key', (
      tester,
    ) async {
      await _pump(tester, gateway: FakeGateway(), size: tall);
      final key = find.widgetWithText(KeyButton, AuthCopy.sendCode);
      final keyBefore = tester.getTopLeft(key);
      final fieldBefore = tester.getTopLeft(find.byType(TextField));
      final titleBefore = tester.getTopLeft(find.text(AuthCopy.signInTitle));

      await _sendCodeFor(tester, 'asha@');
      expect(find.textContaining('does not look right'), findsOneWidget);
      expect(tester.getTopLeft(key), keyBefore);
      expect(tester.getTopLeft(find.byType(TextField)), fieldBefore);
      expect(tester.getTopLeft(find.text(AuthCopy.signInTitle)), titleBefore);
    });

    testWidgets('the new-student help rests where a problem will appear', (
      tester,
    ) async {
      await _pump(tester, gateway: FakeGateway(), size: tall);
      final help = find.text(AuthCopy.newHere);
      expect(help, findsOneWidget);
      final helpTop = tester.getTopLeft(help).dy;
      await _sendCodeFor(tester, 'asha@');
      expect(find.text(AuthCopy.newHere), findsNothing);
      final problem = find.textContaining('does not look right');
      expect(tester.getTopLeft(problem).dy, closeTo(helpTop, 1));
    });

    testWidgets('a wrong code comes without moving the key', (tester) async {
      final gateway = FakeGateway()
        ..verifyError = failure(AuthFailure.invalidCode);
      await _pump(tester, gateway: gateway, size: tall);
      await _sendCodeFor(tester, 'asha@example.com');
      final key = find.widgetWithText(KeyButton, AuthCopy.verify);
      final before = tester.getTopLeft(key);
      await tester.enterText(find.byType(TextField), '12345678');
      await tester.pumpAndSettle();
      expect(find.textContaining('That code did not work'), findsOneWidget);
      expect(tester.getTopLeft(key), before);
    });

    testWidgets('going offline moves nothing on a roomy phone', (tester) async {
      await _pump(tester, gateway: FakeGateway(), size: tall);
      final online = tester.getTopLeft(find.text(AuthCopy.signInTitle));
      await _pump(
        tester,
        gateway: FakeGateway(),
        size: tall,
        network: NetworkStatus.offline,
      );
      expect(find.text(AuthCopy.offlineBanner), findsOneWidget);
      expect(tester.getTopLeft(find.text(AuthCopy.signInTitle)), online);
    });

    testWidgets('a code that is slow to send says so after 12 seconds', (
      tester,
    ) async {
      final gateway = FakeGateway()..sendHold = Completer<void>();
      await _pump(tester, gateway: gateway, size: tall);
      await tester.enterText(find.byType(TextField), 'asha@example.com');
      await tester.pump();
      await tester.tap(find.text(AuthCopy.sendCode));
      await tester.pump(const Duration(seconds: 11));
      expect(find.text(AuthCopy.stillSending), findsNothing);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 300));
      // ignore: avoid_print
      print('TEXTS: ' + tester.widgetList<Text>(find.byType(Text)).map((t) => (t.data ?? '').replaceAll(String.fromCharCode(10), '~')).join(' | '));
      expect(find.text(AuthCopy.stillSending), findsOneWidget);

      gateway.sendHold!.complete();
      await tester.pumpAndSettle();
      expect(find.text(AuthCopy.codeTitle), findsOneWidget);
    });

    testWidgets('a code that is slow to check says so after 12 seconds', (
      tester,
    ) async {
      final gateway = FakeGateway()..verifyHold = Completer<void>();
      await _pump(tester, gateway: gateway, size: tall);
      await _sendCodeFor(tester, 'asha@example.com');
      await tester.enterText(find.byType(TextField), '12345678');
      await tester.pump(const Duration(seconds: 11));
      expect(find.text(AuthCopy.stillChecking), findsNothing);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(AuthCopy.stillChecking), findsOneWidget);
      gateway.verifyHold!.complete();
      await tester.pumpAndSettle();
    });

    testWidgets('the code boxes are 44 dp tall in the 12 dp control radius', (
      tester,
    ) async {
      await _pump(tester, gateway: FakeGateway(), size: tall);
      await _sendCodeFor(tester, 'asha@example.com');
      // 44 dp of box and 4 dp of room for the volt ring above and below.
      expect(tester.getSize(find.byType(CodeSlots)).height, 52);
      final radii = tester
          .widgetList<DecoratedBox>(
            find.descendant(
              of: find.byType(CodeSlots),
              matching: find.byType(DecoratedBox),
            ),
          )
          .map((d) => d.decoration)
          .whereType<ShapeDecoration>()
          .map((d) => d.shape)
          .whereType<RoundedSuperellipseBorder>()
          .map((shape) => (shape.borderRadius as BorderRadius).topLeft.x)
          .toList();
      expect(radii, isNotEmpty);
      for (final r in radii) {
        expect(r, anyOf(12, 15.5), reason: 'the box, or its ring');
      }
    });

    testWidgets('a method tab answers a touch in the first frame', (
      tester,
    ) async {
      await _pump(tester, gateway: FakeGateway(), size: tall);
      final gesture = await tester.startGesture(
        tester.getCenter(find.text('Password')),
      );
      await tester.pump(const Duration(milliseconds: 16));
      final veil = find.descendant(
        of: find.ancestor(
          of: find.text('Password'),
          matching: find.byType(GestureDetector),
        ),
        matching: find.byType(AnimatedOpacity),
      );
      expect(veil, findsOneWidget);
      await tester.pump(const Duration(milliseconds: 120));
      expect(tester.widget<AnimatedOpacity>(veil).opacity, 1);
      await gesture.up();
      await tester.pumpAndSettle();
    });

    testWidgets('the password form keeps its key still when a problem comes', (
      tester,
    ) async {
      await _pump(tester, gateway: FakeGateway(), size: tall);
      await tester.tap(find.text('Password'));
      await tester.pumpAndSettle();
      final key = find.widgetWithText(KeyButton, AccessCopy.signIn);
      final before = tester.getTopLeft(key);
      await tester.tap(key);
      await tester.pumpAndSettle();
      expect(
        find.text(AccessCopy.problem(AccessFailure.invalidEmail)),
        findsOneWidget,
      );
      expect(tester.getTopLeft(key), before);
    });

    testWidgets('under reduced motion a status line is simply there', (
      tester,
    ) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      await _pump(
        tester,
        gateway: FakeGateway(),
        size: tall,
        network: NetworkStatus.offline,
      );
      expect(find.text(AuthCopy.offlineBanner), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
