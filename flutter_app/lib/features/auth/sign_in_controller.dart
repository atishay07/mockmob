import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api.dart' show nowProvider;
import '../../core/auth/auth.dart' show AuthFailure, GoogleOutcome, OAuthReturn, OAuthReturnKind, SignInException;
import '../../core/router/router.dart' show intendedRouteProvider;
import '../../core/router/router_redirect.dart' show IntendedRoute;
import '../../core/storage/prefs_store.dart';
import 'after_sign_in.dart';
import 'sign_in_gateway.dart';
import 'sign_in_state.dart';

/// Where the after-sign-in sheet offer is remembered on this phone, so it comes up once.
final signInPrefsStoreProvider = Provider<PrefsStore>(
  (ref) => SharedPrefsStore(),
);

const String _beforeYouStartOfferedKey = 'auth_before_you_start_offered';

/// The server asks for 60 seconds between codes (spec 5.2).
const Duration kResendCooldown = Duration(seconds: 60);

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

String normalizeEmail(String raw) => raw.trim().toLowerCase();

bool isValidEmail(String raw) => _emailPattern.hasMatch(normalizeEmail(raw));

/// Drives both sign-in screens. It outlives them, so the typed email, the cooldown and the
/// "code sent" memory survive going back and forth, and nothing typed is ever lost to an error.
class SignInController extends Notifier<SignInState> {
  StreamSubscription<OAuthReturn>? _returns;

  @override
  SignInState build() {
    ref.onDispose(() => _returns?.cancel());
    return const SignInState();
  }

  DateTime _now() => ref.read(nowProvider)();

  void setEmail(String value) {
    if (value == state.email) return;
    state = state.copyWith(
      email: value,
      clearProblem: state.problemStep == SignInStep.email,
    );
  }

  void clearProblem() {
    if (state.problem != null) state = state.copyWith(clearProblem: true);
  }

  /// The code screen opened without an address (a restored route): take it from the link.
  void adoptEmail(String value) {
    if (state.email.isEmpty && value.isNotEmpty) {
      state = state.copyWith(email: value);
    }
  }

  /// Emails a code. [step] says which screen asked, so the message lands under the right field.
  /// Returns true when a code was sent.
  Future<bool> sendCode({required SignInStep step}) async {
    if (state.isBusy) return false;
    final email = normalizeEmail(state.email);
    if (!isValidEmail(email)) {
      _fail(SignInProblem.invalidEmail, step);
      return false;
    }
    state = state.copyWith(
      busy: SignInBusy.sending,
      clearProblem: true,
      codeResentNotice: false,
    );
    try {
      await ref.read(signInGatewayProvider).sendCode(email);
      if (!ref.mounted) return false;
      state = state.copyWith(
        busy: SignInBusy.none,
        codeSentTo: email,
        resendAvailableAt: _now().add(kResendCooldown),
        codeResentNotice: step == SignInStep.code,
      );
      return true;
    } on SignInException catch (e) {
      _failFrom(e.failure, step, startCooldown: true);
    } on Object {
      _fail(SignInProblem.unknown, step);
    }
    return false;
  }

  /// Verifies the code. On success the core auth state turns signed in and the router moves on.
  Future<void> verify(String code) async {
    if (state.isBusy || code.length != 8) return;
    final email = normalizeEmail(state.email);
    state = state.copyWith(
      busy: SignInBusy.verifying,
      clearProblem: true,
      codeResentNotice: false,
    );
    final offer = await _sheetOffer();
    if (!ref.mounted) return;
    try {
      await ref.read(signInGatewayProvider).verifyCode(email, code);
      await _finish(offer);
    } on SignInException catch (e) {
      _failFrom(e.failure, SignInStep.code);
    } on Object {
      _fail(SignInProblem.unknown, SignInStep.code);
    }
  }

  /// Google sign-in for screens that run it through this controller (onboarding's save step; the
  /// sign-in screen uses the Google button of the account-access feature). A cancel returns
  /// quietly. When the browser took over ([SignInState.googleInBrowser]) that is not a cancel:
  /// the controller waits for the callback link and reports a cancel or a failure from there.
  Future<void> signInWithGoogle() async {
    if (state.isBusy) return;
    state = state.copyWith(busy: SignInBusy.google, clearProblem: true, googleInBrowser: false);
    final offer = await _sheetOffer();
    if (!ref.mounted) return;
    try {
      final outcome = await ref.read(signInGatewayProvider).signInWithGoogle();
      switch (outcome) {
        case GoogleOutcome.signedIn:
          await _finish(offer);
        case GoogleOutcome.cancelled:
          if (ref.mounted) state = state.copyWith(busy: SignInBusy.none);
        case GoogleOutcome.browserOpened:
          if (!ref.mounted) return;
          state = state.copyWith(busy: SignInBusy.none, googleInBrowser: true);
          _watchBrowserReturn(offer);
      }
    } on SignInException catch (e) {
      _failFrom(e.failure, SignInStep.email);
    } on Object {
      _fail(SignInProblem.unknown, SignInStep.email);
    }
  }

