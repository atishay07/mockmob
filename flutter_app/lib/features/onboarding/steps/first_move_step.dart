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
import '../widgets/week_ahead.dart';

/// Step 11 for a student who chose "Not now": the first move, ready. Practice is marked on the
/// server, so the start key asks for the account first; "Tonight" keeps it waiting here. Mobi
/// stands above the card, says his line and points down at the start key; if no finger lands for
/// 1.2 s he nudges at it once.
class FirstMoveStep extends ConsumerStatefulWidget {
  const FirstMoveStep({super.key, required this.answers, required this.onStart, this.mobi});

  final OnboardingAnswers answers;

  /// Goes to the save step, with the reason.
  final VoidCallback onStart;

  /// Drives the step's Mobi; the step makes its own when null (tests pass one to watch it).
  final MobiController? mobi;

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

  /// One nudge per visit: if no finger lands within [_nudgeAfter] of the first point, Mobi jabs
  /// at the start key twice and keeps pointing.
  Timer? _nudge;
  bool _nudgeSpent = false;
  static const Duration _nudgeAfter = Duration(milliseconds: 1200);

  @override
  void initState() {
    super.initState();
    _mobi.say(OnboardingCopy.mobiFirstMove);
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
    _nudge = Timer(_nudgeAfter, () {
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
    return StepEntrance(
      child: Listener(
        onPointerDown: _touched,
        child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: NotificationListener<Notification>(
            // A scroll or a change in the card's size: check the aim once things settle.
            onNotification: (n) {
              if (n is ScrollEndNotification || n is SizeChangedLayoutNotification) _queuePoint();
              return false;
            },
            child: SingleChildScrollView(
              padding: EdgeInsets.only(top: MmSpace.s8, bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s32),
              child: SizeChangedLayoutNotifier(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        KeyedSubtree(
                          key: _figure,
                          child: MobiCharacter(controller: _mobi, size: 120, entrance: MobiAct.hello, interactive: true, seed: 5),
                        ),
                        const SizedBox(width: MmSpace.s4),
                        Expanded(
                          child: ValueListenableBuilder<MobiSpeech?>(
                            valueListenable: _mobi.speech,
                            builder: (context, speech, _) => speech == null
                                ? const SizedBox.shrink()
                                : Align(
                                    alignment: Alignment.centerLeft,
                                    child: MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 220),
                                  ),
                          ),
                        ),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.only(left: MmSpace.s4, top: MmSpace.s20, bottom: MmSpace.s16),
                      child: Semantics(header: true, child: RiseHeadline(move.title, style: type.headline)),
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
                    const SizedBox(height: MmSpace.s24),
                    EntranceItem.answer(
                      2,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                        child: WeekAhead(
                          days: widget.answers.days,
                          minutes: widget.answers.minutes,
                          window: widget.answers.window,
                          now: ref.watch(nowProvider)(),
                        ),
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
