import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/entrance.dart';
import '../widgets/first_move_hero.dart';
import '../widgets/step_frame.dart';
import '../widgets/week_ahead.dart';

/// Step 11 for a student who chose "Not now": the first move, ready. Practice is marked on the
/// server, so the start key asks for the account first; "Tonight" keeps it waiting here. Mobi
/// stands above the card, says his line and points down at the start key once; if no finger
/// lands for 4 s he nudges at it, once (MOTION.md 1.3: sooner reads as nagging).
class FirstMoveStep extends ConsumerStatefulWidget {
  const FirstMoveStep({super.key, required this.answers, required this.onStart, this.mobi});

  final OnboardingAnswers answers;

  /// Goes to the save step, with the reason.
  final VoidCallback onStart;

  /// Drives the step's Mobi; the step makes its own when null (tests pass one to watch it).
  final MobiController? mobi;

  /// How long without a touch before Mobi nudges at the start key (once per visit).
  static const Duration nudgeAfter = Duration(seconds: 4);

  @override
  ConsumerState<FirstMoveStep> createState() => _FirstMoveStepState();
}

class _FirstMoveStepState extends ConsumerState<FirstMoveStep> {
  late final MobiController _mobi = widget.mobi ?? MobiController();
  final GlobalKey _figure = GlobalKey();
  final GlobalKey _start = GlobalKey();

  /// The start key's centre relative to Mobi when he last pointed. Mobi keeps the angle, so
  /// he only points again when the two move apart (a resize, the card changing height).
  Offset? _aimed;
  bool _queued = false;

  /// One nudge per visit: if no finger lands within [FirstMoveStep.nudgeAfter] of the first point, Mobi jabs
  /// at the start key twice and keeps pointing.
  Timer? _nudge;
  bool _nudgeSpent = false;

  @override
  void initState() {
    super.initState();
    // He speaks once per run on this screen (MOTION.md 1.3); a Back and forward again finds him
    // quiet, with the card to read.
    _mobi.sayOnce('onboarding_first_move', OnboardingCopy.mobiFirstMove);
  }

  @override
  void dispose() {
    _nudge?.cancel();
    if (widget.mobi == null) _mobi.dispose();
    super.dispose();
  }

  /// Points at the start key after this frame is laid out, if it moved relative to Mobi.
  void _queuePoint() {
    if (_queued) return;
    _queued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _queued = false;
      if (!mounted) return;
      final figure = _figure.currentContext?.findRenderObject();
      final start = _start.currentContext?.findRenderObject();
      if (figure is! RenderBox || start is! RenderBox || !figure.hasSize || !start.hasSize) return;
      // Both measured in the same frame, so a scroll or a slide moves them together.
      final rel = start.localToGlobal(start.size.center(Offset.zero)) - figure.localToGlobal(Offset.zero);
      if (_aimed != null && (rel - _aimed!).distance < 1) return;
      _aimed = rel;
      _mobi.pointAtWidget(_start);
      _armNudge();
    });
  }

  void _armNudge() {
    if (_nudgeSpent) return;
    _nudgeSpent = true;
    // Once per screen per day, however often the step is opened.
    if (!MobiRation.nudgeToday('onboarding_first_move')) return;
    _nudge = Timer(FirstMoveStep.nudgeAfter, () {
      _nudge = null;
      if (mounted) _mobi.play(MobiAct.nudge);
    });
  }

  /// Any touch means the student is already acting: the nudge is not needed.
  void _touched(PointerDownEvent _) {
    _nudgeSpent = true;
    _nudge?.cancel();
    _nudge = null;
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final move = FirstMove.of(widget.answers);
    _queuePoint();
    // The shared frame (D40, D43, D44): his own Mobi heads the group, sized to the phone, the
    // group balanced in the room, and Back pinned at the foot (the start key is in the card).
    return StepEntrance(
      child: Listener(
        onPointerDown: _touched,
        child: NotificationListener<Notification>(
          // A scroll or a change in the card's size: check the aim once things settle.
          onNotification: (n) {
            if (n is ScrollEndNotification || n is SizeChangedLayoutNotification) _queuePoint();
            return false;
          },
          child: StepFrame(
            guideController: _mobi,
            guideKey: _figure,
            guideEntrance: MobiAct.hello,
            content: SizeChangedLayoutNotifier(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // The title lifts with the step (only Welcome and the plan rise word by word).
                  Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s12),
                    child: EntranceItem(
                      at: Entrance.headline,
                      child: Semantics(header: true, child: Text(move.title, style: type.headline)),
                    ),
                  ),
                  // Faded in only: Mobi aims at its start key as it lays out, so it never moves.
                  EntranceItem(
                    at: Entrance.answer(0),
                    rise: 0,
                    scale: false,
                    child: FirstMoveHeroFor(
                      answers: widget.answers,
                      now: ref.watch(nowProvider)(),
                      onStart: widget.onStart,
                      onLater: () => ref.read(onboardingAnswersProvider.notifier).setTonight(true),
                      startKey: _start,
                      // The 10 rolls once the card has lifted in, and lands with a tick.
                      numberDelay: Entrance.answer(0) + const Duration(milliseconds: 80),
                      onNumberLanded: () => ref.read(hapticsProvider).selection(),
                    ),
                  ),
                  // Group gap from the hero to the next block (SPACING.md 3.1), a step tighter
                  // now that Back is pinned under it.
                  const SizedBox(height: MmSpace.s20),
                  EntranceItem.answer(
                    2,
                    child: WeekAhead(
                      days: widget.answers.days,
                      minutes: widget.answers.minutes,
                      window: widget.answers.window,
                      now: ref.watch(nowProvider)(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// [FirstMoveHero] built from the answers.
class FirstMoveHeroFor extends StatelessWidget {
  const FirstMoveHeroFor({
    super.key,
    required this.answers,
    required this.now,
    required this.onStart,
    required this.onLater,
    this.startKey,
    this.numberDelay = Duration.zero,
    this.onNumberLanded,
  });

  final OnboardingAnswers answers;
  final DateTime now;
  final VoidCallback onStart;
  final VoidCallback onLater;
  final GlobalKey? startKey;
  final Duration numberDelay;
  final VoidCallback? onNumberLanded;

  @override
  Widget build(BuildContext context) => FirstMoveHero(
        move: FirstMove.of(answers),
        now: now,
        onStart: onStart,
        onLater: onLater,
        laterChosen: answers.tonight,
        startKey: startKey,
        numberDelay: numberDelay,
        onNumberLanded: onNumberLanded,
      );
}
