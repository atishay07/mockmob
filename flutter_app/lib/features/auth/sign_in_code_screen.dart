import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api.dart' show nowProvider;
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'auth_page.dart';
import 'code_slots.dart';
import 'copy.dart';
import 'quiet_action.dart';
import 'resend_row.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// The code screen (spec 5.2): "Enter the 8-digit code we emailed to <address>". Eight digits
/// sign in on their own; the key is there for anyone who prefers it. Nothing typed is lost to
/// an error, and back returns to the email field with the address kept.
class SignInCodeScreen extends ConsumerStatefulWidget {
  const SignInCodeScreen({super.key, this.email, this.autofocus = true});

  /// The address from the route. Falls back to what the email screen kept.
  final String? email;
  final bool autofocus;

  @override
  ConsumerState<SignInCodeScreen> createState() => _SignInCodeScreenState();
}

class _SignInCodeScreenState extends ConsumerState<SignInCodeScreen> {
  final TextEditingController _code = TextEditingController();
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (!mounted) return;
      final notifier = ref.read(signInControllerProvider.notifier);
      if (widget.email != null) notifier.adoptEmail(widget.email!);
      if (ref.read(signInControllerProvider).email.isEmpty) {
        // Opened without an address (a restored route): there is nothing to verify against.
        context.go(AppRoutes.signIn);
        return;
      }
      if (ref.read(signInControllerProvider).problemStep == SignInStep.email) {
        notifier.clearProblem();
      }
    });
  }

  @override
  void dispose() {
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _back() {
    FocusScope.of(context).unfocus();
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.signIn);
    }
  }

  void _verify([String? value]) {
    FocusScope.of(context).unfocus();
    ref.read(signInControllerProvider.notifier).verify(value ?? _code.text);
  }

  Future<void> _resend() async {
    final sent = await ref
        .read(signInControllerProvider.notifier)
        .sendCode(step: SignInStep.code);
    if (sent && mounted) {
      // The old digits belong to the old code.
      _code.clear();
      _focus.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = ref.watch(signInControllerProvider);
    final notifier = ref.read(signInControllerProvider.notifier);
    final now = ref.watch(nowProvider);

    final problem = state.problemFor(SignInStep.code);
    final problemText = problem == null
        ? null
        : AuthCopy.problem(problem, SignInStep.code);
    final verifying = state.busy == SignInBusy.verifying;
    final sending = state.busy == SignInBusy.sending;
    final address = state.email.trim().toLowerCase();
    final until = state.resendAvailableAt;
    // "A new code is on its way" belongs to the wait that follows it; once Resend is live
    // again the note is gone, so the two never contradict each other.
    final showResentNotice =
        state.codeResentNotice && until != null && until.isAfter(now());

    return AuthPage(
      step: SignInStep.code,
      onBack: _back,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(AuthCopy.codeTitle, style: type.headline),
          ),
          const SizedBox(height: MmSpace.s8),
          Text.rich(
            TextSpan(
              style: type.lead.copyWith(color: colors.ink2),
              children: [
                const TextSpan(text: AuthCopy.codeLeadPrefix),
                TextSpan(
                  text: address,
                  style: TextStyle(
                    color: colors.ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s24),
          CodeSlots(
            controller: _code,
            focusNode: _focus,
            autofocus: widget.autofocus,
            enabled: !verifying,
            hasError: problem == SignInProblem.invalidCode,
            errorSerial: state.problemSerial,
            onChanged: (_) {
              if (state.problemStep == SignInStep.code) notifier.clearProblem();
              setState(() {});
            },
            onCompleted: _verify,
          ),
          const SizedBox(height: MmSpace.s12),
          if (problemText != null)
            ProblemLine(message: problemText)
          else if (showResentNotice)
            const _Notice(message: AuthCopy.codeResent)
          else
            // While the code is being checked the hint goes quiet but keeps its line, so
            // nothing below it moves.
            Visibility(
              visible: !verifying,
              maintainSize: true,
              maintainAnimation: true,
              maintainState: true,
              maintainSemantics: false,
              child: Text(
                AuthCopy.codeSpamHint,
                style: type.small.copyWith(color: colors.ink3),
              ),
            ),
          const SizedBox(height: MmSpace.s20),
          KeyButton(
            label: verifying ? AuthCopy.verifying : AuthCopy.verify,
            loading: verifying,
            // Checking keeps the volt key with its spinner (a loading key ignores taps) rather
            // than going flat grey, so the screen reads as working.
            onPressed: verifying
                ? () {}
                : (_code.text.length == kCodeLength && !state.isBusy
                      ? _verify
                      : null),
          ),
          const SizedBox(height: MmSpace.s8),
          ResendRow(
            availableAt: state.resendAvailableAt,
            now: now,
            sending: sending,
            onResend: _resend,
            onElapsed: () {
              if (mounted) setState(() {});
            },
          ),
          QuietAction(
            label: AuthCopy.differentEmail,
            icon: LucideIcons.arrowLeft,
            onPressed: _back,
          ),
        ],
      ),
    );
  }
}

/// A calm confirmation: a check glyph and the words. Read out when it appears.
class _Notice extends StatelessWidget {
  const _Notice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        children: [
          ExcludeSemantics(
            child: Icon(LucideIcons.check, size: 16, color: colors.ink2),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(
            child: Text(
              message,
              style: context.mmType.small.copyWith(color: colors.ink),
            ),
          ),
        ],
      ),
    );
  }
}
