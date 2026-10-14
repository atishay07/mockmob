import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/account_access/access_gateway.dart';
import 'package:mockmob/features/account_access/state/password_hints.dart';

/// A gateway whose answers each test decides. A [hold] keeps a call pending so the working
/// state can be seen.
class FakeAccessGateway implements AccountAccessGateway {
  final calls = <String>[];
  final errors = <String, AccessFailure>{};
  GoogleOutcome googleOutcome = GoogleOutcome.signedIn;
  Completer<void>? hold;
  final oauth = StreamController<OAuthReturn>.broadcast();

  Future<void> _call(String name) async {
    calls.add(name);
    await hold?.future;
    final failure = errors[name.split(':').first];
    if (failure != null) throw AccessException(failure);
  }

  @override
  Future<GoogleOutcome> continueWithGoogle() async {
    await _call('google');
    return googleOutcome;
  }

  @override
  Future<void> continueWithGoogleInBrowser() => _call('googleBrowser');

  @override
  Stream<OAuthReturn> oauthReturns() => oauth.stream;

  @override
  Future<void> signInWithPassword(String email, String password) => _call('password:$email:$password');

  @override
  Future<void> setPassword(String password) => _call('setPassword:$password');

  @override
  Future<void> signOutOtherDevices() => _call('signOutOthers');

  @override
  Future<void> sendEmailCode(String email) => _call('sendEmailCode:$email');

  @override
  Future<void> verifyEmailCode(String email, String code) => _call('verifyEmailCode:$email:$code');

  @override
  Future<void> sendPhoneCode(String phoneE164) => _call('sendPhoneCode:$phoneE164');

  @override
  Future<void> verifyPhoneCode(String phoneE164, String code) => _call('verifyPhoneCode:$phoneE164:$code');

  @override
  Future<void> addPhone(String phoneE164) => _call('addPhone:$phoneE164');

  @override
  Future<void> verifyPhoneChange(String phoneE164, String code) => _call('verifyPhoneChange:$phoneE164:$code');
}

class OnlineNetwork extends NetworkStatusNotifier {
  @override
  NetworkStatus build() => NetworkStatus.online;
}

const signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com');

/// Pumps [child] at [path] inside a router that also knows the paths the screens navigate to.
Future<GoRouter> pumpAccess(
  WidgetTester tester, {
  required FakeAccessGateway gateway,
  required Widget Function(BuildContext, GoRouterState) builder,
  String path = '/screen',
  AccessMethods methods = const AccessMethods(google: true, googleBrowser: true, phone: false),
  AuthSnapshot auth = signedIn,
  MemoryPrefsStore? prefs,
  List<GoRoute> extraRoutes = const [],
}) async {
  tester.view.physicalSize = const Size(720, 1600);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  final router = GoRouter(
    initialLocation: path,
    routes: [
      GoRoute(path: path, builder: builder),
      ...extraRoutes,
    ],
  );
  addTearDown(router.dispose);

  final List<Override> overrides = [
    accountAccessGatewayProvider.overrideWithValue(gateway),
    accessMethodsProvider.overrideWithValue(methods),
    networkStatusProvider.overrideWith(OnlineNetwork.new),
    authSnapshotProvider.overrideWithBuild((ref, notifier) => auth),
    accessPrefsStoreProvider.overrideWithValue(prefs ?? MemoryPrefsStore()),
  ];

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(routerConfig: router, theme: buildTheme(Brightness.light), debugShowCheckedModeBanner: false),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}
