import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/widgets/widgets.dart';
import '../you/account/sign_out_flow.dart' show confirmSignOut, pendingWork;
import 'copy.dart';

/// Shown when the app could not open the stored session or read the profile (the router sends
/// `AuthStatus.unknown` with `loadFailed` here). This is not a sign-out: the session and the
/// student's work are untouched, so the screen says so and leads with Try again. The controller
/// also retries by itself when the app comes back to the front and when the network returns.
///
/// While a retry runs the screen stays and the key says so. When the profile keeps failing for
/// a reason a retry cannot fix, Sign out is the way to a different account; it asks first and
/// warns about anything still waiting to send, and the unsent work stays on the phone.
class AuthLoadFailedScreen extends ConsumerStatefulWidget {
  const AuthLoadFailedScreen({super.key});

  @override
  ConsumerState<AuthLoadFailedScreen> createState() =>
      _AuthLoadFailedScreenState();
}

class _AuthLoadFailedScreenState extends ConsumerState<AuthLoadFailedScreen> {
  bool _signingOut = false;

  /// A read that fails at once (a refused or offline request) would flip the key back before
  /// the eye sees it, so a tap looked dead. The key keeps its spinner at least this long.
  static const _minTry = Duration(milliseconds: 900);

  /// True from a tap until [_minTry] has passed.
  bool _holding = false;

  /// The student pressed Try again at least once: a failure after it says it tried.
  bool _tried = false;
  Timer? _hold;

  @override
  void dispose() {
    _hold?.cancel();
    super.dispose();
  }

  void _retry() {
    if (_holding) return;
    setState(() {
      _holding = true;
      _tried = true;
    });
    _hold?.cancel();
    _hold = Timer(_minTry, () {
      if (mounted) setState(() => _holding = false);
    });
    unawaited(ref.read(authSnapshotProvider.notifier).retryStart());
  }

  Future<void> _signOut() async {
    if (_signingOut) return;
    setState(() => _signingOut = true);
    try {
      final pending = await pendingWork(ref);
      if (!mounted) return;
      final confirmed = await confirmSignOut(
        context,
        pending: pending.count,
        unknown: pending.unknown,
      );
      if (!mounted || !confirmed) return;
      // Queued study writes stay for this account; with no profile loaded nothing else of it is
      // cleared either.
      await ref.read(authSnapshotProvider.notifier).signOut();
    } on Object {
      // The session could not be cleared; the student is still here and can try again.
    } finally {
      if (mounted) setState(() => _signingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Watched whole: a retry that starts the auth service also changes whether sign-out works.
    final snapshot = ref.watch(authSnapshotProvider);
    final retrying = snapshot.retrying || _holding;
    final auth = ref.read(authSnapshotProvider.notifier);
    return Scaffold(
      body: SafeArea(
        child: StateView(
          kind: StateViewKind.error,
          title: AuthCopy.loadFailedTitle,
          // What failed, in plain words; after a Try again that failed, it says it tried.
          message: AuthCopy.loadFailedMessage(snapshot.loadProblem, triedAgain: _tried && !retrying),
          // The label changes and the spinner turns in place, so nothing moves while it tries; a
          // loading key ignores taps.
          primary: StateAction(
            retrying ? AuthCopy.tryingAgain : AuthCopy.tryAgain,
            _signingOut ? () {} : _retry,
            loading: retrying,
          ),
          secondary: auth.canSignOut
              ? StateAction(AuthCopy.signOut, _signingOut ? () {} : _signOut)
              : null,
        ),
      ),
    );
  }
}
