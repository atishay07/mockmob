import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';

/// Shown when the app could not open the stored session or read the profile (the router sends
/// `AuthStatus.unknown` with `loadFailed` here). This is not a sign-out: the session and the
/// student's work are untouched, so the screen says so and offers one key. The controller also
/// retries by itself when the app comes back to the front and when the network returns.
class AuthLoadFailedScreen extends ConsumerWidget {
  const AuthLoadFailedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: StateView(
          kind: StateViewKind.error,
          title: AuthCopy.loadFailedTitle,
          message: AuthCopy.loadFailedBody,
          primary: StateAction(
            AuthCopy.tryAgain,
            () => ref.read(authSnapshotProvider.notifier).retryStart(),
          ),
        ),
      ),
    );
  }
}
