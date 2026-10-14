import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/config/app_config.dart';

/// The calls the account-access screens make, so tests can replace Supabase and the network.
/// Every method throws [AccessException] with a failure the screens have copy for.
abstract interface class AccountAccessGateway {
  /// The native account sheet when it works on this phone, else the browser.
  Future<GoogleOutcome> continueWithGoogle();

  /// Google in the browser, chosen by the student.
  Future<void> continueWithGoogleInBrowser();

  /// Browser sign-in results as the callback link arrives.
  Stream<OAuthReturn> oauthReturns();

  Future<void> signInWithPassword(String email, String password);

  /// Sets or changes the signed-in student's password.
  Future<void> setPassword(String password);

  /// Ends this account's sessions on every other device, keeping this one.
  Future<void> signOutOtherDevices();

  /// `POST /api/auth/email-login`, the same 8-digit code the email sign-in uses.
  Future<void> sendEmailCode(String email);

  Future<void> verifyEmailCode(String email, String code);

  Future<void> sendPhoneCode(String phoneE164);
  Future<void> verifyPhoneCode(String phoneE164, String code);
  Future<void> addPhone(String phoneE164);
  Future<void> verifyPhoneChange(String phoneE164, String code);
}

/// The real thing: the core [AuthController].
class CoreAccountAccessGateway implements AccountAccessGateway {
  CoreAccountAccessGateway(this._ref);

  final Ref _ref;

  AuthController get _auth => _ref.read(authSnapshotProvider.notifier);

  @override
  Future<GoogleOutcome> continueWithGoogle() => _auth.continueWithGoogle();

  @override
  Future<void> continueWithGoogleInBrowser() => _auth.continueWithGoogleInBrowser();

  @override
  Stream<OAuthReturn> oauthReturns() => _auth.oauthReturns();

  @override
  Future<void> signInWithPassword(String email, String password) => _auth.signInWithPassword(email, password);

  @override
  Future<void> setPassword(String password) => _auth.setPassword(password);

  @override
  Future<void> signOutOtherDevices() => _auth.signOutOtherDevices();

  @override
  Future<void> sendEmailCode(String email) => _codeCall(() => _auth.sendEmailCode(email));

  @override
  Future<void> verifyEmailCode(String email, String code) => _codeCall(() => _auth.verifyEmailCode(email, code));

  @override
  Future<void> sendPhoneCode(String phoneE164) => _auth.sendPhoneCode(phoneE164);

  @override
  Future<void> verifyPhoneCode(String phoneE164, String code) => _auth.verifyPhoneCode(phoneE164, code);

  @override
  Future<void> addPhone(String phoneE164) => _auth.addPhone(phoneE164);

  @override
  Future<void> verifyPhoneChange(String phoneE164, String code) => _auth.verifyPhoneChange(phoneE164, code);

  /// The email-code calls report [SignInException]; these screens speak [AccessFailure].
  static Future<void> _codeCall(Future<void> Function() call) async {
    try {
      await call();
    } on SignInException catch (e) {
      throw AccessException(switch (e.failure) {
        AuthFailure.invalidCode => AccessFailure.invalidCode,
        AuthFailure.rateLimited => AccessFailure.rateLimited,
        AuthFailure.offline => AccessFailure.offline,
        AuthFailure.invalidEmail => AccessFailure.invalidEmail,
        AuthFailure.notConfigured => AccessFailure.notConfigured,
        AuthFailure.googleUnavailable => AccessFailure.googleUnavailable,
        AuthFailure.unknown => AccessFailure.unknown,
      });
    }
  }
}

final accountAccessGatewayProvider = Provider<AccountAccessGateway>(CoreAccountAccessGateway.new);

/// Which methods this build offers (from [AppConfig]).
class AccessMethods {
  const AccessMethods({required this.google, required this.googleBrowser, required this.phone});

  factory AccessMethods.of(AppConfig config) => AccessMethods(
        google: config.googleSignInEnabled,
        googleBrowser: config.googleBrowserEnabled,
        phone: config.phoneSignInEnabled,
      );

  final bool google;

  /// The browser flow is available as a fallback or a choice.
  final bool googleBrowser;
  final bool phone;
}

final accessMethodsProvider = Provider<AccessMethods>((ref) => AccessMethods.of(ref.watch(appConfigProvider)));

/// Normalises what the student typed into an E.164 Indian mobile number, or null.
String? indianMobileE164(String typed) {
  var digits = typed.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.length == 12 && digits.startsWith('91')) digits = digits.substring(2);
  if (digits.length == 11 && digits.startsWith('0')) digits = digits.substring(1);
  if (!RegExp(r'^[6-9][0-9]{9}$').hasMatch(digits)) return null;
  return '+91$digits';
}

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

bool looksLikeEmail(String typed) => _emailPattern.hasMatch(typed.trim());

/// Supabase's minimum is set to 8 in the dashboard (docs/AUTH.md); the screen checks first.
const int minPasswordLength = 8;
