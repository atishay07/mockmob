import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/domain/next_move.dart' show isLateNight;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/data/rhythm_prefs.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../state/answers_store.dart';
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
import '../widgets/choice_tile.dart';
import '../widgets/guide_bar.dart';
import '../widgets/plan_seal_moment.dart';
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

  /// The plan's seal moment: the plan step drives it, the room behind the deck draws it.
  final PlanSealMoment _sealMoment = PlanSealMoment();

  /// The direction of the last move, for the slide.
  bool _forward = true;

  /// The save step was opened from "Start now", so it says why the account is needed.
  bool _startAsked = false;

  /// The start key was tapped before the stored sheet was read: the deck opens when it is.
  bool _startWhenLoaded = false;

  /// The guide Mobi in the top bar.
  final MobiController _mobi = MobiController();
  Timer? _hush;
  Timer? _lookBack;

  /// Mobi's celebration waits for the seal's stamp to land (MOTION.md 1.3: he acts after the
  /// state lands, never before it).
  Timer? _cheer;

  /// The first step shows the whole sheet for its cold reveal (1.2 s), then the one-line strip
  /// every other step uses, so the choices sit above the fold (SPACING-AUDIT O2).
  bool _sheetRevealed = false;
  Timer? _reveal;
  static const Duration revealFor = Duration(milliseconds: 1200);

  /// Writes still out are finished when the app goes to the background.
  late final AppLifecycleListener _life = AppLifecycleListener(
    onHide: () => unawaited(_c.flushed()),
    onPause: () => unawaited(_c.flushed()),
  );

  @override
  void initState() {
    super.initState();
    _life;
  }

  AnswersController get _c => ref.read(onboardingAnswersProvider.notifier);

  /// Mobi glances at what the student just touched, then looks back ahead.
  void _glance(Offset at) {
    _mobi.lookAt(at);
    _lookBack?.cancel();
    _lookBack = Timer(const Duration(milliseconds: 1400), () => _mobi.lookAt(null));
  }

  @override
  void dispose() {
    _hush?.cancel();
    _lookBack?.cancel();
    _cheer?.cancel();
    _reveal?.cancel();
    _life.dispose();
    _mobi.dispose();
    _sealMoment.dispose();
    super.dispose();
  }

  /// Plays [cue] on the guide: the act, then the line (Mobi talks over the act); the line lets
  /// go after a beat. The seal's celebration follows the Celebrations setting (MOTION.md 1.2):
  /// Full, he celebrates once the stamp has landed; Quiet and Off, the words only.
  void _perform(MobiCue cue) {
    if (!_inDeck) return;
    final act = cue.act;
    if (cue.celebrates) {
      final full = ref.read(celebrationModeProvider) == CelebrationMode.full;
      _cheer?.cancel();
      if (full && act != null) {
        _cheer = Timer(Motion.reduced(context) ? Duration.zero : sealLands, () {
          if (mounted) _mobi.play(act);
        });
      }
    } else if (act != null) {
      _mobi.play(act);
    }
    final line = cue.line;
    if (line != null) {
      _mobi.say(line);
      _hush?.cancel();
      final ms = (MobiTyping.duration(line) * 1000).round() + 2600;
      _hush = Timer(Duration(milliseconds: ms), _mobi.hush);
    }
  }

  /// How long the seal's stamp takes to land (the plan step's stamp).
  static const Duration sealLands = Duration(milliseconds: 420);

  /// Starts the first step's cold reveal once; under reduced motion the strip shows at once.
  void _armReveal(DeckStep step) {
    if (_sheetRevealed || _reveal != null) return;
    if (step.id != Steps.stage || Motion.reduced(context)) {
      _sheetRevealed = true;
      return;
    }
    _reveal = Timer(revealFor, () {
      if (mounted) setState(() => _sheetRevealed = true);
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
      _startWhenLoaded = false;
    });
    if (a.step == null || kOnboardingDeck.byId(a.step) == null) _c.goTo(_steps(a).first.id);
  }

  /// The Welcome key. Before the stored sheet is read the tap is kept, not dropped: the deck
  /// opens the moment the read lands. A sheet that could not be read is read again; one this
  /// build cannot read, already kept aside in the backup, is replaced by a new sheet.
  void _onStart(AsyncValue<OnboardingAnswers> sheet) {
    final loaded = sheet.value;
    if (loaded != null && !sheet.isLoading) {
      _start(loaded);
      return;
    }
    final error = _c.readError;
    if (error != null && error.backedUp) {
      if (_c.startFresh()) _start(OnboardingAnswers.empty);
      return;
    }
    setState(() => _startWhenLoaded = true);
    if (error != null) {
      _c.retry().then<void>((_) {}, onError: (Object _) {
        if (mounted) setState(() => _startWhenLoaded = false);
      });
    }
  }

  /// The next step, once every answer so far is written to the phone (a seal or an age the
  /// student saw is a seal or an age a relaunch finds). A failed write still moves on: the
  /// notice says it, with Try again, so storage trouble never traps the student.
  Future<void> _next(OnboardingAnswers a) async {
    await _c.flushed();
    if (!mounted) return;
    final steps = _steps(ref.read(onboardingAnswersProvider).value ?? a);
    final here = steps.indexWhere((s) => s.id == _current(a).id);
    if (here < 0 || here + 1 >= steps.length) return;
    setState(() => _forward = true);
    _c.goTo(steps[here + 1].id);
  }

  /// The confirmed way out of a saved sheet that can be neither read nor kept aside.
  Future<void> _startOver() async {
    final go = await showMmSheet<bool>(
      context: context,
      title: OnboardingCopy.startOverTitle,
      builder: (context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(OnboardingCopy.startOverBody, style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
          const SizedBox(height: MmSpace.s24),
          KeyButton(label: OnboardingCopy.startOverConfirm, onPressed: () => Navigator.of(context).pop(true)),
          const SizedBox(height: MmSpace.s4),
          Center(child: KeyButton.quiet(label: OnboardingCopy.startOverKeep, onPressed: () => Navigator.of(context).pop(false))),
        ],
      ),
    );
    if (go != true || !mounted) return;
    await _c.discardUnreadable();
    if (!mounted) return;
    final now = ref.read(onboardingAnswersProvider).value;
    if (now != null && _c.readError == null) _start(now);
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
    unawaited(_next(a));
  }

  @override
  Widget build(BuildContext context) {
    // The Celebrations setting reaches every Mobi on these screens (the welcome Mobi, the guide,
    // the first move's), so Quiet calms his big acts and Off keeps him still, as it does the seal.
    final level = switch (ref.watch(celebrationModeProvider)) {
      CelebrationMode.full => MobiCelebrationLevel.full,
      CelebrationMode.quiet => MobiCelebrationLevel.quiet,
      CelebrationMode.off => MobiCelebrationLevel.off,
    };
    return MobiCelebrations(level: level, child: _screen(context));
  }

  Widget _screen(BuildContext context) {
    final colors = context.mmColors;
    final cold = ref.watch(shouldPlayColdOpenProvider).value ?? false;
    final sheet = ref.watch(onboardingAnswersProvider);
    // Welcome paints at once; the stored sheet (a few bytes on the phone) fills in when read.
    // A sheet that could not be read is never shown as empty progress or written over.
    final loaded = sheet.hasError ? null : sheet.value;
    final answers = loaded ?? OnboardingAnswers.empty;
    ref.listen(onboardingAnswersProvider, (previous, next) {
      // The read the kept tap was waiting for failed: the tap is spent. Welcome shows the
      // notice and Try again, never a key that stays loading.
      if (next.hasError && !next.isLoading && _startWhenLoaded) {
        scheduleMicrotask(() {
          if (mounted) setState(() => _startWhenLoaded = false);
        });
        return;
      }
      final after = next.value;
      if (after == null || next.isLoading) return;
      if (_startWhenLoaded && !_inDeck) {
        // Outside the notification, so starting may write the first step.
        scheduleMicrotask(() {
          if (mounted && _startWhenLoaded && !_inDeck) _start(after);
        });
        return;
      }
      final before = previous?.value;
      // A bubble inking on the sheet lands with a selection tick (MOTION.md 1.6: a light impact
      // on every answer is a buzz on a budget motor). The seal has its own, firmer one.
      if (_inDeck && before != null && !(after.sealed && !before.sealed)) {
        final inked = kOnboardingDeck.sheetSteps.any((s) => after.isDone(s.id) && !before.isDone(s.id));
        if (inked) ref.read(hapticsProvider).selection();
      }
      final cue = mobiCueFor(before, after);
      if (cue != null) _perform(cue);
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
      // The phone's own clock: before sign-in, the student's local time is the phone's.
      final now = ref.watch(nowProvider)();
      final error = sheet.hasError ? _c.readError : null;
      return Scaffold(
        backgroundColor: colors.ground,
        body: WelcomeView(
          returning: loaded != null && answers.started && answers.step != null,
          filled: filled,
          lateNight: isLateNight(now),
          entrance: MobiMoments.entranceAt(now),
          // Loading only while a read is in flight: a failed read leaves the key tappable.
          pending: _startWhenLoaded && sheet.isLoading,
          notice: switch (error?.failure) {
            null => null,
            SheetReadFailure.unreadable => OnboardingCopy.sheetUnreadable,
            SheetReadFailure.newer => error!.backedUp ? OnboardingCopy.sheetFromNewer : OnboardingCopy.sheetUnreadable,
            SheetReadFailure.broken => error!.backedUp ? OnboardingCopy.sheetBroken : OnboardingCopy.sheetUnreadable,
          },
          retry: error != null && !error.backedUp,
          // Read again, or (confirmed) start a new sheet: never a screen with no way forward.
          onStartOver: error != null && !error.backedUp ? _startOver : null,
          onStart: () => _onStart(sheet),
          onHaveAccount: () => context.push(AppRoutes.signIn),
        ),
      );
    }

    final step = _current(answers);
    _armReveal(step);
    final saveFailed = ref.watch(onboardingSaveFailedProvider);
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
            // The seal moment's room, full bleed behind the deck: dark until the hold starts, and
            // fading out with the plan step when the deck moves on.
            Positioned.fill(
              child: AnimatedSwitcher(
                duration: Motion.of(context, Motion.card),
                child: step.kind == StepKind.reveal
                    ? PlanSealBackdrop(key: const ValueKey('seal-room'), moment: _sealMoment)
                    : const SizedBox.shrink(key: ValueKey('no-seal-room')),
              ),
            ),
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
                            // The sheet stays put from step to step (only its bubbles and lines
                            // change); it folds away, rather than vanishing, where a step shows
                            // its own copy or none.
                            _SheetSlot(
                              child: _showsSheet(step)
                                  ? AnswerSheetCard(
                                      key: const ValueKey('sheet'),
                                      answers: answers,
                                      now: ref.watch(nowProvider)(),
                                      current: step.id,
                                      // Compact on every step: the weeks to the window are read under the road on the first
                                      // step itself, so the reveal card does not say them twice.
                                      compact: true,
                                      // A one-line strip on every step; the whole card only for
                                      // the first step's cold reveal.
                                      slim: step.id != Steps.stage || _sheetRevealed,
                                    )
                                  : const SizedBox(key: ValueKey('none'), width: double.infinity),
                            ),
                            // An answer the phone could not keep is said, with a way to retry.
                            if (saveFailed)
                              Padding(
                                padding: const EdgeInsets.only(top: MmSpace.s12),
                                child: InlineBanner(
                                  message: OnboardingCopy.saveFailed,
                                  tone: BannerTone.warning,
                                  actionLabel: OnboardingCopy.tryAgain,
                                  onAction: () => unawaited(_c.retrySave()),
                                ),
                              ),
                            Expanded(
                              child: GuideGlance(
                                onGlance: _glance,
                                child: _StepSwitcher(
                                  forward: _forward,
                                  child: KeyedSubtree(key: ValueKey(step.id), child: _body(step, answers)),
                                ),
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
  bool _showsSheet(DeckStep step) => switch (step.kind) {
        StepKind.reveal || StepKind.firstMove || StepKind.check || StepKind.account => false,
        _ => true,
      };

  Widget _body(DeckStep step, OnboardingAnswers a) {
    void next() => unawaited(_next(a));
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
          moment: _sealMoment,
          onChange: (id) {
            setState(() => _forward = false);
            _c.edit((x) => x.copyWith(sealedAt: null, step: id, done: {...x.done}..remove(Steps.plan)));
          },
        ),
      StepKind.account => SaveStep(
          answers: a,
          note: _startAsked ? FirstMove.of(a).needsAccount : null,
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

/// The step change (MOTION.md 4.2). The last step leaves quickly, 12 dp up and faded over 200 ms
/// (down when going back), as if the page were turned; the next one fades in and builds itself
/// (its headline lifts, its answers follow; see StepEntrance), so nothing slides twice.
class _StepSwitcher extends StatelessWidget {
  const _StepSwitcher({required this.forward, required this.child});

  final bool forward;
  final Widget child;

  /// How long the old step takes to leave.
  static const Duration leave = Duration(milliseconds: 200);

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Motion.reducedFade : const Duration(milliseconds: 220),
      reverseDuration: reduced ? Motion.reducedFade : leave,
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        fit: StackFit.expand,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) {
        final faded = FadeTransition(opacity: animation, child: child);
        if (reduced || child.key == this.child.key) return faded;
        final dy = forward ? -MmSpace.s12 : MmSpace.s12;
        return AnimatedBuilder(
          animation: animation,
          child: IgnorePointer(child: faded),
          builder: (context, child) => Transform.translate(offset: Offset(0, dy * (1 - animation.value)), child: child),
        );
      },
      child: child,
    );
  }
}

/// Where the answer sheet sits above a step. When a step has no sheet above it (the question,
/// the plan, which flips its own copy, the account and the first move) the sheet folds up into
/// the top bar over 420 ms and folds back down after; under reduced motion it just appears.
class _SheetSlot extends StatelessWidget {
  const _SheetSlot({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Duration.zero : Motion.emphasizedDuration,
      reverseDuration: reduced ? Duration.zero : Motion.exitDuration,
      switchInCurve: Motion.emphasized,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SizeTransition(sizeFactor: animation, alignment: Alignment.topCenter, child: child),
      ),
      child: child,
    );
  }
}
