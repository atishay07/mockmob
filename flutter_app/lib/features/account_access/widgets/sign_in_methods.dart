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

/// Air above and below the "or" divider, so the Google key and the method choice read as two
/// separate ways in.
const double _orGap = MmSpace.s20 + MmSpace.s8;

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
    this.busy = false,
    this.onBusyChanged,
    this.onSignedIn,
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

  /// The screen's own email-code form is working (sending a code): hold Google, the method
  /// choice and the phone key until it is done.
  final bool busy;

  /// Tells the screen when Google or the password form is working, so it can hold its own keys.
  final ValueChanged<bool>? onBusyChanged;

  /// Google or the password signed the student in (on the spot or through the browser). The
  /// router moves on by itself; this is for what the screen does besides.
  final VoidCallback? onSignedIn;

  @override
  ConsumerState<SignInMethods> createState() => _SignInMethodsState();
}

class _SignInMethodsState extends ConsumerState<SignInMethods> {
  late SignInMethod _method = widget.initialMethod;
  bool _googleBusy = false;
  bool _passwordBusy = false;

  bool get _otherBusy => _googleBusy || _passwordBusy;

  void _setBusy({bool? google, bool? password}) {
    final before = _otherBusy;
    setState(() {
      _googleBusy = google ?? _googleBusy;
      _passwordBusy = password ?? _passwordBusy;
    });
    if (before != _otherBusy) widget.onBusyChanged?.call(_otherBusy);
  }

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
          busy: _googleBusy || widget.busy,
          onBusyChanged: (v) => _setBusy(password: v),
          onSignedIn: widget.onSignedIn,
          onForgotPassword: widget.onForgotPassword ??
              () => context.push(AccountAccessRoutes.forgotPasswordFor(email: widget.initialEmail)),
        ),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (methods.google) ...[
          GoogleSignInButton(
            busy: _passwordBusy || widget.busy,
            onSignedIn: widget.onSignedIn,
            onBusyChanged: (v) => _setBusy(google: v),
          ),
          const SizedBox(height: _orGap),
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
          const SizedBox(height: _orGap),
        ],
        MmSegmented<SignInMethod>(
          semanticsLabel: AccessCopy.methodsLabel,
          segments: const [
            MmSegment(SignInMethod.emailCode, AccessCopy.methodCode),
            MmSegment(SignInMethod.password, AccessCopy.methodPassword),
          ],
          value: _method,
          onChanged: _otherBusy || widget.busy ? null : (m) => setState(() => _method = m),
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
            // The quiet key carries 16 dp of inner padding; pull it back so its label lines up.
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(
                label: AccessCopy.usePhone,
                onPressed: _otherBusy || widget.busy
                    ? null
                    : widget.onPhone ?? () => context.push(AccountAccessRoutes.phoneSignIn),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
