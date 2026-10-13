import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/subjects.dart';

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
        onToggle();
      },
      builder: (context, pressed, _) => SubjectLine(subject: subject, chosen: included, dim: !included, bubble: !included),
    );

    return AnimatedContainer(
      duration: Motion.of(context, Motion.glideDuration),
      curve: Motion.glide,
      decoration: ShapeDecoration(
        color: MmSelection.fill(colors, selected: included),
        shape: mmShapeBorder(MmRadius.keyAll, side: MmSelection.side(colors, selected: included)),
      ),
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          header,
          _Grow(
            child: included
                ? Padding(
                    padding: const EdgeInsets.only(left: MmSpace.s4, bottom: MmSpace.s12),
                    // Unrated reads as Okay, the default the plan uses, so nothing is hidden.
                    child: MmSegmented<Confidence>(
                      semanticsLabel: 'How solid is ${subject.label}',
                      segments: [for (final c in Confidence.values) MmSegment(c, c.label)],
                      value: confidence ?? Confidence.okay,
                      onChanged: onConfidence,
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
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

/// The 56 dp line of a subject: its lamp-lit object, the name (and an optional note), and the
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
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          SubjectObject(id: subject.id, size: 40),
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

/// A subject's object from the shared art set, on a faint lamp-lit tile so every object reads
/// at the same weight. [ghost] greys it for a subject MockMob does not offer yet.
class SubjectObject extends StatelessWidget {
  const SubjectObject({super.key, required this.id, this.size = 40, this.ghost = false});

  final String id;
  final double size;
  final bool ghost;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final art = MmArt.subjectObject(id) ?? MmArt.objLanguage;
    return SizedBox.square(
      dimension: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            center: const Alignment(-0.3, -0.5),
            colors: [colors.lamp.withValues(alpha: ghost ? 0.04 : (colors.isNight ? 0.16 : 0.12)), colors.lamp.withValues(alpha: 0)],
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(size * 0.06),
          child: ArtImage(art, height: size * 0.88, ghost: ghost, opacity: ghost ? 0.7 : null),
        ),
      ),
    );
  }
}
