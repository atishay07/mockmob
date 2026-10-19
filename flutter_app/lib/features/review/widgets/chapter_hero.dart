import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/art/art.dart' show EmblemSizes, SubjectEmblem;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/review_chapters.dart';
import 'review_layout.dart';

/// The chapter that is open on Review, as the tab's hero (REVIEW-RESULT-1018 4.5): the sentence that says where it ranks, its
/// name, the marks it lost as the monumental number against the marks on offer, how many questions that was and in which papers,
/// the bar, and the one volt key. It is the only lime fill in the content of the tab; it follows whichever chapter is open.
///
/// Night stays subtle: a raised card with the subject's object beside the title, no wash, no glow. The number is in the wrong
/// ink and carries its denominator ("of 80"); with no denominator known (an older record) it says "marks lost" alone and the bar
/// is not drawn, because a bar with no whole behind it would be a made-up fullness. When the marks lost pass the marks on offer
/// ([ChapterRow.overOffer]: a wrong answer loses 6 and a question offers 5) the "of N" is left out, never "316 of 310"; the bar is
/// then full, which is true (every mark on offer went), and never wider than its rail.
class ChapterHero extends StatelessWidget {
  const ChapterHero({
    super.key,
    required this.row,
    required this.rank,
    required this.practiseLabel,
    required this.practiseLine,
    required this.onPractise,
  });

  final ChapterRow row;

  /// 1 for the chapter that lost the most marks.
  final int rank;

  /// "Practise 10 on this chapter".
  final String practiseLabel;

  /// What the practice is and what it costs: "10 new questions, about 10 minutes. Uses 10 of your 40 credits."
  final String practiseLine;
  final VoidCallback onPractise;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final large = MediaQuery.textScalerOf(context).scale(10) > 11.5;
    // At large text the object gives way: a smaller prop, so the title keeps its room.
    final artSize = large ? EmblemSizes.tile : ReviewSpace.artSize;
    final artBox = artSize + 20;
    final bandRight = artBox - ReviewSpace.artBleedRight + MmSpace.s12 - ReviewSpace.heroPad;
    // Everything under the number starts below the object, even for a one-line title.
    final clearArt = ReviewSpace.artTop + artSize - ReviewSpace.heroPad + MmSpace.s4;
    final offer = row.offer;
    final counted = [if (row.wrong > 0) '${row.wrong} wrong', if (row.blank > 0) '${row.blank} left blank'].join(', ');
    final scope = ReviewCopy.chapterScope(questions: row.questions, papers: namePapers(row.papers), counted: counted);
    final lead = rank == 1 ? ReviewCopy.loseMost : ReviewCopy.costliestNth(rank);
    final scopeStyle = type.small.copyWith(fontSize: 14.5, height: 21 / 14.5, color: colors.ink2);
    final spoken = '$lead ${row.name}. ${row.line.text}';

    return Stack(
      clipBehavior: Clip.none,
      children: [
        MmSurface.hero(
          padding: const EdgeInsets.all(ReviewSpace.heroPad),
          semanticsLabel: null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                container: true,
                label: spoken,
                excludeSemantics: true,
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: clearArt),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Padding(
                        padding: EdgeInsets.only(right: bandRight),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(lead, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(fontSize: 13.5, color: colors.ink2)),
                            const SizedBox(height: MmSpace.s4),
                            WholeWordTitle(
                              text: row.name,
                              maxLines: large ? 5 : 3,
                              style: type.title.copyWith(fontSize: 24, height: 27 / 24),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: MmSpace.s12),
                      Padding(
                        padding: EdgeInsets.only(right: bandRight),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              MonumentalNumber(
                                value: '${row.lost}',
                                style: type.figure.copyWith(fontSize: 72, height: 64 / 72),
                                color: colors.badText,
                                // The roll waits for the hero to arrive, then lands with one tick.
                                delay: Motion.enterDuration,
                                onLanded: () => mmHapticsOf(context)?.selection(),
                                semanticsLabel: '${row.lost} ${ReviewCopy.marksLostWord}',
                              ),
                              const SizedBox(width: 10),
                              Padding(
                                padding: const EdgeInsets.only(bottom: 2),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (offer != null && !row.overOffer) Text(ReviewCopy.ofOffer(offer), style: _unit(type, colors)),
                                    Text(ReviewCopy.marksLostWord, style: _unit(type, colors)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: MmSpace.s12),
              _Scope(text: scope, questions: row.questions, style: scopeStyle, strong: type.small.copyWith(fontSize: 14.5, height: 21 / 14.5, fontWeight: FontWeight.w600, color: colors.ink)),
              if (offer != null) ...[const SizedBox(height: MmSpace.s12), LostBar(share: row.share, key: ValueKey('bar-${row.id}'))],
              const SizedBox(height: MmSpace.s16),
              KeyButton(label: practiseLabel, semanticsLabel: '$practiseLabel. $practiseLine', onPressed: onPractise),
              const SizedBox(height: MmSpace.s8),
              Text(practiseLine, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
            ],
          ),
        ),
        // The subject's object: a box 8 dp from the top, bled 10 dp past the right edge so the drawing ends on the card edge.
        Positioned(
          right: -ReviewSpace.artBleedRight,
          top: ReviewSpace.artTop,
          width: artBox,
          height: artBox,
          child: IgnorePointer(
            child: RepaintBoundary(
              child: Center(child: SubjectEmblem(subject: row.subject ?? '', size: artSize, framed: false)),
            ),
          ),
        ),
      ],
    );
  }

