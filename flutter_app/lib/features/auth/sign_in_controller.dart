import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api.dart' show nowProvider;
import '../../core/auth/auth.dart'
    show
        AuthFailure,
        GoogleOutcome,
        OAuthReturn,
        OAuthReturnKind,
        SignInException;
import '../../core/router/router.dart' show intendedRouteProvider;
import '../../core/router/router_redirect.dart' show IntendedRoute;
import 'after_sign_in.dart';
import 'sign_in_gateway.dart';
import 'sign_in_state.dart';

export 'after_sign_in.dart' show signInPrefsStoreProvider;

/// The server asks for 60 seconds between codes (spec 5.2).
const Duration kResendCooldown = Duration(seconds: 60);

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

String normalizeEmail(String raw) => raw.trim().toLowerCase();

bool isValidEmail(String raw) => _emailPattern.hasMatch(normalizeEmail(raw));

/// Drives both sign-in screens. It outlives them, so the typed email, the cooldown and the
/// "code sent" memory survive going back and forth, and nothing typed is ever lost to an error.
class SignInController extends Notifier<SignInState> {
  StreamSubscription<OAuthReturn>? _returns;

  /// What the router remembered when a sign-in on the sign-in screen began ([signInStarting]).
  IntendedRoute? _rememberedAtStart;

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
      if (e.failure == AuthFailure.rateLimited && ref.mounted) {
        // The server limits codes per address, so a code went to this address a moment ago,
        // maybe before the app was closed while the student fetched it from the mail app.
        // "I already have a code" stays open for it; asking again would only wait.
        state = state.copyWith(codeSentTo: email);
      }
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
    final remembered = _remembered();
    try {
      await ref.read(signInGatewayProvider).verifyCode(email, code);
      await _finish(remembered);
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
    state = state.copyWith(
      busy: SignInBusy.google,
      clearProblem: true,
      googleInBrowser: false,
    );
    final remembered = _remembered();
    try {
      final outcome = await ref.read(signInGatewayProvider).signInWithGoogle();
      switch (outcome) {
        case GoogleOutcome.signedIn:
          await _finish(remembered);
        case GoogleOutcome.cancelled:
          if (ref.mounted) state = state.copyWith(busy: SignInBusy.none);
        case GoogleOutcome.browserOpened:
          if (!ref.mounted) return;
          state = state.copyWith(busy: SignInBusy.none, googleInBrowser: true);
          _watchBrowserReturn(remembered);
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

  /// A sign-in on the sign-in screen (the Google button or the password form) is starting. The
  /// router takes the remembered route as soon as the account loads, which is before
  /// [googleSignedIn] runs, so it is read now.
  void signInStarting() => _rememberedAtStart = _remembered();

  /// The sign-in screen's Google button or password form signed the student in (on the spot or
  /// through the browser): the first sign-in on this phone still gets its one sheet. The router
  /// moves on by itself.
  Future<void> googleSignedIn() async {
    final remembered = _rememberedAtStart ?? _remembered();
    _rememberedAtStart = null;
    await _offerSheet(remembered);
  }

  /// Waits for a browser sign-in started by [signInWithGoogle]. Listens for one result only: a
  /// later browser sign-in (after a sign-out, say) belongs to whatever started it.
  void _watchBrowserReturn(IntendedRoute remembered) {
    _returns?.cancel();
    _returns = ref.read(signInGatewayProvider).oauthReturns().listen((
      result,
    ) async {
      if (!ref.mounted) return;
      if (result.kind != OAuthReturnKind.exchanging) {
        unawaited(_returns?.cancel());
        _returns = null;
      }
      switch (result.kind) {
        case OAuthReturnKind.exchanging:
          // Google answered; signedIn or failed follows.
          break;
        case OAuthReturnKind.signedIn:
          state = state.copyWith(googleInBrowser: false);
          await _offerSheet(remembered);
        case OAuthReturnKind.cancelled:
          state = state.copyWith(googleInBrowser: false);
        case OAuthReturnKind.failed:
          state = state.copyWith(googleInBrowser: false);
          _fail(SignInProblem.googleUnavailable, SignInStep.email);
      }
    }, onError: (Object _) {});
  }

  /// Opens the after-sign-in sheet when it is owed: once the account has loaded (a browser
  /// return arrives before it does), when this phone has not shown it, and when the router is
  /// not taking the student to a remembered route instead. The launcher records it as shown
  /// only once it is on screen.
  Future<void> _offerSheet(IntendedRoute remembered) async {
    final gateway = ref.read(signInGatewayProvider);
    if (!await gateway.whenSignedIn() || !ref.mounted) return;
    final offer = await _sheetOffer(remembered);
    if (!ref.mounted || !offer.forUser(gateway.userId)) return;
    ref.read(afterSignInSheetLauncherProvider)();
  }

  Future<void> _finish(IntendedRoute remembered) async {
    if (!ref.mounted) return;
    final gateway = ref.read(signInGatewayProvider);
    if (!gateway.isSignedIn) {
      // The code worked but the account did not load. Work and email stay; the router keeps
      // the remembered route for when it does.
      _fail(SignInProblem.accountNotLoaded, SignInStep.code);
      return;
    }
    await _offerSheet(remembered);
    if (ref.mounted) state = const SignInState();
  }

  /// The first sign-in on a phone is followed by one sheet over Today (the saved state of the
  /// student's sheet and the usage-data choice; spec 5.2, 5.1.6). A deep link the student was
  /// heading to wins, and so does a phone that has already shown it. The router itself goes to
  /// the remembered route or Today; the sheet opens on top once Today is there.
  ///
  /// [remembered] is read before sign-in ([_remembered]), because the router takes the
  /// remembered route as soon as the account loads; [_SheetOffer.forUser] settles it once the
  /// account is known. Whether the phone has shown it is read now, so a sheet shown since the
  /// sign-in began is not shown again.
  ///
  /// A preferences failure is never allowed to hold sign-in: it answers "no sheet".
  Future<_SheetOffer> _sheetOffer(IntendedRoute remembered) async {
    final offered = await beforeYouStartOffered(
      ref.read(signInPrefsStoreProvider),
    );
    return _SheetOffer(owed: !offered, remembered: remembered);
  }

  /// A copy of what the router remembers now.
  IntendedRoute _remembered() => ref.read(intendedRouteProvider).snapshot();

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
  bool forUser(String? userId) =>
      owed && remembered.locationFor(userId) == null;
}
