import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import '../state/password_hints.dart';
import 'access_field.dart';
import 'volt_key.dart';

/// Email and password. Signing in hands the session to the core auth state and the router
/// moves on; the form only shows the working and failed states. A successful sign-in tells the
/// phone's password manager to save the pair.
class PasswordSignInForm extends ConsumerStatefulWidget {
  const PasswordSignInForm({
    super.key,
    this.initialEmail = '',
    this.onForgotPassword,
    this.onSignedIn,
    this.autofocus = false,
    this.onBusyChanged,
    this.busy = false,
  });

  final String initialEmail;
  final VoidCallback? onForgotPassword;
  final VoidCallback? onSignedIn;
  final bool autofocus;
  final ValueChanged<bool>? onBusyChanged;

  /// Another method on the screen is working.
  final bool busy;

  @override
  ConsumerState<PasswordSignInForm> createState() => _PasswordSignInFormState();
}

enum _Bad { email, password, both }

class _PasswordSignInFormState extends ConsumerState<PasswordSignInForm> {
  late final TextEditingController _email = TextEditingController(
    text: widget.initialEmail,
  );
  final TextEditingController _password = TextEditingController();
  final FocusNode _passwordFocus = FocusNode();
  bool _working = false;
  String? _problem;
  _Bad? _bad;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _setWorking(bool value) {
    if (!mounted) return;
    setState(() => _working = value);
    widget.onBusyChanged?.call(value);
  }

  Future<void> _submit() async {
    if (_working || widget.busy) return;
    FocusScope.of(context).unfocus();
    final email = _email.text.trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      setState(() {
        _problem = AccessCopy.problem(AccessFailure.invalidEmail);
        _bad = _Bad.email;
      });
      return;
    }
    if (_password.text.isEmpty) {
      setState(() {
        _problem = AccessCopy.enterPassword;
        _bad = _Bad.password;
      });
      return;
    }
    setState(() {
      _problem = null;
      _bad = null;
    });
    _setWorking(true);
    // Read before the await: the router may replace this screen as soon as the session lands.
    final hints = ref.read(passwordHintsProvider);
    try {
      await ref
          .read(accountAccessGatewayProvider)
          .signInWithPassword(email, _password.text);
      TextInput.finishAutofillContext();
      // This account has a password, so the "Set a password" nudge is not shown to it here.
      unawaited(hints.markPasswordSet().catchError((Object _) {}));
      widget.onSignedIn?.call();
    } on AccessException catch (e) {
      if (!mounted) return;
      setState(() {
        _problem = AccessCopy.problem(e.failure);
        _bad = e.failure == AccessFailure.wrongPassword ? _Bad.both : null;
      });
      _setWorking(false);
      return;
    } on Object {
      if (!mounted) return;
      setState(() => _problem = AccessCopy.problem(AccessFailure.unknown));
      _setWorking(false);
      return;
    }
    // Stays in the working state until the router replaces the screen.
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = !_working && !widget.busy;

    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AccessField(
            kind: AccessFieldKind.email,
            label: AccessCopy.emailLabel,
            hint: AccessCopy.emailHint,
            controller: _email,
            autofocus: widget.autofocus && widget.initialEmail.isEmpty,
            enabled: enabled,
            hasError: _bad == _Bad.email || _bad == _Bad.both,
            textInputAction: TextInputAction.next,
            onSubmitted: _passwordFocus.requestFocus,
            onChanged: (_) {
              if (_bad != null) setState(() => _bad = null);
            },
          ),
          const SizedBox(height: MmSpace.s16),
          AccessField(
            kind: AccessFieldKind.password,
            label: AccessCopy.passwordLabel,
            controller: _password,
            focusNode: _passwordFocus,
            autofocus: widget.autofocus && widget.initialEmail.isNotEmpty,
            enabled: enabled,
            hasError: _bad == _Bad.password || _bad == _Bad.both,
            onSubmitted: _submit,
            onChanged: (_) {
              if (_bad != null) setState(() => _bad = null);
            },
          ),
          if (_problem != null) ...[
            const SizedBox(height: MmSpace.s12),
            AccessProblemLine(message: _problem!),
          ],
          const SizedBox(height: MmSpace.s20),
          VoltKey(
            label: _working ? AccessCopy.signingIn : AccessCopy.signIn,
            loading: _working,
            onPressed: enabled ? _submit : null,
          ),
          if (widget.onForgotPassword != null) ...[
            const SizedBox(height: MmSpace.s8),
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.quiet(
                label: AccessCopy.forgotPassword,
                onPressed: enabled ? widget.onForgotPassword : null,
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s12),
          Text(
            AccessCopy.noPasswordYet,
            style: type.small.copyWith(color: colors.ink3),
          ),
        ],
      ),
    );
  }
}
