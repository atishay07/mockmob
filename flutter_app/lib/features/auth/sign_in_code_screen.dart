import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api.dart' show nowProvider;
import '../../core/motion/motion.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart' show MobiAct;
import '../account_access/widgets/volt_key.dart';
import 'auth_page.dart';
import 'code_slots.dart';
import 'copy.dart';
import 'resend_row.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// The code screen (spec 5.2): "Enter the 8-digit code we emailed to <address>". Eight digits
/// sign in on their own; the key is there for anyone who prefers it. Nothing typed is lost to
/// an error, and the back arrow returns to the email field with the address kept (it is the one
/// way back, so it is named for what it does).
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
      backLabel: AuthCopy.differentEmail,
      entrance: MobiAct.appear,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              AuthCopy.codeTitle,
              textAlign: TextAlign.center,
              style: type.display,
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Text.rich(
            textAlign: TextAlign.center,
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
          const SizedBox(height: MmSpace.s8),
          if (problemText != null)
            ProblemLine(message: problemText, centered: true)
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
                textAlign: TextAlign.center,
                style: type.small.copyWith(color: colors.ink3),
              ),
            ),
          const SizedBox(height: MmSpace.s20),
          VoltKey(
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
        ],
      ),
    );
  }
}

/// A calm confirmation: a volt tick that pulses once as it lands, and the words in full ink.
/// Read out when it appears. Under reduced motion the tick is simply there.
class _Notice extends StatelessWidget {
  const _Notice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final reduced = Motion.reduced(context);
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ExcludeSemantics(
            child: SizedBox.square(
              dimension: 24,
              child: TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1),
                duration: reduced ? Duration.zero : Motion.emphasizedDuration,
                curve: Curves.linear,
                builder: (context, raw, _) {
                  final t = reduced ? 1.0 : raw;
                  // The tick settles from 0.6 with a small overshoot; a ring of volt widens from
                  // it and fades, once.
                  final settle = Motion.emphasized.transform(t);
                  final scale = 0.6 + 0.4 * settle + 0.12 * (1 - (2 * t - 1).abs());
                  return Stack(
                    alignment: Alignment.center,
                    clipBehavior: Clip.none,
                    children: [
                      if (t < 1)
                        Container(
                          width: 18 + 14 * t,
                          height: 18 + 14 * t,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: colors.volt.withValues(alpha: 0.7 * (1 - t)),
                              width: 2,
                            ),
                          ),
                        ),
                      Transform.scale(
                        scale: scale,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: colors.volt,
                            shape: BoxShape.circle,
                          ),
                          child: SizedBox.square(
                            dimension: 20,
                            child: Icon(
                              LucideIcons.check,
                              size: 14,
                              color: colors.voltInk,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Flexible(
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: context.mmType.small.copyWith(
                color: colors.ink,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
