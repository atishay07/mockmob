import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../account_access/widgets/sign_in_methods.dart';
import 'auth_page.dart';
import 'copy.dart';
import 'email_field.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// Sign-in (spec 5.2): every way in on one screen. Google when the build has it, then the email
/// code (the email and one key to send a code) or a password, and the phone when that is on. The
/// methods come from [SignInMethods]; this screen owns the email-code block and its code screen.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key, this.autofocus = true});

  final bool autofocus;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  late final TextEditingController _email = TextEditingController(
    text: ref.read(signInControllerProvider).email,
  );

  /// Google or the password form is working, so the email key waits.
  bool _otherBusy = false;

  @override
  void initState() {
    super.initState();
    // A leftover message from the code screen does not belong here.
    Future.microtask(() {
      if (!mounted) return;
      final s = ref.read(signInControllerProvider);
      if (s.problemStep == SignInStep.code) {
        ref.read(signInControllerProvider.notifier).clearProblem();
      }
    });
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    FocusScope.of(context).unfocus();
    final sent = await ref
        .read(signInControllerProvider.notifier)
        .sendCode(step: SignInStep.email);
    if (sent && mounted) {
      context.push(
        AppRoutes.signInCode(
          email: ref.read(signInControllerProvider).email.trim().toLowerCase(),
        ),
      );
    }
  }

  void _haveCode() {
    final email = _email.text.trim().toLowerCase();
    context.push(AppRoutes.signInCode(email: email));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = ref.watch(signInControllerProvider);
    final notifier = ref.read(signInControllerProvider.notifier);

    final problem = state.problemFor(SignInStep.email);
    final problemText = problem == null
        ? null
        : AuthCopy.problem(problem, SignInStep.email);
    final sending = state.busy == SignInBusy.sending;
    final typed = _email.text.trim().toLowerCase();
    final held = state.isBusy || _otherBusy;

    return AuthPage(
      step: SignInStep.email,
      onBack: Navigator.of(context).canPop() ? () => context.pop() : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(AuthCopy.signInTitle, style: type.headline),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(
            AuthCopy.signInLead,
            style: type.lead.copyWith(color: colors.ink2),
          ),
          const SizedBox(height: MmSpace.group),
          SignInMethods(
            initialEmail: state.email,
            busy: state.isBusy,
            onBusyChanged: (busy) => setState(() => _otherBusy = busy),
            onSignedIn: notifier.googleSignedIn,
            emailCode: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                EmailField(
                  controller: _email,
                  autofocus: widget.autofocus,
                  enabled: !held,
                  hasError: problem == SignInProblem.invalidEmail,
                  onChanged: (value) {
                    notifier.setEmail(value);
                    setState(() {});
                  },
                  onSubmitted: _send,
                ),
                if (problemText != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  ProblemLine(message: problemText),
                ],
                const SizedBox(height: MmSpace.s20),
                KeyButton(
                  label: sending ? AuthCopy.sendingCode : AuthCopy.sendCode,
                  loading: sending,
                  onPressed: held ? null : _send,
                ),
                if (state.hasCodeFor(typed) && !held) ...[
                  const SizedBox(height: MmSpace.s12),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      AuthCopy.codeSentTo(typed),
                      style: type.small.copyWith(color: colors.ink2),
                    ),
                  ),
                  const SizedBox(height: MmSpace.s4),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: KeyButton.quiet(
                      label: AuthCopy.alreadyHaveCode,
                      onPressed: _haveCode,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s24),
          Text(
            AuthCopy.newHere,
            style: type.small.copyWith(color: colors.ink3),
          ),
        ],
      ),
    );
  }
}
