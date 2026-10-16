import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/question_strip.dart' show QuestionCell;
import '../copy.dart';
import '../model/finish_reaction.dart';

/// Where the marks went, as the website's Score Recovery bar shows it: what was scored, what
/// the wrong answers cost and what was left on blanks, out of the paper's maximum. Each segment
/// is a share of real marks, and the line under it says the same thing in words.
class MarksBar extends StatelessWidget {
  const MarksBar({super.key, required this.marks, this.reveal = 1, this.fill});

  final FinishMarks marks;

  /// 0 to 1: how much of the bar is filled and its line shown. The track is always there, so the
  /// place the marks will land never reads as a hole. With [fill] set, only the line is shown by
  /// this, and the bar fills by the ink instead.
  final double reveal;

  /// How much of each segment has inked so far, as the sheet's bubbles ink (AP2-03): every right
  /// bubble adds its 5 marks to the volt segment, every wrong one its 6 to the coral, every blank
  /// one its 5 to the grey. The three segments keep their final places and fill left to right
  /// inside them, so nothing slides, and the bar is full when the last bubble has inked.
  final MarksFill? fill;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = marks;
    if (m.max <= 0) return const SizedBox.shrink();
    final scored = m.scored.clamp(0, m.max);
    // The wrong answers' cost can exceed what is left once a negative score is clamped to 0.
    final wrong = m.lostToWrong.clamp(0, m.max - scored);
    final blank = m.leftOnBlanks.clamp(0, m.max - scored - wrong);

    final f = fill;
    Widget filled(double share, Widget child) =>
        f == null ? child : FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: share.clamp(0.0, 1.0), child: child);

    Widget segment(int value, Color color, double share) => value <= 0
        ? const SizedBox.shrink()
        : Expanded(
            flex: value,
            child: filled(share, SizedBox.expand(child: ColoredBox(color: color))),
          );

    return Semantics(
      container: true,
      label: PracticeCopy.marksLine(m),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: MmRadius.pillAll,
            child: SizedBox(
              height: 10,
              child: ColoredBox(
                color: colors.ink.withValues(alpha: 0.08),
                child: ClipRect(
                  clipper: _RevealClipper(f == null ? reveal : 1),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Volt in both themes, as the bubbles are; in Daylight a 1 dp ink edge keeps
                      // it apart from the paper.
                      if (scored > 0)
                        Expanded(
                          flex: scored,
                          child: filled(
                            f?.right ?? 1,
                            SizedBox.expand(
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: colors.volt,
                                  border: colors.isNight ? null : Border.all(color: colors.ink.withValues(alpha: 0.24)),
                                  borderRadius: MmRadius.pillAll,
                                ),
                              ),
                            ),
                          ),
                        ),
                      segment(wrong, colors.wrongMark, f?.wrong ?? 1),
                      segment(blank, colors.ink3, f?.blank ?? 1),
                      segment(m.max - scored - wrong - blank, Colors.transparent, 1),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Opacity(
            opacity: reveal.clamp(0.0, 1.0),
            child: Text(PracticeCopy.marksLine(m), style: type.small.copyWith(color: colors.ink2)),
          ),
        ],
      ),
    );
  }
}

/// How much of each of the marks bar's segments has inked, each 0 to 1 (see [MarksBar.fill]).
class MarksFill {
  const MarksFill({required this.right, required this.wrong, required this.blank});

  static const MarksFill full = MarksFill(right: 1, wrong: 1, blank: 1);

  final double right;
  final double wrong;
  final double blank;

  /// The fill after the first [inked] of [cells] bubbles have inked: each segment holds the share of
  /// its own kind of bubble that is in. A kind with no bubbles is full (it has no width anyway).
  factory MarksFill.after(List<QuestionCell> cells, int inked) {
    var r = 0, w = 0, b = 0, tr = 0, tw = 0, tb = 0;
    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      final isIn = i < inked;
      if (c == QuestionCell.right) {
        tr++;
        if (isIn) r++;
      } else if (c == QuestionCell.wrong || c == QuestionCell.repaired) {
        tw++;
        if (isIn) w++;
      } else {
        tb++;
        if (isIn) b++;
      }
    }
    double share(int n, int t) => t == 0 ? 1 : n / t;
    return MarksFill(right: share(r, tr), wrong: share(w, tw), blank: share(b, tb));
  }
}

/// Shows the left [reveal] share of the bar, so the marks fill in from the left.
class _RevealClipper extends CustomClipper<Rect> {
  const _RevealClipper(this.reveal);

  final double reveal;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width * reveal.clamp(0.0, 1.0), size.height);

  @override
  bool shouldReclip(_RevealClipper old) => old.reveal != reveal;
}
