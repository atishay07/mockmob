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
import '../state/bank_size.dart';
import '../widgets/answer_sheet_card.dart';
import '../widgets/choice_tile.dart';
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
    // The live bank's size for the quiet line under the sheet; the line is worded without it
    // until (or unless) the public count is read.
    final bank = ref.watch(questionBankSizeProvider).value;
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
      bankLine: OnboardingCopy.bankLine(bank),
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
///
/// The age question is the first thing in the action stack, directly above the sign-in keys
/// (design critic 7): three 48 dp pills, then the keys. Until it is answered the keys wait under
/// it, and a tap on a waiting key shakes the question once, so they never read as broken; one
/// answer brings them to full strength. The sealed sheet keeps its place above.
class SaveView extends StatefulWidget {
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
    this.bankLine,
    this.sealedLine,
    this.sheet,
  });

  /// The sealed sheet, shown with its foil seal.
  final Widget? sheet;

  final AgeAnswer? age;
  final String? note;

  /// One quiet line under the sheet about where papers come from (the live question bank).
  final String? bankLine;

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

  /// Where the content sits in the room above the pinned keys: two parts of the free height
  /// above it, three below, the optical centre of a moment (SPACING.md 7).
  static const Alignment weight = Alignment(0, -0.2);

  /// On the age question, for tests that measure it.
  static const Key ageKey = ValueKey('save-age');

  @override
  State<SaveView> createState() => _SaveViewState();
}

class _SaveViewState extends State<SaveView> {
  /// Each bump shakes the age question once (a key tapped before it was answered).
  final ValueNotifier<int> _askAge = ValueNotifier<int>(0);

  @override
  void dispose() {
    _askAge.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = widget;
    final age = w.age;
    final answered = age != null;
    final problem = w.problem;
    final note = w.note;
    final sheet = w.sheet;
    final sealedLine = w.sealedLine;
    final bankLine = w.bankLine;

    final ageBlock = MmShake(
      pulse: _askAge,
      child: Column(
        key: SaveView.ageKey,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(header: true, child: Text(OnboardingCopy.ageQuestion, style: type.cardTitle)),
          const SizedBox(height: MmSpace.s12),
          ChoicePills<AgeAnswer>(
            options: [for (final a in AgeAnswer.values) (a, a.label)],
            selected: age,
            onSelected: w.onAge,
          ),
          const SizedBox(height: MmSpace.s8),
          Text(OnboardingCopy.ageNote, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ),
    );

    // Until the age is answered the keys wait (their own disabled look), and a tap on one asks
    // the question above again instead of doing nothing.
    Widget waiting(Widget key) => answered || w.offline || w.busy
        ? key
        : GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _askAge.value++,
            child: Semantics(hint: OnboardingCopy.ageFirst, child: key),
          );

    // The keys are always laid out, so answering the age moves nothing.
    final keys = Column(
      key: const ValueKey('buttons'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (w.offline) ...[InlineBanner(message: OnboardingCopy.offline, tone: BannerTone.offline), const SizedBox(height: MmSpace.s12)],
        if (problem != null) ...[ProblemLine(message: problem), const SizedBox(height: MmSpace.s12)],
        ageBlock,
        const SizedBox(height: MmSpace.s20),
        if (w.googleEnabled) ...[
          waiting(KeyButton(
            label: w.googleBusy ? OnboardingCopy.googleBusy : OnboardingCopy.continueWithGoogle,
            loading: w.googleBusy,
            onPressed: !answered || w.offline || w.busy || w.googleInBrowser ? null : w.onGoogle,
          )),
          if (w.googleInBrowser) ...[
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
                KeyButton.quiet(label: OnboardingCopy.cancelBrowser, onPressed: w.onCancelBrowser),
              ],
            ),
          ],
          const SizedBox(height: MmSpace.s12),
        ],
        waiting(w.googleEnabled
            ? KeyButton.secondary(label: OnboardingCopy.useEmailCode, onPressed: !answered || w.offline || w.busy ? null : w.onEmail)
            : KeyButton(label: OnboardingCopy.useEmailCode, onPressed: !answered || w.offline || w.busy ? null : w.onEmail)),
        const SizedBox(height: MmSpace.s4),
        Center(child: KeyButton.quiet(label: OnboardingCopy.notNow, onPressed: w.busy ? null : w.onNotNow)),
      ],
    );

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (note != null) ...[InlineBanner(message: note), const SizedBox(height: MmSpace.s16)],
        if (sheet != null) EntranceItem.answer(0, child: sheet),
        if (sheet == null && sealedLine != null) Text(sealedLine, style: type.small.copyWith(color: colors.ink2)),
        if (bankLine != null) ...[
          const SizedBox(height: MmSpace.s12),
          EntranceItem.answer(1, child: Text(bankLine, style: type.small.copyWith(color: colors.ink2))),
        ],
      ],
    );

    // A moment, not a top-stacked form (SPACING-AUDIT O4): the sealed sheet sits at the optical
    // centre of the room; the age question and the keys are pinned at the thumb, "Not now" under
    // them. When the room is too short, the sheet scrolls and the keys stay put.
    return StepLayout(
      title: OnboardingCopy.saveTitle,
      support: OnboardingCopy.saveSupport,
      scroll: false,
      // The sheet, the quiet bank line, the age question and two keys all want the room.
      tight: true,
      body: LayoutBuilder(
        builder: (context, box) => SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: StepLayout.fade + MmSpace.s4),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: (box.maxHeight - StepLayout.fade - MmSpace.s4).clamp(0, double.infinity)),
            child: Align(alignment: SaveView.weight, child: content),
          ),
        ),
      ),
      bottom: keys,
    );
  }
}
