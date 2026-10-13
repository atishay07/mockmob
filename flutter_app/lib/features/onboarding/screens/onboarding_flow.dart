import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../state/answers_controller.dart';
import '../state/mobi_cues.dart';
import '../steps/course_step.dart';
import '../steps/first_move_step.dart';
import '../steps/plan_step.dart';
import '../steps/question_step.dart';
import '../steps/rhythm_step.dart';
import '../steps/save_step.dart';
import '../steps/stage_step.dart';
import '../steps/subjects_step.dart';
import '../steps/worry_step.dart';
import '../widgets/answer_sheet_card.dart';
import '../widgets/guide_bar.dart';
import 'welcome_view.dart';

/// The onboarding ("Your sheet"): the cold open on first launch, Welcome, then the step deck
/// with the answer sheet at the top. Every answer is on the phone the moment it is given, and a
/// return picks up at the same step.
class OnboardingFlow extends ConsumerStatefulWidget {
  const OnboardingFlow({super.key, this.skipColdOpen = false, this.startInDeck = false});

  /// Goldens and deep links into the flow start past the cold open.
  final bool skipColdOpen;

  /// Opens straight on the stored step instead of Welcome (goldens, tests).
  final bool startInDeck;

  @override
  ConsumerState<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends ConsumerState<OnboardingFlow> {
  bool _coldDone = false;

  /// Past Welcome in this visit.
  late bool _inDeck = widget.startInDeck;

  /// The direction of the last move, for the slide.
  bool _forward = true;

  /// The save step was opened from "Start now", so it says why the account is needed.
  bool _startAsked = false;

  /// The guide Mobi in the top bar, and the bubble row he points at.
  final MobiController _mobi = MobiController();
  final GlobalKey _track = GlobalKey();
  Timer? _settle;
  Timer? _hush;

  AnswersController get _c => ref.read(onboardingAnswersProvider.notifier);

  @override
  void dispose() {
    _settle?.cancel();
    _hush?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  /// Plays [cue] on the guide: the act, then the line (Mobi talks over the act), then a point
  /// at the sheet once the inked bubble is laid out. A point or a line lets go after a beat.
  void _perform(MobiCue cue, OnboardingAnswers answers) {
    if (!_inDeck) return;
    final act = cue.act;
    if (act != null) _mobi.play(act);
    final line = cue.line;
    if (line != null) {
      _mobi.say(line);
      _hush?.cancel();
      final ms = (MobiTyping.duration(line) * 1000).round() + 2600;
      _hush = Timer(Duration(milliseconds: ms), _mobi.hush);
    }
    final step = cue.pointAt;
    if (step == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final at = AnswerSheetCard.bubbleCenter(_track, answers, step);
      if (at == null) return;
      _mobi.pointAt(at);
      _settle?.cancel();
      _settle = Timer(const Duration(milliseconds: 1500), () => _mobi.play(enterAct(answers.step ?? step)));
    });
  }

  List<DeckStep> _steps(OnboardingAnswers a) => kOnboardingDeck.visible(a);

  DeckStep _current(OnboardingAnswers a) {
    final steps = _steps(a);
    return steps.firstWhere((s) => s.id == a.step, orElse: () => steps.first);
  }

  void _start(OnboardingAnswers a) {
    setState(() {
      _inDeck = true;
      _forward = true;
    });
    if (a.step == null || kOnboardingDeck.byId(a.step) == null) _c.goTo(_steps(a).first.id);
  }

  void _next(OnboardingAnswers a) {
    final steps = _steps(ref.read(onboardingAnswersProvider).value ?? a);
    final here = steps.indexWhere((s) => s.id == _current(a).id);
    if (here < 0 || here + 1 >= steps.length) return;
    setState(() => _forward = true);
    _c.goTo(steps[here + 1].id);
  }

  void _back(OnboardingAnswers a) {
    final steps = _steps(a);
    final here = steps.indexWhere((s) => s.id == _current(a).id);
    setState(() => _forward = false);
    if (here <= 0) {
      setState(() => _inDeck = false);
      return;
    }
    // Back from the first move returns to the save choices.
    if (steps[here].id == Steps.firstMove) _c.edit((x) => x.copyWith(notNow: false));
    _c.goTo(steps[here - 1].id);
  }

  void _skip(OnboardingAnswers a) {
    _c.skip(_current(a).id);
    _next(a);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final cold = ref.watch(shouldPlayColdOpenProvider).value ?? false;
    final loaded = ref.watch(onboardingAnswersProvider).value;
    // Welcome paints at once; the stored sheet (a few bytes on the phone) fills in when read.
    final answers = loaded ?? OnboardingAnswers.empty;
    ref.listen(onboardingAnswersProvider, (previous, next) {
      final after = next.value;
      if (after == null) return;
      final cue = mobiCueFor(previous?.value, after);
      if (cue != null) _perform(cue, after);
    });

    if (!widget.skipColdOpen && cold && !_coldDone) {
      return ColdOpen(
        onDone: () {
          markColdOpenSeen(ref);
          setState(() => _coldDone = true);
        },
      );
    }
    if (!_inDeck) {
      final filled = kOnboardingDeck.sheetSteps.where((s) => answers.isDone(s.id)).length;
      return Scaffold(
        backgroundColor: colors.ground,
        body: WelcomeView(
          returning: answers.started && answers.step != null,
          filled: filled,
          lateNight: _isLate(ref.watch(nowProvider)()),
          // Until the stored sheet is read, starting would race it; the read takes milliseconds.
          onStart: () {
            if (loaded != null) _start(loaded);
          },
          onHaveAccount: () => context.push(AppRoutes.signIn),
        ),
      );
    }

    final step = _current(answers);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back(answers);
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: Stack(
          children: [
            if (step.kind != StepKind.check) Positioned.fill(child: LampScene(strength: 0.85, vignette: false)),
            const Positioned.fill(child: IgnorePointer(child: Grain())),
            SafeArea(
              bottom: false,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                    // The guide bar is laid over the column, so Mobi's bubble can run over the
                    // top of the sheet for a moment without the sheet painting over it.
                    child: Stack(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: GuideBar.height),
                            if (_showsSheet(step))
                              AnswerSheetCard(
                                answers: answers,
                                now: ref.watch(nowProvider)(),
                                current: step.id,
                                compact: _compact(step, answers),
                                trackKey: _track,
                              ),
                            Expanded(
                              child: _StepSwitcher(
                                forward: _forward,
                                child: KeyedSubtree(key: ValueKey(step.id), child: _body(step, answers)),
                              ),
                            ),
                          ],
                        ),
                        Positioned(
                          left: 0,
                          right: 0,
                          top: 0,
                          child: GuideBar(
                            controller: _mobi,
                            onBack: () => _back(answers),
                            onSkip: step.skippable && !answers.isDone(step.id) ? () => _skip(answers) : null,
                            // The first move has its own Mobi, pointing at Start.
                            showMobi: step.kind != StepKind.firstMove,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The question is the calm work layer and the save step shows the sealed sheet itself, so
  /// neither has the sheet above; the plan flips its own copy.
  /// 11 PM to 4 AM.
  static bool _isLate(DateTime now) => now.hour >= 23 || now.hour < 4;

  bool _showsSheet(DeckStep step) => switch (step.kind) {
        StepKind.reveal || StepKind.firstMove || StepKind.check || StepKind.account => false,
        _ => true,
      };

  /// The sheet shows its weeks while there is room for them; long steps keep it compact.
  bool _compact(DeckStep step, OnboardingAnswers a) => switch (step.id) {
        Steps.stage => false,
        Steps.course => a.course != null,
        _ => true,
      };

  Widget _body(DeckStep step, OnboardingAnswers a) {
    void next() => _next(a);
    return switch (step.kind) {
      StepKind.single => StageStep(answers: a, onNext: next),
      StepKind.ladder => CourseStep(answers: a, onNext: next),
      StepKind.confidence => SubjectsStep(answers: a, onNext: next),
      StepKind.choice => WorryStep(answers: a, onNext: next),
      StepKind.check => QuestionStep(answers: a, onNext: next),
      StepKind.rhythm => RhythmStep(answers: a, onNext: next),
      StepKind.reveal => PlanStep(
          answers: a,
          onNext: next,
          onChange: (id) {
            setState(() => _forward = false);
            _c.edit((x) => x.copyWith(sealedAt: null, step: id, done: {...x.done}..remove(Steps.plan)));
          },
        ),
      StepKind.account => SaveStep(
          answers: a,
          note: _startAsked ? OnboardingCopy.checkNeedsAccount : null,
          onNotNow: () {
            setState(() {
              _forward = true;
              _startAsked = false;
            });
            _c.chooseNotNow();
          },
        ),
      StepKind.firstMove => FirstMoveStep(
          answers: a,
          onStart: () {
            setState(() {
              _forward = false;
              _startAsked = true;
            });
            _c.edit((x) => x.copyWith(notNow: false, step: Steps.save));
          },
        ),
    };
  }
}

/// Glides the next step in from the side it comes from (300 ms) while the last one fades out.
class _StepSwitcher extends StatelessWidget {
  const _StepSwitcher({required this.forward, required this.child});

  final bool forward;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Motion.reducedFade : Motion.glideDuration,
      reverseDuration: reduced ? Motion.reducedFade : Motion.exitDuration,
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        fit: StackFit.expand,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) {
        final faded = FadeTransition(opacity: animation, child: child);
        if (reduced) return faded;
        final dx = (forward ? 16.0 : -16.0);
        return AnimatedBuilder(
          animation: animation,
          child: faded,
          builder: (context, child) => Transform.translate(offset: Offset(dx * (1 - animation.value), 0), child: child),
        );
      },
      child: child,
    );
  }
}
