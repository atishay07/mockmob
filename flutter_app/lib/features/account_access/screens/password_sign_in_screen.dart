import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../access_copy.dart';
import '../access_routes.dart';
import '../widgets/access_page.dart';
import '../widgets/password_sign_in_form.dart';

/// Sign in with email and password, on its own screen (for a link from the email-code screen).
class PasswordSignInScreen extends StatelessWidget {
  const PasswordSignInScreen({super.key, this.email});

  final String? email;

  @override
  Widget build(BuildContext context) {
    return AccessPage(
      title: AccessCopy.passwordTitle,
      lead: AccessCopy.passwordLead,
      onBack: context.canPop() ? () => context.pop() : null,
      child: PasswordSignInForm(
        initialEmail: email ?? '',
        autofocus: true,
        onForgotPassword: () => context.push(AccountAccessRoutes.forgotPasswordFor(email: email)),
      ),
    );
  }
}
