import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import '../access_routes.dart';
import 'google_button.dart';
import 'password_sign_in_form.dart';

enum SignInMethod { emailCode, password }

/// Every way to sign in, for the sign-in screen: Google on top (one tap when it works), then a
/// choice between the email code (the screen's own form, passed in as [emailCode]) and a
/// password, and the phone when the build has it. One method works at a time; the others wait.
class SignInMethods extends ConsumerStatefulWidget {
  const SignInMethods({
    super.key,
    required this.emailCode,
    this.initialMethod = SignInMethod.emailCode,
    this.initialEmail = '',
    this.onForgotPassword,
    this.onPhone,
  });

  /// The existing email-code block (email field and "Send code").
  final Widget emailCode;
  final SignInMethod initialMethod;

  /// Prefills the password form's email.
  final String initialEmail;

  /// Defaults to opening [AccountAccessRoutes.forgotPassword].
  final VoidCallback? onForgotPassword;

  /// Defaults to opening [AccountAccessRoutes.phoneSignIn].
  final VoidCallback? onPhone;

  @override
  ConsumerState<SignInMethods> createState() => _SignInMethodsState();
}

class _SignInMethodsState extends ConsumerState<SignInMethods> {
  late SignInMethod _method = widget.initialMethod;
  bool _googleBusy = false;
  bool _passwordBusy = false;

  @override
  Widget build(BuildContext context) {
    final methods = ref.watch(accessMethodsProvider);
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);

    final body = switch (_method) {
      SignInMethod.emailCode => KeyedSubtree(key: const ValueKey(SignInMethod.emailCode), child: widget.emailCode),
      SignInMethod.password => PasswordSignInForm(
          key: const ValueKey(SignInMethod.password),
          initialEmail: widget.initialEmail,
          busy: _googleBusy,
          onBusyChanged: (v) => setState(() => _passwordBusy = v),
          onForgotPassword: widget.onForgotPassword ??
              () => context.push(AccountAccessRoutes.forgotPasswordFor(email: widget.initialEmail)),
        ),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (methods.google) ...[
          GoogleSignInButton(busy: _passwordBusy, onBusyChanged: (v) => setState(() => _googleBusy = v)),
          const SizedBox(height: MmSpace.s20),
          Row(
            children: [
              Expanded(child: Divider(color: colors.line, height: 1)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                child: Text(AccessCopy.or, style: type.small.copyWith(color: colors.ink3)),
              ),
              Expanded(child: Divider(color: colors.line, height: 1)),
            ],
          ),
          const SizedBox(height: MmSpace.s20),
        ],
        MmSegmented<SignInMethod>(
          semanticsLabel: AccessCopy.methodsLabel,
          segments: const [
            MmSegment(SignInMethod.emailCode, AccessCopy.methodCode),
            MmSegment(SignInMethod.password, AccessCopy.methodPassword),
          ],
          value: _method,
          onChanged: _googleBusy || _passwordBusy ? null : (m) => setState(() => _method = m),
        ),
        const SizedBox(height: MmSpace.s24),
        AnimatedSwitcher(
          duration: reduced ? Duration.zero : const Duration(milliseconds: 180),
          switchInCurve: Motion.glide,
          switchOutCurve: Motion.glide,
          child: body,
        ),
        if (methods.phone) ...[
          const SizedBox(height: MmSpace.s12),
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(
              label: AccessCopy.usePhone,
              onPressed: _googleBusy || _passwordBusy
                  ? null
                  : widget.onPhone ?? () => context.push(AccountAccessRoutes.phoneSignIn),
            ),
          ),
        ],
      ],
    );
  }
}
