import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/art/subject_emblem.dart' show SubjectEmblem;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/subjects.dart';
import 'choice_tile.dart';
import 'confidence_bubbles.dart';

/// One subject on the subjects step: its object, its name, and the answer-sheet bubble that
/// inks when it is on the sheet; once included, Shaky, Okay or Strong opens beneath.
class SubjectRow extends ConsumerWidget {
  const SubjectRow({
    super.key,
    required this.subject,
    required this.included,
    required this.confidence,
    required this.onToggle,
    required this.onConfidence,
  });

  final SheetSubject subject;
  final bool included;
  final Confidence? confidence;
  final VoidCallback onToggle;
  final ValueChanged<Confidence> onConfidence;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final header = MmPressable(
      semanticsLabel: subject.label,
      checked: included,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        GuideGlance.at(context);
        onToggle();
      },
      builder: (context, pressed, _) => SubjectLine(subject: subject, chosen: included, dim: !included, bubble: !included),
    );

    // On the sheet: a flat wash of the lamp's light under the name and the confidence bubbles, no
    // border and no box inside a box. Off the sheet: bare on the ground. Each subject is its own
    // item with 8 dp of ground between it and the next, so no two washes touch at their corners.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedContainer(
          duration: Motion.of(context, Motion.glideDuration),
          curve: Motion.glide,
          decoration: BoxDecoration(
            color: included ? colors.lamp.withValues(alpha: colors.isNight ? 0.07 : 0.12) : Colors.transparent,
            borderRadius: BorderRadius.circular(MmRadius.key),
          ),
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              header,
              _Grow(
                child: included
                    ? Padding(
                        // Under the name (the 44 dp object and the 12 dp gap come first).
                        padding: const EdgeInsets.only(left: 56, bottom: MmSpace.s4),
                        // Unrated reads as Okay, the default the plan uses, so nothing is hidden.
                        child: ConfidenceBubbles(
                          subject: subject.label,
                          value: confidence ?? Confidence.okay,
                          onChanged: onConfidence,
                        ),
                      )
                    : const SizedBox(width: double.infinity),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }
}

/// Opens and closes with its content; at once under reduced motion (a zero-length AnimatedSize
/// trips over itself).
class _Grow extends StatelessWidget {
  const _Grow({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return AnimatedSize(duration: Motion.glideDuration, curve: Motion.emphasized, alignment: Alignment.topCenter, child: child);
  }
}

/// The 52 dp line of a subject: its lamp-lit object, the name (and an optional note), and the
/// bubble at the end. Shared by the step and the picker.
class SubjectLine extends StatelessWidget {
  const SubjectLine({
    super.key,
    required this.subject,
    required this.chosen,
    this.dim = false,
    this.note,
    this.bubble = true,
  });

  final SheetSubject subject;
  final bool chosen;

  /// Not on the sheet yet: the name in the second ink.
  final bool dim;
  final String? note;

  /// Show the selection bubble. Off where another control already says the subject is chosen.
  final bool bubble;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(
        children: [
          SubjectObject(id: subject.id, size: 44, marked: chosen),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(subject.label, style: type.body.copyWith(fontWeight: FontWeight.w600, color: dim ? colors.ink2 : colors.ink)),
                if (note != null) Text(note!, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
          if (bubble) ...[const SizedBox(width: MmSpace.s12), SelectBubble(selected: chosen, size: 20)],
        ],
      ),
    );
  }
}

/// A subject's code-drawn emblem standing on its own light, its volt mark inked once the subject
/// is on the sheet ([marked]).
class SubjectObject extends StatelessWidget {
  const SubjectObject({super.key, required this.id, this.size = 40, this.marked = false});

  final String id;
  final double size;
  final bool marked;

  @override
  Widget build(BuildContext context) => SubjectEmblem(subject: id, size: size, framed: false, marked: marked);
}
