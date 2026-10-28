import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api.dart' show nowProvider;
import '../../core/auth/auth.dart' show AuthFailure, SignInException;
import '../../core/router/router.dart' show intendedRouteProvider;
import '../../core/router/routes.dart';
import '../../core/storage/prefs_store.dart';
import 'sign_in_gateway.dart';
import 'sign_in_state.dart';

/// Where the "Before you start" offer is remembered on this phone, so it comes up once.
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
  @override
  SignInState build() => const SignInState();

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
    final offered = await _rememberBeforeYouStart();
    try {
      await ref.read(signInGatewayProvider).verifyCode(email, code);
      await _finish(offered);
    } on SignInException catch (e) {
      await _undoOffer(offered);
      _failFrom(e.failure, SignInStep.code);
    } on Object {
      await _undoOffer(offered);
      _fail(SignInProblem.unknown, SignInStep.code);
    }
  }

  /// Native Google sign-in. A cancel returns quietly to the screen.
  Future<void> signInWithGoogle() async {
    if (state.isBusy) return;
    state = state.copyWith(busy: SignInBusy.google, clearProblem: true);
    final offered = await _rememberBeforeYouStart();
    try {
      final signedIn = await ref.read(signInGatewayProvider).signInWithGoogle();
      if (!signedIn) {
        await _undoOffer(offered);
        if (ref.mounted) state = state.copyWith(busy: SignInBusy.none);
        return;
      }
      await _finish(offered);
    } on SignInException catch (e) {
      await _undoOffer(offered);
      _failFrom(e.failure, SignInStep.email);
    } on Object {
      await _undoOffer(offered);
      _fail(SignInProblem.unknown, SignInStep.email);
    }
  }

  Future<void> _finish(bool offered) async {
    if (!ref.mounted) return;
    if (!ref.read(signInGatewayProvider).isSignedIn) {
      // The code worked but the account did not load. Work and email stay; the router keeps
      // the remembered route for when it does.
      _fail(SignInProblem.accountNotLoaded, SignInStep.code);
      return;
    }
    if (offered) await _markOffered();
    if (ref.mounted) state = const SignInState();
  }

  /// New accounts see "Before you start" once (spec 5.2, 5.1.6). A deep link the student was
  /// heading to wins, and so does a phone that has already shown it. The router reads the
  /// remembered route as soon as the session turns signed in, so this has to be set first.
  Future<bool> _rememberBeforeYouStart() async {
    final intended = ref.read(intendedRouteProvider);
    if (intended.location != null) return false;
    if (await ref
            .read(signInPrefsStoreProvider)
            .getBool(_beforeYouStartOfferedKey) ??
        false) {
      return false;
    }
    intended.remember(AppRoutes.beforeYouStart);
    return true;
  }

  Future<void> _undoOffer(bool offered) async {
    if (!offered || !ref.mounted) return;
    final intended = ref.read(intendedRouteProvider);
    if (intended.location == AppRoutes.beforeYouStart &&
        !ref.read(signInGatewayProvider).isSignedIn) {
      intended.clear();
    }
  }

  Future<void> _markOffered() => ref
      .read(signInPrefsStoreProvider)
      .setBool(_beforeYouStartOfferedKey, true);

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
