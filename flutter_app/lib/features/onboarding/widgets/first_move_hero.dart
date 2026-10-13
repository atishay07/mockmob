import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/plan.dart';

/// The first move as a hero (brief section 11, step 11): the subject's light field and its
/// object, "10 questions to your starting point" in monumental figures, the volt "Start now"
/// and the later option at equal footing below it. Today may embed it for the day-one state.
class FirstMoveHero extends StatelessWidget {
  const FirstMoveHero({
    super.key,
    required this.move,
    required this.now,
    required this.onStart,
    required this.onLater,
    this.laterChosen = false,
  });

  final FirstMove move;
  final DateTime now;
  final VoidCallback onStart;
  final VoidCallback onLater;

  /// The student put it off to the study window: the later button becomes a quiet line.
  final bool laterChosen;

  static const BorderRadius radius = MmRadius.panelAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(move.subject.id) ?? SubjectLight.accountancy;
    final object = MmArt.subjectObject(move.subject.id);
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
              if (object != null) Positioned(right: 10, top: 10, width: 128, height: 128, child: ArtImage(object, fit: BoxFit.contain)),
              const Positioned.fill(child: Grain()),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(move.subject.label, style: type.label.copyWith(color: colors.ink2)),
                    const SizedBox(height: 56),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        MonumentalNumber(value: '${FirstMove.questions}', style: type.figureHero),
                        const SizedBox(width: MmSpace.s12),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: MmSpace.s12),
                            child: Text(OnboardingCopy.firstMoveUnit, style: type.title.copyWith(fontSize: 20, height: 1.15)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s12),
                    Text(OnboardingCopy.firstMoveChapter(move.chapter), style: type.body.copyWith(color: colors.ink2)),
                    const SizedBox(height: 2),
                    Text(move.framing, style: type.body.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s20),
                    KeyButton(label: OnboardingCopy.startNow, onPressed: onStart),
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
