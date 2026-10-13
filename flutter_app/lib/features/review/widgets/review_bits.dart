import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';

/// A section heading on Review: the title in the Bricolage title cut, an optional quiet count
/// on the right.
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.trailing, this.caption});

  final String title;
  final String? trailing;

  /// A quiet line under the title ("7 mistakes across 4 chapters").
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Semantics(header: true, child: Text(title, style: type.title)),
              ),
              if (trailing != null) Text(trailing!, style: type.caption.copyWith(color: context.mmColors.ink2)),
            ],
          ),
          if (caption != null) ...[const SizedBox(height: 2), Text(caption!, style: type.small.copyWith(color: context.mmColors.ink2))],
        ],
      ),
    );
  }
}

/// The subject's object in a small pool of its own light: the colour accent of a chapter
/// (brief section 3: light fields sit behind art only).
class SubjectMark extends StatelessWidget {
  const SubjectMark({super.key, required this.subjectId, this.size = 48});

  final String subjectId;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final light = SubjectLight.forSubject(subjectId);
    final art = MmArt.subjectObject(subjectId);
    final brightness = Theme.of(context).brightness;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      (light?.of(brightness) ?? colors.raised2).withValues(alpha: colors.isNight ? 1 : 0.9),
                      (light?.of(brightness) ?? colors.raised2).withValues(alpha: 0),
                    ],
                    stops: const [0.25, 1],
                  ),
                ),
              ),
            ),
            if (art != null)
              ArtImage(art, height: size * 0.86, width: size * 0.86)
            else
              Bubble(state: BubbleState.wrong, size: size * 0.32, animate: false),
          ],
        ),
      ),
    );
  }
}

/// A stage word with its bubble, so the stage never rests on colour alone.
class StageChip extends StatelessWidget {
  const StageChip(this.stage, {super.key});

  final MistakeStage stage;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final (label, bubble) = switch (stage) {
      MistakeStage.found => (ReviewCopy.found, BubbleState.wrong),
      MistakeStage.reviewed => (ReviewCopy.reviewed, BubbleState.marked),
      MistakeStage.repaired => (ReviewCopy.repaired, BubbleState.filled),
      MistakeStage.setAside => (ReviewCopy.setAside, BubbleState.blank),
    };
    return DecoratedBox(
      decoration: ShapeDecoration(
        shape: StadiumBorder(side: BorderSide(color: colors.line)),
        color: colors.isNight ? colors.raised2 : colors.raised,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 10, 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Bubble(state: bubble, size: 12, animate: false),
            const SizedBox(width: 6),
            Text(label, style: context.mmType.caption.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// "Show me": the evidence behind a claim (brief 12.1). A small glass tag with a few bubbles,
/// opening the exact questions.
class ShowMeTag extends StatelessWidget {
  const ShowMeTag({super.key, required this.count, required this.onTap, this.semanticsLabel});

  final int count;
  final VoidCallback onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final shown = count.clamp(1, 4);
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel ?? ReviewCopy.showMe,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          widthFactor: 1,
          child: FakeGlass(
            borderRadius: MmRadius.pillAll,
            pressed: pressed,
            opacity: colors.isNight ? 0.82 : 0.9,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 7, 14, 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  BubbleRow(states: List.filled(shown, BubbleState.wrong), bubbleSize: 9, gap: 3),
                  const SizedBox(width: 8),
                  Text(ReviewCopy.showMe, style: context.mmType.label.copyWith(color: colors.ink)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A plain solid surface for the work layer: raised, hairline, continuous corners.
class SolidPanel extends StatelessWidget {
  const SolidPanel({super.key, required this.child, this.padding = const EdgeInsets.all(MmSpace.s16), this.color, this.borderColor});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: color ?? colors.raised,
        shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: borderColor ?? colors.line)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}
