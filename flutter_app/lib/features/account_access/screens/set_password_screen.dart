import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth.dart';
import '../../../core/router/routes.dart';
import '../access_copy.dart';
import '../state/password_hints.dart';
import '../widgets/access_page.dart';
import '../widgets/set_password_form.dart';

/// Set a password after an email-code or Google sign-in, or choose a new one after "Forgot
/// password" ([reset]). Needs a signed-in student.
class SetPasswordScreen extends ConsumerWidget {
  const SetPasswordScreen({super.key, this.reset = false});

  final bool reset;

  void _leave(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.today);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final email = ref.watch(authSnapshotProvider.select((s) => s.email));
    return AccessPage(
      title: reset ? AccessCopy.resetPasswordTitle : AccessCopy.setPasswordTitle,
      lead: reset ? AccessCopy.resetPasswordLead : AccessCopy.setPasswordLead,
      // maybePop, like the system back: the form holds Back while the password is saving.
      onBack: context.canPop() ? () => Navigator.of(context).maybePop() : null,
      child: SetPasswordForm(
        email: email,
        endOtherSessions: reset,
        onDone: () => _leave(context),
        onSkip: () async {
          if (!reset) await ref.read(passwordHintsProvider).dismissNudge();
          if (context.mounted) _leave(context);
        },
      ),
    );
  }
}
