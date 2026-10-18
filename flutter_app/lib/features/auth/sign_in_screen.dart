import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api.dart' show nowProvider;
import '../../core/motion/motion.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../account_access/widgets/problem_slot.dart';
import '../account_access/widgets/sign_in_methods.dart';
import '../account_access/widgets/volt_key.dart';
import 'auth_page.dart';
import 'copy.dart';
import 'email_field.dart';
import 'quiet_action.dart';
import 'resend_row.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// Sign-in (spec 5.2): every way in on one screen. Google when the build has it, then the email
/// code (the email and one key to send a code) or a password, and the phone when that is on. The
/// methods come from [SignInMethods]; this screen owns the email-code block and its code screen.
///
/// The email block has three honest states. Nothing sent yet: the volt key sends a code. A code
/// is already out and the 60 second wait is running (the server refuses another until it ends):
/// the volt key is "Enter the code we sent" and the wait is a quiet countdown under it. The wait
/// is over: the volt key sends a new code and the way back to the old one is a quiet key.
///
/// Opened from the onboarding save step ([toSave]), the student has already chosen email: the
/// screen is "Save your plan", the email form alone (no Google, divider or tabs), the field
/// focused and the key "Email me the code".
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key, this.autofocus = true, this.toSave = false});

  final bool autofocus;

  /// From the save step's "Use an email code".
  final bool toSave;

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  late final TextEditingController _email = TextEditingController(
    text: ref.read(signInControllerProvider).email,
  );

  /// Google or the password form is working, so the email key waits.
  bool _otherBusy = false;

  /// On the volt key, so it stays in view above the keyboard.
  final GlobalKey _sendKey = GlobalKey();

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

  /// The wait is over: the "wait a minute" message and the key that waited both retire.
  void _waitElapsed() {
    if (!mounted) return;
    final notifier = ref.read(signInControllerProvider.notifier);
    if (ref.read(signInControllerProvider).problem ==
        SignInProblem.rateLimited) {
      notifier.clearProblem();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = ref.watch(signInControllerProvider);
    final notifier = ref.read(signInControllerProvider.notifier);
    final now = ref.watch(nowProvider);

    final problem = state.problemFor(SignInStep.email);
    final problemText = problem == null
        ? null
        : AuthCopy.problem(problem, SignInStep.email);
    final sending = state.busy == SignInBusy.sending;
    final typed = _email.text.trim().toLowerCase();
    final held = state.isBusy || _otherBusy;
    final until = state.resendAvailableAt;
    final haveCode = state.hasCodeFor(typed);
    // A code is out for this address and the server will not send another yet.
    final waiting = haveCode && until != null && until.isAfter(now());

    final toSave = widget.toSave;
    final emailCode = Column(
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
        const SizedBox(height: MmSpace.s8),
        // One reserved place under the field. At rest it carries the help for a new
        // student; a problem or a long wait takes it over and hands it back, so the
        // field above and the key below never move. Saving the plan, the lead already
        // says a new student gets an account, so the rest state says nothing.
        StillWorking(
          active: sending,
          builder: (context, longWait) {
            if (problemText != null) {
              return ProblemSlot(
                messageKey: problem,
                child: ProblemLine(message: problemText),
              );
            }
            if (longWait) {
              return ProblemSlot(
                messageKey: 'still',
                child: Text(
                  AuthCopy.stillSending,
                  style: type.small.copyWith(color: colors.ink2),
                ),
              );
            }
            return ProblemSlot(
              messageKey: 'rest',
              child: toSave
                  ? const SizedBox(width: double.infinity)
                  : Text(
                      AuthCopy.newHere,
                      style: type.small.copyWith(color: colors.ink3),
                    ),
            );
          },
        ),
        const SizedBox(height: MmSpace.s16),
        KeyedSubtree(
          key: _sendKey,
          child: waiting && !sending
              // The wait is the server's: asking again would only be refused, so the way
              // to the code that is already out is the one live key.
              ? VoltKey(
                  label: AuthCopy.enterSentCode,
                  onPressed: held ? null : _haveCode,
                )
              : VoltKey(
                  label: sending
                      ? AuthCopy.sendingCode
                      : (toSave ? AuthCopy.emailMeCode : AuthCopy.sendCode),
                  loading: sending,
                  onPressed: held ? null : _send,
                ),
        ),
        // Under the key: the countdown or the way back to a code that is already out.
        // Its height is kept, so the key does not climb when it appears.
        ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: roomyScreen(context) ? MmSpace.s4 + MmTarget.min : 0,
          ),
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s4),
            child: waiting && !sending
                ? ResendRow(
                    availableAt: until,
                    now: now,
                    sending: false,
                    onResend: _send,
                    waitLabel: AuthCopy.sendNewIn,
                    spokenWait: AuthCopy.sendNewInSpoken,
                    readyLabel: AuthCopy.sendNewCode,
                    onElapsed: _waitElapsed,
                  )
                : (haveCode && !held && !sending
                      ? QuietAction(
                          label: AuthCopy.enterSentCode,
                          onPressed: _haveCode,
                        )
                      : null),
          ),
        ),
      ],
    );

    return AuthPage(
      step: SignInStep.email,
      onBack: Navigator.of(context).canPop() ? () => context.pop() : null,
      keyboardAnchor: _sendKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmStaggerItem(
            index: 0,
            rise: MmSpace.s12,
            child: Semantics(
              header: true,
              child: Text(
                toSave ? AuthCopy.saveTitle : AuthCopy.signInTitle,
                textAlign: TextAlign.center,
                style: type.display,
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          MmStaggerItem(
            index: 1,
            rise: MmSpace.s12,
            child: Text(
              toSave ? AuthCopy.saveLead : AuthCopy.signInLead,
              textAlign: TextAlign.center,
              style: type.lead.copyWith(color: colors.ink2),
            ),
          ),
          const SizedBox(height: MmSpace.s24),
          MmStaggerItem(
            index: 2,
            rise: MmSpace.s12,
            child: toSave
                ? emailCode
                : SignInMethods(
                    initialEmail: state.email,
                    busy: state.isBusy,
                    onBusyChanged: (busy) {
                      // Google or the password form is starting: read the remembered route
                      // before the router takes it, so the after-sign-in sheet never covers a
                      // deep link.
                      if (busy) notifier.signInStarting();
                      setState(() => _otherBusy = busy);
                    },
                    onSignedIn: notifier.googleSignedIn,
                    emailCode: emailCode,
                  ),
          ),
        ],
      ),
    );
  }
}
