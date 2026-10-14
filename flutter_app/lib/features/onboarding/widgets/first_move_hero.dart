import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/plan.dart';

/// The first move as a hero (brief section 11, step 11): the subject's light field, "10
/// questions to your starting point" (or "10 questions in Physics" for plain practice) in
/// monumental figures and the volt start key. The later option is a plain link under the card,
/// not a second button inside it. No object art: the step's Mobi points at the start key.
class FirstMoveHero extends StatelessWidget {
  const FirstMoveHero({
    super.key,
    required this.move,
    required this.now,
    required this.onStart,
    required this.onLater,
    this.laterChosen = false,
    this.startKey,
    this.numberDelay = Duration.zero,
    this.onNumberLanded,
  });

  final FirstMove move;
  final DateTime now;
  final VoidCallback onStart;
  final VoidCallback onLater;

  /// The student put it off to the study window: the later button becomes a quiet line.
  final bool laterChosen;

  /// On the start key, so Mobi can point at it.
  final GlobalKey? startKey;

  /// The 10 rolls after the card has arrived, and [onNumberLanded] marks the landing (a tick).
  final Duration numberDelay;
  final VoidCallback? onNumberLanded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(move.subject.id) ?? SubjectLight.accountancy;
    final later = move.laterLabel(now);

    // The app's one hero surface (lamp, the subject's light, grain, edge light, volt lit edge),
    // the same tier the student meets on Today next.
    final card = MmSurface.hero(
      lit: true,
      light: light.of(Theme.of(context).brightness),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(move.subject.label, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmRhythm.item),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              MonumentalNumber(
                value: '${FirstMove.questions}',
                style: type.figureHero,
                delay: numberDelay,
                onLanded: onNumberLanded,
              ),
              const SizedBox(width: MmRhythm.item),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s12),
                  child: Text(move.unit, style: type.title.copyWith(fontSize: 20, height: 1.15)),
                ),
              ),
            ],
          ),
          const SizedBox(height: MmRhythm.item),
          Text(OnboardingCopy.firstMoveChapter(move.chapter), style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: 2),
          Text(move.framing, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s20),
          KeyedSubtree(key: startKey, child: KeyButton(label: move.startLabel, onPressed: onStart)),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        card,
        const SizedBox(height: MmSpace.s8),
        if (laterChosen)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12, horizontal: MmSpace.s4),
            child: Semantics(
              liveRegion: true,
              child: Text(
                OnboardingCopy.setFor(later),
                style: type.small.copyWith(color: colors.ink),
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          Center(child: KeyButton.quiet(label: later, onPressed: onLater)),
      ],
    );
  }
}
