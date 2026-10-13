import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/plan.dart';

/// The first move as a hero (brief section 11, step 11): the subject's light field, "10
/// questions to your starting point" (or "10 questions in Physics" for plain practice) in
/// monumental figures, the volt start key and the later option at equal footing below it. No
/// object art: the step's Mobi points at the start key.
class FirstMoveHero extends StatelessWidget {
  const FirstMoveHero({
    super.key,
    required this.move,
    required this.now,
    required this.onStart,
    required this.onLater,
    this.laterChosen = false,
    this.startKey,
  });

  final FirstMove move;
  final DateTime now;
  final VoidCallback onStart;
  final VoidCallback onLater;

  /// The student put it off to the study window: the later button becomes a quiet line.
  final bool laterChosen;

  /// On the start key, so Mobi can point at it.
  final GlobalKey? startKey;

  static const BorderRadius radius = MmRadius.panelAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(move.subject.id) ?? SubjectLight.accountancy;
    final later = move.laterLabel(now);

    return LitEdge(
      glow: true,
      borderRadius: radius,
      child: MmClip(
        borderRadius: radius,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.raised),
          child: Stack(
            children: [
              Positioned.fill(child: LightField.subject(context, light, center: const Alignment(0.7, -0.6))),
              const Positioned.fill(child: Grain()),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(move.subject.label, style: type.label.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        MonumentalNumber(value: '${FirstMove.questions}', style: type.figureHero),
                        const SizedBox(width: MmSpace.s12),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: MmSpace.s12),
                            child: Text(move.unit, style: type.title.copyWith(fontSize: 20, height: 1.15)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s12),
                    Text(OnboardingCopy.firstMoveChapter(move.chapter), style: type.body.copyWith(color: colors.ink2)),
                    const SizedBox(height: 2),
                    Text(move.framing, style: type.body.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s20),
                    KeyedSubtree(key: startKey, child: KeyButton(label: move.startLabel, onPressed: onStart)),
                    const SizedBox(height: MmSpace.s8),
                    if (laterChosen)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
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
                      KeyButton.secondary(label: later, onPressed: onLater),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
