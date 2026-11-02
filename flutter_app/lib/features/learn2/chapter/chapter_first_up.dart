import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'chapter_copy.dart';
import 'chapter_model.dart';
import 'chapter_piles.dart' show PaperColors;

/// "First up" (the web's FirstUp in ChapterPage.jsx, R2 ruling 9, LK10 "see what is lined up"): the fronts of the first three Key
/// cards this run opens with, as small paper cards in a sideways row. A picture of what is coming, not a set of keys: Start plays
/// them. They deal in from 12 dp below, 50 ms apart. A card is 168 dp wide, at least 92 tall, its words on three lines at most
/// and never broken inside a word. Key it by the length and the piles left out, so a new lining-up deals them again.
class FirstUp extends StatelessWidget {
  const FirstUp({super.key, required this.cards});

  final List<FirstUpCard> cards;

  /// A card's width at 390 (the web's container query: 168 under 600 dp).
  static const double cardWidth = 168;
  static const double cardMinHeight = 92;

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final paper = PaperColors(colors);
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Semantics(
        container: true,
        label: ChapterCopy.firstUp,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: Semantics(header: true, child: Text(ChapterCopy.firstUp, style: type.label.copyWith(fontSize: 13, height: 1.3, fontWeight: FontWeight.w700, color: colors.ink2))),
            ),
            const SizedBox(height: 10),
            MmStagger(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 2, MmSpace.gutter, 6),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var i = 0; i < cards.length; i++) ...[
                        if (i > 0) const SizedBox(width: 10),
                        MmStaggerItem(
                          index: i,
                          rise: 12,
                          child: SizedBox(
                            width: cardWidth,
                            child: DecoratedBox(
                              key: ValueKey('first-up-$i'),
                              decoration: ShapeDecoration(
                                color: paper.top,
                                shape: mmShapeBorder(BorderRadius.circular(12), side: BorderSide(color: paper.edge)),
                                shadows: paper.shadow,
                              ),
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(minHeight: cardMinHeight),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  child: Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      cards[i].front,
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                      style: type.title.copyWith(fontSize: 14, height: 1.28, letterSpacing: -0.01 * 14, color: paper.ink),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