  static TextStyle _unit(MmType type, MmColors colors) => type.figureCompact.copyWith(fontSize: 24, height: 25 / 24, color: colors.ink2);
}

/// "16 questions in Mock 3 and Mock 2: 5 wrong, 1 left blank." with its first words (the count) in ink.
class _Scope extends StatelessWidget {
  const _Scope({required this.text, required this.questions, required this.style, required this.strong});

  final String text;
  final int? questions;
  final TextStyle style;
  final TextStyle strong;

  @override
  Widget build(BuildContext context) {
    final lead = questions == null ? '' : '$questions question${questions == 1 ? '' : 's'}';
    if (lead.isEmpty || !text.startsWith(lead)) return Text(text, style: style);
    return Text.rich(TextSpan(style: style, children: [TextSpan(text: lead, style: strong), TextSpan(text: text.substring(lead.length))]));
  }
}

/// Marks lost over marks on offer: the wrong ink on a hairline rail, drawn in once when the chapter opens (420 ms on the shared
/// curve, instant under reduced motion). It is the same figure the number and the line say.
class LostBar extends StatelessWidget {
  const LostBar({super.key, required this.share, this.height = 6});

  final double share;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final whole = share.isNaN ? 0.0 : share.clamp(0.0, 1.0);
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: whole),
          duration: Motion.of(context, Motion.drawIn),
          curve: Motion.emphasized,
          builder: (context, t, _) => ClipRRect(
            borderRadius: BorderRadius.circular(height / 2),
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: colors.line),
                Align(
                  alignment: Alignment.centerLeft,
                  // A sliver of loss is still seen: never narrower than the bar is tall.
                  child: FractionallySizedBox(widthFactor: t <= 0 ? 0 : t.clamp(0.02, 1.0), heightFactor: 1, child: ColoredBox(color: colors.wrongMark)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A title that breaks only between words (19 Oct walk, finding 31: "Partnership Fundamental / s" at 360 dp). When its
/// longest word is wider than the room beside the art, the size steps down until that word fits on its own line (never
/// below [minScale] of the style's size); the line height keeps its ratio, so the block stays in proportion.
class WholeWordTitle extends StatelessWidget {
  const WholeWordTitle({super.key, required this.text, required this.style, this.maxLines = 3, this.minScale = 0.72});

  final String text;
  final TextStyle style;
  final int maxLines;
  final double minScale;

  /// The size at which every word of [text] fits [width], or [style]'s own size when it already does.
  static double fittedSize(String text, TextStyle style, double width, TextScaler scaler, {double minScale = 0.72}) {
    final size = style.fontSize ?? 14;
    if (!width.isFinite || width <= 0) return size;
    var widest = 0.0;
    for (final word in text.split(RegExp(r'\s+'))) {
      if (word.isEmpty) continue;
      final painter = TextPainter(text: TextSpan(text: word, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)
        ..layout();
      if (painter.width > widest) widest = painter.width;
      painter.dispose();
    }
    if (widest <= width) return size;
    // A hair under the exact fit, so rounding never pushes the last letter onto its own line.
    return math.max(size * minScale, size * (width / widest) * 0.98);
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final fitted = fittedSize(text, style, constraints.maxWidth, MediaQuery.textScalerOf(context), minScale: minScale);
      return Text(
        text,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        style: fitted == style.fontSize ? style : style.copyWith(fontSize: fitted),
      );
    },
  );
}
