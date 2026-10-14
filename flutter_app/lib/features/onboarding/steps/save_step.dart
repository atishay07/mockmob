import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/config/app_config.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/copy/formatters.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/auth_page.dart' show ProblemLine;
import '../../auth/copy.dart';
import '../../auth/sign_in_controller.dart';
import '../../auth/sign_in_state.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/answer_sheet_card.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';

/// Step 10: keep the sheet. Age first (held on the phone until sign-in), then Google when it is
/// configured, an email code, or "Not now". Signing in hands over to the router; "Saved" is only
/// ever said after the server acknowledges, on the sheet that follows sign-in.
class SaveStep extends ConsumerStatefulWidget {
  const SaveStep({super.key, required this.answers, required this.onNotNow, this.note});

  final OnboardingAnswers answers;

  /// Why the account is asked for now ("Start now" on the first move).
  final String? note;
  final VoidCallback onNotNow;

  @override
  ConsumerState<SaveStep> createState() => _SaveStepState();
}

class _SaveStepState extends ConsumerState<SaveStep> {
  @override
  void initState() {
    super.initState();
    // A message left from an earlier try on the sign-in screen is not news here.
    Future.microtask(() {
      if (mounted) ref.read(signInControllerProvider.notifier).clearProblem();
    });
  }

  @override
  Widget build(BuildContext context) {
    final age = widget.answers.age;
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    final sign = ref.watch(signInControllerProvider);
    final google = ref.watch(appConfigProvider.select((c) => c.googleSignInEnabled));
    final problem = sign.problemFor(SignInStep.email);
    final problemText = problem == null ? null : AuthCopy.problem(problem, SignInStep.email);
    return SaveView(
      age: age,
      offline: offline,
      googleEnabled: google,
      googleBusy: sign.busy == SignInBusy.google,
      googleInBrowser: sign.googleInBrowser,
      onCancelBrowser: () => ref.read(signInControllerProvider.notifier).cancelGoogleBrowser(),
      busy: sign.isBusy,
      problem: problemText,
      onAge: ref.read(onboardingAnswersProvider.notifier).setAge,
      onGoogle: () => ref.read(signInControllerProvider.notifier).signInWithGoogle(),
      onEmail: () => context.push(AppRoutes.signIn),
      onNotNow: widget.onNotNow,
      note: widget.note,
      // The whole sealed sheet where the phone has the height for it (and no note above it);
      // the newest line otherwise. The seal and the sealed line sit inside it.
      sheet: AnswerSheetCard(
        answers: widget.answers,
        now: ref.watch(nowProvider)(),
        compact: true,
        full: widget.note == null && MediaQuery.sizeOf(context).height >= 900,
        sealedLine: _sealedLine(widget.answers),
        animate: false,
      ),
    );
  }

  String? _sealedLine(OnboardingAnswers a) {
    final at = a.sealedAt;
    if (at == null) return null;
    return OnboardingCopy.sealedAt(formatTime12(at), FirstMove.of(a).chapter);
  }
}

/// The pure layout of the save step, rendered by the goldens.
class SaveView extends StatelessWidget {
  const SaveView({
    super.key,
    required this.age,
    required this.onAge,
    required this.onGoogle,
    required this.onEmail,
    required this.onNotNow,
    this.offline = false,
    this.googleEnabled = true,
    this.googleBusy = false,
    this.googleInBrowser = false,
    this.onCancelBrowser,
    this.busy = false,
    this.problem,
    this.note,
    this.sealedLine,
    this.sheet,
  });

  /// The sealed sheet, shown with its foil seal.
  final Widget? sheet;

  final AgeAnswer? age;
  final String? note;

  /// "Sealed tonight at 9:40 PM. Week one starts with Partnership."
  final String? sealedLine;
  final ValueChanged<AgeAnswer> onAge;
  final VoidCallback onGoogle;
  final VoidCallback onEmail;
  final VoidCallback onNotNow;
  final bool offline;
  final bool googleEnabled;
  final bool googleBusy;

  /// Google sign-in handed over to the browser: say what to do there, and let the student stop
  /// waiting ([onCancelBrowser]).
  final bool googleInBrowser;
  final VoidCallback? onCancelBrowser;
  final bool busy;
  final String? problem;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final answered = age != null;
    final buttons = Column(
      key: const ValueKey('buttons'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (offline) ...[InlineBanner(message: OnboardingCopy.offline, tone: BannerTone.offline), const SizedBox(height: MmSpace.s12)],
        if (problem != null) ...[ProblemLine(message: problem!), const SizedBox(height: MmSpace.s12)],
        if (googleEnabled) ...[
          KeyButton(
            label: googleBusy ? OnboardingCopy.googleBusy : OnboardingCopy.continueWithGoogle,
            loading: googleBusy,
            onPressed: offline || busy || googleInBrowser ? null : onGoogle,
          ),
          if (googleInBrowser) ...[
            const SizedBox(height: MmSpace.s8),
            // What to do in the browser, and the way to stop waiting, on one line.
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Semantics(
                    liveRegion: true,
                    child: Text(AuthCopy.googleInBrowser, style: type.small.copyWith(color: colors.ink2)),
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                KeyButton.quiet(label: OnboardingCopy.cancelBrowser, onPressed: onCancelBrowser),
              ],
            ),
          ],
          const SizedBox(height: MmSpace.s12),
        ],
        googleEnabled
            ? KeyButton.secondary(label: OnboardingCopy.useEmailCode, onPressed: offline || busy ? null : onEmail)
            : KeyButton(label: OnboardingCopy.useEmailCode, onPressed: offline || busy ? null : onEmail),
      ],
    );

    return StepLayout(
      title: OnboardingCopy.saveTitle,
      support: OnboardingCopy.saveSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (note != null) ...[InlineBanner(message: note!), const SizedBox(height: MmSpace.s16)],
          if (sheet != null) EntranceItem.answer(0, child: sheet!),
          if (sheet == null && sealedLine != null) ...[
            const SizedBox(height: MmSpace.s12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
              child: Text(sealedLine!, style: type.small.copyWith(color: colors.ink2)),
            ),
          ],
          // The age question and the keys follow the sheet directly, so the step reads as one
          // group at every height (DEVICE-FINDINGS 2) instead of a sheet up top and keys far below.
          const SizedBox(height: MmSpace.s24),
          EntranceItem.answer(
            2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(OnboardingCopy.ageQuestion, style: type.cardTitle),
                const SizedBox(height: MmSpace.s8),
                Wrap(
                  spacing: MmSpace.s8,
                  children: [for (final a in AgeAnswer.values) MmChip(label: a.label, selected: age == a, onTap: () => onAge(a))],
                ),
                const SizedBox(height: MmSpace.s4),
                Text(OnboardingCopy.ageNote, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          AnimatedSwitcher(
            duration: Motion.of(context, Motion.glideDuration),
            switchInCurve: Motion.glide,
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SizeTransition(sizeFactor: animation, alignment: Alignment.topCenter, child: child),
            ),
            child: answered ? buttons : const SizedBox(key: ValueKey('wait'), width: double.infinity),
          ),
          const SizedBox(height: MmSpace.s4),
          Center(
            child: KeyButton.quiet(label: OnboardingCopy.notNow, onPressed: busy ? null : onNotNow),
          ),
          SizedBox(height: MediaQuery.paddingOf(context).bottom),
        ],
      ),
    );
  }
}
