import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../access_copy.dart';
import '../widgets/access_page.dart';
import '../widgets/phone_code_form.dart';

/// Sign in with a code by text, for a phone already on an account (PHONE_SIGN_IN builds only).
class PhoneSignInScreen extends StatelessWidget {
  const PhoneSignInScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AccessPage(
      title: AccessCopy.phoneTitle,
      lead: AccessCopy.phoneLead,
      onBack: context.canPop() ? () => context.pop() : null,
      child: const PhoneCodeForm(purpose: PhoneCodePurpose.signIn),
    );
  }
}

/// Add a phone to the signed-in account (PHONE_SIGN_IN builds only).
class AddPhoneScreen extends StatelessWidget {
  const AddPhoneScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AccessPage(
      title: AccessCopy.addPhoneTitle,
      lead: AccessCopy.addPhoneLead,
      onBack: context.canPop() ? () => context.pop() : null,
      child: PhoneCodeForm(
        purpose: PhoneCodePurpose.addToAccount,
        onDone: () => context.canPop() ? context.pop() : context.go(AppRoutes.you),
      ),
    );
  }
}
