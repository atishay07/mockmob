import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/guest_sample.dart';
import '../data/sample_questions.dart';
import '../state/onboarding_providers.dart';
import '../widgets/example_card.dart';
import '../widgets/onboarding_page.dart';
import 'account_step_sheet.dart';

/// The sample result (spec 5.1.4): the true count from the student's own answers, the answer
/// sheet that fills in, what the sample cannot say, and a dashed example of the next move. No
/// celebration, whatever the count.
class SampleResultScreen extends ConsumerWidget {
  const SampleResultScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final set = ref.watch(sampleSetProvider).asData?.value;
    final guest = ref.watch(guestSampleProvider).asData?.value;
    if (set == null || guest == null) {
      return const OnboardingPage(
        body: SkeletonGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [SizedBox(height: MmSpace.s48), Skeleton(height: 56), SizedBox(height: MmSpace.s24), Skeleton(height: 28)],
          ),
        ),
      );
    }
    return SampleResultView(
      set: set,
      guest: guest,
      onSave: () => showAccountStepSheet(context),
      onTryAnother: () => context.go(AppRoutes.onboardingSubject),
      onContinue: () => context.go(sampleContinueLocation(set, guest)),
      onBack: () => context.canPop() ? context.pop() : context.go(AppRoutes.onboardingSubject),
    );
  }
}

/// Where "Continue the sample" goes from an unfinished result: the first unanswered question.
String sampleContinueLocation(SampleSet set, GuestSample guest) {
  final next = guest.firstUnanswered([for (final q in set.questions) q.id]);
  return AppRoutes.onboardingSample(next ?? 1);
}

/// The cells of the answer sheet for the sample: right, wrong, or blank when unanswered.
List<QuestionCell> sampleCells(SampleSet set, GuestSample guest) => [
      for (final q in set.questions)
        switch (guest.answerFor(q.id)) {
          null => QuestionCell.blank,
          final key => key == q.correctKey ? QuestionCell.right : QuestionCell.wrong,
        },
    ];

/// The pure layout of the sample result, rendered by the goldens.
class SampleResultView extends StatefulWidget {
  const SampleResultView({
    super.key,
    required this.set,
    required this.guest,
    required this.onSave,
    required this.onTryAnother,
    required this.onContinue,
    this.onBack,
  });

  final SampleSet set;
  final GuestSample guest;
  final VoidCallback onSave;
  final VoidCallback onTryAnother;
  final VoidCallback onContinue;
  final VoidCallback? onBack;

  @override
  State<SampleResultView> createState() => _SampleResultViewState();
}

class _SampleResultViewState extends State<SampleResultView> with SingleTickerProviderStateMixin {
  late final AnimationController _reveal = AnimationController(vsync: this, duration: Motion.figureRoll);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The sheet fills in once, in question order. Reduced motion shows it complete.
    if (_reveal.status == AnimationStatus.dismissed && !_reveal.isAnimating) {
      if (Motion.reduced(context)) {
        _reveal.value = 1;
      } else {
        _reveal.forward();
      }
    }
  }

  @override
  void dispose() {
    _reveal.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final guest = widget.guest;
    final total = widget.set.total;
    if (!guest.isComplete(total)) return _unfinished(context, total);

    final colors = context.mmColors;
    final type = context.mmType;
    final cells = sampleCells(widget.set, guest);
    final correct = cells.where((c) => c == QuestionCell.right).length;
    final curve = CurvedAnimation(parent: _reveal, curve: Motion.out);

    return OnboardingPage(
      onBack: widget.onBack,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: MmSpace.s16),
          Semantics(
            header: true,
            label: OnboardingCopy.resultFigureSemantics(correct, total),
            excludeSemantics: true,
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: OnboardingCopy.resultFigureNumber(correct), style: type.figure.copyWith(fontSize: 56)),
                  TextSpan(text: ' ${OnboardingCopy.resultFigureRest(total)}', style: type.title),
                ],
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          QuestionStrip(cells: cells, columns: total, cellSize: 32, gap: 6, reveal: curve),
          const SizedBox(height: MmSpace.s12),
          Text(OnboardingCopy.resultSheetNote, style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s24),
          Text(OnboardingCopy.resultLine, style: type.body.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.group),
          const ExampleCard(),
        ],
      ),
      bottom: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          KeyButton(label: OnboardingCopy.saveAndContinue, onPressed: widget.onSave),
          const SizedBox(height: MmSpace.s4),
          Align(child: KeyButton.quiet(label: OnboardingCopy.tryAnotherSubject, onPressed: widget.onTryAnother)),
        ],
      ),
    );
  }

  /// A result opened before all five are answered: say where things stand and offer the way on.
  Widget _unfinished(BuildContext context, int total) {
    return OnboardingPage(
      onBack: widget.onBack,
      scrollBody: false,
      body: StateView(
        kind: StateViewKind.empty,
        title: OnboardingCopy.unfinishedTitle(widget.guest.answeredCount, total),
        message: OnboardingCopy.unfinishedMessage,
        primary: StateAction(OnboardingCopy.continueSample, widget.onContinue),
        pose: MobiPose.attentive,
      ),
    );
  }
}
