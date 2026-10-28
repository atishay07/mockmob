import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'auth_page.dart';
import 'copy.dart';
import 'email_field.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// Sign-in (spec 5.2): the email, one key to send a code, and Google when it is configured.
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
    final googleOn = ref.watch(
      appConfigProvider.select((c) => c.googleSignInEnabled),
    );

    final problem = state.problemFor(SignInStep.email);
    final problemText = problem == null
        ? null
        : AuthCopy.problem(problem, SignInStep.email);
    final sending = state.busy == SignInBusy.sending;
    final googleBusy = state.busy == SignInBusy.google;
    final typed = _email.text.trim().toLowerCase();

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
          EmailField(
            controller: _email,
            autofocus: widget.autofocus,
            enabled: !state.isBusy,
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
            onPressed: state.isBusy ? null : _send,
          ),
          if (googleOn) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(
              label: googleBusy
                  ? AuthCopy.googleBusy
                  : AuthCopy.continueWithGoogle,
              loading: googleBusy,
              onPressed: state.isBusy ? null : notifier.signInWithGoogle,
            ),
          ],
          if (state.hasCodeFor(typed) && !state.isBusy) ...[
            const SizedBox(height: MmSpace.s8),
            Align(
              child: KeyButton.quiet(
                label: AuthCopy.alreadyHaveCode,
                onPressed: _haveCode,
              ),
            ),
          ],
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
