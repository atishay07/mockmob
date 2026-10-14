import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth.dart';
import '../../../core/router/router.dart' show intendedRouteProvider;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import '../access_routes.dart';
import '../widgets/access_field.dart';
import '../widgets/access_page.dart';
import '../widgets/form_message.dart';

/// "Forgot password": the same emailed 8-digit code as the code sign-in (it signs the student
/// in), then "Choose a new password". It uses MockMob's own login email, so it works without
/// Supabase's email templates or a recovery link that has to come back into the app.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key, this.email});

  final String? email;

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  late final TextEditingController _email = TextEditingController(
    text: widget.email ?? '',
  );
  final TextEditingController _code = TextEditingController();
  String? _sentTo;
  bool _sending = false;
  bool _checking = false;
  String? _problem;
  DateTime? _resendAt;
  Timer? _tick;

  /// The server allows one code a minute.
  static const _cooldown = Duration(seconds: 60);

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _tick?.cancel();
    super.dispose();
  }

  AccountAccessGateway get _gateway => ref.read(accountAccessGatewayProvider);

  int get _secondsLeft {
    final at = _resendAt;
    if (at == null) return 0;
    final left = at.difference(DateTime.now()).inSeconds + 1;
    return left.clamp(0, _cooldown.inSeconds);
  }

  void _startCooldown() {
    _resendAt = DateTime.now().add(_cooldown);
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() {});
      if (_secondsLeft == 0) t.cancel();
    });
  }

  Future<void> _send() async {
    if (_sending || _checking) return;
    final email = _email.text.trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      setState(() => _problem = AccessCopy.problem(AccessFailure.invalidEmail));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _problem = null;
    });
    try {
      await _gateway.sendEmailCode(email);
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentTo = email;
        _startCooldown();
      });
    } on AccessException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _problem = AccessCopy.problem(e.failure);
        if (e.failure == AccessFailure.rateLimited) _startCooldown();
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _problem = AccessCopy.problem(AccessFailure.unknown);
      });
    }
  }

  Future<void> _verify() async {
    final email = _sentTo;
    if (email == null || _checking) return;
    if (_code.text.length != 8) {
      setState(() => _problem = AccessCopy.problem(AccessFailure.invalidCode));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _checking = true;
      _problem = null;
    });
    // Once the code signs the student in, the router leaves the sign-in screens for the
    // remembered route: here, "Choose a new password". Anything remembered before is kept.
    final intended = ref.read(intendedRouteProvider);
    final previous = intended.location;
    intended.remember(AccountAccessRoutes.setPasswordAfterReset);
    try {
      await _gateway.verifyEmailCode(email, _code.text);
      // Stays "Checking" until the router replaces this screen.
    } on Object catch (e) {
      if (previous != null) {
        intended.remember(previous);
      } else {
        intended.clear();
      }
      if (!mounted) return;
      setState(() {
        _checking = false;
        _problem = AccessCopy.problem(
          e is AccessException ? e.failure : AccessFailure.unknown,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final sentTo = _sentTo;
    final left = _secondsLeft;

    return AccessPage(
      title: AccessCopy.forgotTitle,
      lead: AccessCopy.forgotLead,
      onBack: context.canPop() ? () => context.pop() : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (sentTo == null) ...[
            AccessField(
              kind: AccessFieldKind.email,
              label: AccessCopy.emailLabel,
              hint: AccessCopy.emailHint,
              controller: _email,
              autofocus: (widget.email ?? '').isEmpty,
              enabled: !_sending,
              hasError: _problem != null,
              onSubmitted: _send,
            ),
          ] else ...[
            Text(
              AccessCopy.codeSentTo(sentTo),
              style: type.body.copyWith(color: colors.ink2),
            ),
            const SizedBox(height: MmSpace.s16),
            AccessField(
              kind: AccessFieldKind.code,
              label: AccessCopy.codeLabel,
              controller: _code,
              autofocus: true,
              enabled: !_checking,
              hasError: _problem != null,
              onSubmitted: _verify,
            ),
          ],
          const SizedBox(height: MmSpace.s8),
          FormMessage(problem: _problem, working: _sending || _checking),
          const SizedBox(height: MmSpace.s16),
          if (sentTo == null)
            KeyButton(
              label: _sending ? AccessCopy.sendingCode : AccessCopy.emailMeCode,
              loading: _sending,
              onPressed: _sending || left > 0 ? null : _send,
              disabledReason: left > 0 && !_sending
                  ? AccessCopy.resendIn(left)
                  : null,
            )
          else ...[
            KeyButton(
              label: _checking ? AccessCopy.checking : AccessCopy.continueLabel,
              loading: _checking,
              onPressed: _checking ? null : _verify,
            ),
            const SizedBox(height: MmSpace.s4),
            Wrap(
              spacing: MmSpace.s8,
              children: [
                KeyButton.quiet(
                  label: left > 0
                      ? AccessCopy.resendIn(left)
                      : (_sending
                            ? AccessCopy.sendingCode
                            : AccessCopy.resendCode),
                  onPressed: left > 0 || _sending || _checking ? null : _send,
                ),
                KeyButton.quiet(
                  label: AccessCopy.differentEmail,
                  onPressed: _checking
                      ? null
                      : () => setState(() {
                          _sentTo = null;
                          _code.clear();
                          _problem = null;
                        }),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
