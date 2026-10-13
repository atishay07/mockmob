import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/first_move_hero.dart';

/// Step 11 for a student who chose "Not now": the first move, ready. The check is marked on the
/// server, so "Start now" asks for the account first; "Tonight" keeps it waiting here. Mobi
/// stands above the card, says his line and points down at Start.
class FirstMoveStep extends ConsumerStatefulWidget {
  const FirstMoveStep({super.key, required this.answers, required this.onStart});

  final OnboardingAnswers answers;

  /// Goes to the save step, with the reason.
  final VoidCallback onStart;

  @override
  ConsumerState<FirstMoveStep> createState() => _FirstMoveStepState();
}

class _FirstMoveStepState extends ConsumerState<FirstMoveStep> {
  final MobiController _mobi = MobiController();
  final GlobalKey _hero = GlobalKey();

  @override
  void initState() {
    super.initState();
    _mobi.say(OnboardingCopy.mobiFirstMove);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final box = _hero.currentContext?.findRenderObject();
      // Start sits about two thirds of the way down the card.
      if (mounted && box is RenderBox && box.hasSize) _mobi.pointAt(box.localToGlobal(Offset(box.size.width * 0.45, box.size.height * 0.62)));
    });
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.only(top: MmSpace.s8, bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    MobiCharacter(controller: _mobi, size: 120, entrance: MobiAct.hello, interactive: true, seed: 5),
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
                  padding: const EdgeInsets.only(left: MmSpace.s4, top: MmSpace.s8, bottom: MmSpace.s16),
                  child: Semantics(header: true, child: Text(OnboardingCopy.firstMoveTitle, style: type.headline)),
                ),
                KeyedSubtree(
                  key: _hero,
                  child: FirstMoveHeroFor(
                    answers: widget.answers,
                    now: ref.watch(nowProvider)(),
                    onStart: widget.onStart,
                    onLater: () => ref.read(onboardingAnswersProvider.notifier).setTonight(true),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// [FirstMoveHero] built from the answers.
class FirstMoveHeroFor extends StatelessWidget {
  const FirstMoveHeroFor({super.key, required this.answers, required this.now, required this.onStart, required this.onLater});

  final OnboardingAnswers answers;
  final DateTime now;
  final VoidCallback onStart;
  final VoidCallback onLater;

  @override
  Widget build(BuildContext context) => FirstMoveHero(
        move: FirstMove.of(answers),
        now: now,
        onStart: onStart,
        onLater: onLater,
        laterChosen: answers.tonight,
      );
}
