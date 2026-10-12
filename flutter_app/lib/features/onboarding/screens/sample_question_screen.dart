import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/sample_questions.dart';
import '../state/onboarding_providers.dart';
import '../widgets/answer_options.dart';
import '../widgets/explanation_panel.dart';
import '../widgets/onboarding_page.dart';
import '../widgets/position_pips.dart';

/// One of the five sample questions (spec 5.1.3), reached at `/onboarding/sample/:i`.
class SampleQuestionScreen extends ConsumerWidget {
  const SampleQuestionScreen({super.key, required this.index});

  /// 1-based.
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final set = ref.watch(sampleSetProvider);
    final guest = ref.watch(guestSampleProvider);
    final loaded = set.asData?.value;
    final sample = guest.asData?.value;
    if (loaded == null || sample == null) return const _QuestionLoading();

    final i = index.clamp(1, loaded.total);
    final question = loaded.questions[i - 1];
    // The subject step comes first. A restored process that lost it goes back there.
    if (sample.subject == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go(AppRoutes.onboardingSubject);
      });
    }
    return SampleQuestionBody(
      key: ValueKey(question.id),
      question: question,
      index: i,
      total: loaded.total,
      answered: [for (final q in loaded.questions) sample.answers.containsKey(q.id)],
      initialChosenKey: sample.answerFor(question.id),
      onAnswer: (key) => ref.read(guestSampleProvider.notifier).answer(question.id, key),
      onCorrect: () => ref.read(hapticsProvider).settle(),
      onNext: () => context.push(i == loaded.total ? AppRoutes.onboardingSampleResult : AppRoutes.onboardingSample(i + 1)),
      onBack: () => context.canPop() ? context.pop() : context.go(AppRoutes.onboardingSubject),
    );
  }
}

class _QuestionLoading extends StatelessWidget {
  const _QuestionLoading();

  @override
  Widget build(BuildContext context) => const OnboardingPage(
        body: SkeletonGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: MmSpace.s48),
              Skeleton(height: 24),
              SizedBox(height: MmSpace.s24),
              Skeleton(height: 56),
              SizedBox(height: MmSpace.s12),
              Skeleton(height: 56),
            ],
          ),
        ),
      );
}

/// A sample question with its resolution sequence (spec 5.1.3): the chosen key settles flush at
/// 0 ms, the others recede at 90 ms, the reason panel rises from 180 ms over 220 ms, the next key
/// fades in from 260 ms. With reduced motion everything is in place at once.
class SampleQuestionBody extends ConsumerStatefulWidget {
  const SampleQuestionBody({
    super.key,
    required this.question,
    required this.index,
    required this.total,
    required this.answered,
    required this.onAnswer,
    required this.onNext,
    this.initialChosenKey,
    this.onCorrect,
    this.onBack,
  });

  final SampleQuestion question;
  final int index;
  final int total;
  final List<bool> answered;
  final String? initialChosenKey;
  final void Function(String key) onAnswer;
  final VoidCallback? onCorrect;
  final VoidCallback onNext;
  final VoidCallback? onBack;

  @override
  ConsumerState<SampleQuestionBody> createState() => _SampleQuestionBodyState();
}

class _SampleQuestionBodyState extends ConsumerState<SampleQuestionBody> with SingleTickerProviderStateMixin {
  static const _total = Duration(milliseconds: 480);
  static const _recedeAt = 90 / 480;
  static const _revealAt = 180 / 480;

  late final AnimationController _resolve = AnimationController(vsync: this, duration: _total);
  late final Animation<double> _panel = CurvedAnimation(parent: _resolve, curve: const Interval(_revealAt, 400 / 480, curve: Motion.out));
  late final Animation<double> _next = CurvedAnimation(parent: _resolve, curve: const Interval(260 / 480, 460 / 480, curve: Curves.easeOut));
  final GlobalKey _panelKey = GlobalKey();

  String? _chosen;
  bool _receded = false;
  bool _revealed = false;

  @override
  void initState() {
    super.initState();
    _chosen = widget.initialChosenKey;
    if (_chosen != null) {
      _resolve.value = 1;
      _receded = true;
      _revealed = true;
    }
    _resolve.addListener(_onTick);
  }

  void _onTick() {
    final recede = _resolve.value >= _recedeAt;
    final reveal = _resolve.value >= _revealAt;
    if (recede != _receded || reveal != _revealed) {
      setState(() {
        _receded = recede;
        _revealed = reveal;
      });
    }
  }

  @override
  void dispose() {
    _resolve.dispose();
    super.dispose();
  }

  void _choose(String key) {
    if (_chosen != null) return;
    setState(() => _chosen = key);
    widget.onAnswer(key);
    if (key == widget.question.correctKey) widget.onCorrect?.call();
    if (Motion.reduced(context)) {
      _resolve.value = 1;
    } else {
      _resolve.forward();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final panel = _panelKey.currentContext;
      if (panel == null || !mounted) return;
      Scrollable.ensureVisible(
        panel,
        duration: Motion.of(context, Motion.card),
        curve: Motion.out,
        alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = widget.question;
    final chosen = _chosen;
    final isLast = widget.index == widget.total;
    final position = OnboardingCopy.position(widget.index, widget.total);
    final correct = chosen != null && chosen == q.correctKey;
    final questionStyle = type.subhead.copyWith(fontSize: 20, height: 1.35, letterSpacing: -0.2);

    return OnboardingPage(
      onBack: widget.onBack,
      header: const _OnThisPhone(),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(position, style: type.label.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          PositionPips(current: widget.index, answered: widget.answered),
          const SizedBox(height: MmSpace.s12),
          Text(OnboardingCopy.sampleCaption, style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s20),
          Text(q.prompt, style: questionStyle),
          const SizedBox(height: MmSpace.s20),
          AnswerOptions(
            question: q,
            chosenKey: chosen,
            onChoose: _choose,
            receded: _receded,
            revealCorrect: _revealed,
          ),
          if (chosen != null) ...[
            const SizedBox(height: MmSpace.s4),
            KeyedSubtree(
              key: _panelKey,
              child: FadeTransition(
                opacity: _panel,
                child: AnimatedBuilder(
                  animation: _panel,
                  builder: (context, child) => Transform.translate(offset: Offset(0, 12 * (1 - _panel.value)), child: child),
                  child: ExplanationPanel(
                    correct: correct,
                    why: q.why,
                    answerLine: correct ? null : OnboardingCopy.answerIs(q.correctKey, q.correct.text),
                    animateMobi: widget.initialChosenKey == null,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
      bottom: Stack(
        alignment: Alignment.center,
        children: [
          // The disclaimer holds the slot until the next key fades in over it.
          FadeTransition(
            opacity: ReverseAnimation(_next),
            child: Text(
              OnboardingCopy.sampleDisclaimer,
              style: type.small.copyWith(color: colors.ink3),
              textAlign: TextAlign.center,
            ),
          ),
          IgnorePointer(
            ignoring: chosen == null,
            child: ExcludeSemantics(
              excluding: chosen == null,
              child: FadeTransition(
                opacity: _next,
                child: KeyButton(label: isLast ? OnboardingCopy.seeMyResult : OnboardingCopy.nextQuestion, onPressed: widget.onNext),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "On this phone": the guest answers are kept here until an account exists.
class _OnThisPhone extends StatelessWidget {
  const _OnThisPhone();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(child: Icon(LucideIcons.smartphone, size: 16, color: colors.ink3)),
        const SizedBox(width: MmSpace.s4),
        Text(OnboardingCopy.onThisPhone, style: context.mmType.label.copyWith(color: colors.ink3)),
      ],
    );
  }
}
