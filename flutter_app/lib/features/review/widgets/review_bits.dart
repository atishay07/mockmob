import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

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

/// The subject's colour as a small pool of light (brief section 3) holding either its object
/// ([art], for a page's one hero) or a wrong-answer bubble (list rows, so the object art is not
/// repeated down the page).
class SubjectMark extends StatelessWidget {
  const SubjectMark({super.key, required this.subjectId, this.size = 48, this.art = true});

  final String subjectId;
  final double size;
  final bool art;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final light = SubjectLight.forSubject(subjectId);
    final object = art ? MmArt.subjectObject(subjectId) : null;
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
            if (object != null)
              ArtImage(object, height: size * 0.86, width: size * 0.86)
            else
              Bubble(state: BubbleState.wrong, size: size * 0.36, animate: false),
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
    final wrong = count.clamp(1, 3);
    return ShowMePill(
      onTap: onTap,
      semanticsLabel: semanticsLabel ?? 'Show me, the questions behind this',
      marks: [for (var i = 0; i < 3; i++) i < wrong ? BubbleState.wrong : BubbleState.hollow],
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
