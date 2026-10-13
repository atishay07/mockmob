import 'dart:async';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api.dart' show nowProvider;
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart'
    show NetworkStatusNotifier;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/auth/after_sign_in.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_gateway.dart';

/// A gateway whose answers the test decides.
class FakeGateway implements SignInGateway {
  Object? sendError;
  Object? verifyError;
  Object? googleError;
  GoogleOutcome googleOutcome = GoogleOutcome.signedIn;

  /// Browser sign-in results, as the callback link would deliver them.
  final StreamController<OAuthReturn> returns = StreamController<OAuthReturn>.broadcast();
  bool signedInAfterVerify = true;
  bool _signedIn = false;

  /// When set, verifying waits for it (to hold a screen in its signing-in state).
  Completer<void>? verifyHold;

  final List<String> sent = [];
  final List<(String, String)> verified = [];
  int googleCalls = 0;

  /// Times the after-sign-in sheet was opened over Today.
  int sheetLaunches = 0;

  @override
  Future<void> sendCode(String email) async {
    sent.add(email);
    final e = sendError;
    if (e != null) throw e;
  }

  @override
  Future<void> verifyCode(String email, String code) async {
    verified.add((email, code));
    await verifyHold?.future;
    final e = verifyError;
    if (e != null) throw e;
    _signedIn = signedInAfterVerify;
  }

  @override
  Future<GoogleOutcome> signInWithGoogle() async {
    googleCalls++;
    final e = googleError;
    if (e != null) throw e;
    _signedIn = googleOutcome == GoogleOutcome.signedIn;
    return googleOutcome;
  }

  @override
  Stream<OAuthReturn> oauthReturns() => returns.stream;

  @override
  bool get isSignedIn => _signedIn;

  /// The account a sign-in lands on.
  String signsInAs = 'u1';

  @override
  String? get userId => _signedIn ? signsInAs : null;
}

/// A preferences store whose every call fails, like a phone whose storage is not answering.
///
/// Every method returns a correctly typed rejected future (a `noSuchMethod` stub cannot: its
/// untyped error future fails the return cast and is then reported as an unhandled error).
class BrokenPrefs implements PrefsStore {
  Future<T> _down<T>() => Future<T>.error(StateError('prefs down'));

  @override
  Future<bool?> getBool(String key) => _down();

  @override
  Future<int?> getInt(String key) => _down();

  @override
  Future<String?> getString(String key) => _down();

  @override
  Future<List<String>?> getStringList(String key) => _down();

  @override
  Future<void> setBool(String key, bool value) => _down();

  @override
  Future<void> setInt(String key, int value) => _down();

  @override
  Future<void> setString(String key, String value) => _down();

  @override
  Future<void> setStringList(String key, List<String> value) => _down();

  @override
  Future<void> remove(String key) => _down();
}

class FakeNetwork extends NetworkStatusNotifier {
  FakeNetwork(this.value);

  final NetworkStatus value;

  @override
  NetworkStatus build() => value;
}

/// The mutable clock the cooldown reads.
class TestClock {
  TestClock([DateTime? start]) : value = start ?? DateTime(2026, 10, 12, 21, 0);

  DateTime value;

  DateTime call() => value;

  void advance(Duration d) => value = value.add(d);
}

List<Override> authOverrides({
  required FakeGateway gateway,
  PrefsStore? prefs,
  TestClock? clock,
  NetworkStatus network = NetworkStatus.online,
}) {
  final c = clock ?? TestClock();
  return [
    signInGatewayProvider.overrideWithValue(gateway),
    afterSignInSheetLauncherProvider.overrideWithValue(() => gateway.sheetLaunches++),
    signInPrefsStoreProvider.overrideWithValue(prefs ?? MemoryPrefsStore()),
    nowProvider.overrideWithValue(c.call),
    networkStatusProvider.overrideWith(() => FakeNetwork(network)),
  ];
}

SignInException failure(AuthFailure f) => SignInException(f);