  /// The student closed the "finish in your browser" wait.
  void cancelGoogleBrowser() {
    _returns?.cancel();
    if (state.googleInBrowser) state = state.copyWith(googleInBrowser: false);
  }

  /// The sign-in screen's Google button signed the student in (on the spot or through the
  /// browser): the first sign-in on this phone still gets its one sheet. The router moves on by
  /// itself.
  Future<void> googleSignedIn() async {
    final offer = await _sheetOffer();
    if (!ref.mounted || !offer.forUser(ref.read(signInGatewayProvider).userId)) return;
    ref.read(afterSignInSheetLauncherProvider)();
    await _markOffered();
  }

  void _watchBrowserReturn(_SheetOffer offer) {
    _returns?.cancel();
    _returns = ref.read(signInGatewayProvider).oauthReturns().listen(
      (result) async {
        if (!ref.mounted) return;
        switch (result.kind) {
          case OAuthReturnKind.exchanging:
            // Google answered; signedIn or failed follows.
            break;
          case OAuthReturnKind.signedIn:
            state = state.copyWith(googleInBrowser: false);
            if (offer.forUser(ref.read(signInGatewayProvider).userId)) {
              ref.read(afterSignInSheetLauncherProvider)();
              await _markOffered();
            }
          case OAuthReturnKind.cancelled:
            state = state.copyWith(googleInBrowser: false);
          case OAuthReturnKind.failed:
            state = state.copyWith(googleInBrowser: false);
            _fail(SignInProblem.googleUnavailable, SignInStep.email);
        }
      },
      onError: (Object _) {},
    );
  }

  Future<void> _finish(_SheetOffer offer) async {
    if (!ref.mounted) return;
    final gateway = ref.read(signInGatewayProvider);
    if (!gateway.isSignedIn) {
      // The code worked but the account did not load. Work and email stay; the router keeps
      // the remembered route for when it does.
      _fail(SignInProblem.accountNotLoaded, SignInStep.code);
      return;
    }
    if (offer.forUser(gateway.userId)) {
      ref.read(afterSignInSheetLauncherProvider)();
      await _markOffered();
    }
    if (ref.mounted) state = const SignInState();
  }

  /// The first sign-in on a phone is followed by one sheet over Today (the saved state of the
  /// student's sheet and the usage-data choice; spec 5.2, 5.1.6). A deep link the student was
  /// heading to wins, and so does a phone that has already shown it. The router itself goes to
  /// the remembered route or Today; the sheet opens on top once Today is there.
  ///
  /// Read before sign-in, because the router takes the remembered route as soon as the account
  /// loads; [_SheetOffer.forUser] settles it once the account is known.
  ///
  /// A preferences failure is never allowed to hold sign-in: it answers "no sheet".
  Future<_SheetOffer> _sheetOffer() async {
    final remembered = ref.read(intendedRouteProvider).snapshot();
    try {
      final offered = await ref.read(signInPrefsStoreProvider).getBool(_beforeYouStartOfferedKey) ?? false;
      return _SheetOffer(owed: !offered, remembered: remembered);
    } on Object {
      return _SheetOffer(owed: false, remembered: remembered);
    }
  }

  Future<void> _markOffered() async {
    try {
      await ref.read(signInPrefsStoreProvider).setBool(_beforeYouStartOfferedKey, true);
    } on Object {
      // Offered again next time at worst.
    }
  }

  void _failFrom(
    AuthFailure failure,
    SignInStep step, {
    bool startCooldown = false,
  }) {
    final problem = switch (failure) {
      AuthFailure.invalidCode => SignInProblem.invalidCode,
      AuthFailure.rateLimited => SignInProblem.rateLimited,
      AuthFailure.offline => SignInProblem.offline,
      AuthFailure.invalidEmail => SignInProblem.invalidEmail,
      AuthFailure.notConfigured => SignInProblem.notAvailable,
      AuthFailure.googleUnavailable => SignInProblem.googleUnavailable,
      AuthFailure.unknown => SignInProblem.unknown,
    };
    _fail(
      problem,
      step,
      restartCooldown: startCooldown && problem == SignInProblem.rateLimited,
    );
  }

  void _fail(
    SignInProblem problem,
    SignInStep step, {
    bool restartCooldown = false,
  }) {
    if (!ref.mounted) return;
    state = state.copyWith(
      busy: SignInBusy.none,
      problem: problem,
      problemStep: step,
      resendAvailableAt: restartCooldown ? _now().add(kResendCooldown) : null,
    );
  }
}

final signInControllerProvider =
    NotifierProvider<SignInController, SignInState>(SignInController.new);

/// The after-sign-in sheet decision, read before sign-in and settled once the account is known.
class _SheetOffer {
  const _SheetOffer({required this.owed, required this.remembered});

  /// This phone has not shown the sheet yet.
  final bool owed;

  /// What the router remembered before sign-in (a copy: the router forgets it on sign-in).
  final IntendedRoute remembered;

  /// The sheet opens unless the router takes this account to a remembered route instead. A
  /// route left behind by another student's expired session is dropped for [userId], so it
  /// does not cost them the sheet.
  bool forUser(String? userId) => owed && remembered.locationFor(userId) == null;
}
