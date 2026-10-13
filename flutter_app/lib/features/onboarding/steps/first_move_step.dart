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
/// server, so "Start now" asks for the account first; "Tonight" keeps it waiting here.
class FirstMoveStep extends ConsumerWidget {
  const FirstMoveStep({super.key, required this.answers, required this.onStart});

  final OnboardingAnswers answers;

  /// Goes to the save step, with the reason.
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.only(top: MmSpace.s24, bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s16),
                  child: Semantics(header: true, child: Text(OnboardingCopy.firstMoveTitle, style: type.headline)),
                ),
                FirstMoveHeroFor(
                  answers: answers,
                  now: ref.watch(nowProvider)(),
                  onStart: onStart,
                  onLater: () => ref.read(onboardingAnswersProvider.notifier).setTonight(true),
                ),
                const SizedBox(height: MmSpace.s24),
                // Mobi points up at Start. Why the check needs an account is said only once a
                // guest taps Start (on the save step it opens).
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Mobi(pose: MobiPose.point, size: 120, motion: MobiMotion.tilt, say: OnboardingCopy.mobiFirstMove),
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
