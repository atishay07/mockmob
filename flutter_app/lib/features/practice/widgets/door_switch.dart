import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/practice_door.dart';

/// The switch under Practice's title (19 Oct PM, owner D126, Practice C): Practise, Your papers and Learn as three
/// doors of one place. A sunken track with one raised thumb that slides to the chosen door (ease-out, 240 ms; at once
/// under reduced motion). Your papers carries the open mistakes as a small count, the same number as the bar's badge.
///
/// Each door is as wide as its words need, and the room left over is shared out evenly, so "Your papers" with its count
/// never squeezes "Learn". At large text a word wraps instead of being cut, and the track grows. Every door is a 48 dp
/// target with the app's focus ring, a button that says whether it is chosen, and a selection tick on change.
class PracticeDoorSwitch extends StatelessWidget {
  const PracticeDoorSwitch({super.key, required this.door, required this.onChanged, this.papersCount, this.showLearn = true});

  final PracticeDoor door;
  final ValueChanged<PracticeDoor> onChanged;

  /// The open mistakes the Your papers door counts; none or zero draws no count.
  final int? papersCount;

  /// False only while Learn is switched off on the server: the switch then has two doors.
  final bool showLearn;

  /// The painted track and the thumb inside it.
  static const double trackHeight = 52;
  static const double inset = 4;

  /// Room either side of a door's words.
  static const double sidePad = 14;

  /// The slide: the app's ease-out, a quarter of a second.
  static const Duration slide = Duration(milliseconds: 240);

  List<PracticeDoor> get _doors => [PracticeDoor.practise, PracticeDoor.papers, if (showLearn) PracticeDoor.learn];

  static String labelOf(PracticeDoor d) => switch (d) {
    PracticeDoor.practise => PracticeCopy.doorPractise,
    PracticeDoor.papers => PracticeCopy.doorPapers,
    PracticeDoor.learn => PracticeCopy.doorLearn,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final doors = _doors;
    final chosen = math.max(0, doors.indexOf(door));
    final count = (papersCount ?? 0) > 0 ? papersCount! : null;
    final scaler = MediaQuery.textScalerOf(context);
    final labelStyle = type.labelLarge.copyWith(fontSize: 15, height: 20 / 15);
    final badgeStyle = type.labelLarge.copyWith(fontSize: 12.5, height: 1, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()]);

    return Semantics(
      container: true,
      label: PracticeCopy.doorsLabel,
      child: LayoutBuilder(
        builder: (context, box) {
          final inner = box.maxWidth - inset * 2;
          // What each door needs: its words, its count, and air either side.
          double textWidth(String text, TextStyle style) {
            final tp = TextPainter(text: TextSpan(text: text, style: style.copyWith(fontWeight: FontWeight.w700)), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
            final w = tp.width;
            tp.dispose();
            return w;
          }

          final needs = [
            for (final d in doors)
              textWidth(labelOf(d), labelStyle) + sidePad * 2 + (d == PracticeDoor.papers && count != null ? 6 + math.max(22.0, textWidth('$count', badgeStyle) + 12) : 0),
          ];
          final total = needs.fold<double>(0, (a, b) => a + b);
          // Enough room: each door gets what it needs and an even share of the rest. Not enough (large text): each gets
          // its share of the width, and its words wrap.
          final widths = total <= inner ? [for (final n in needs) n + (inner - total) / doors.length] : [for (final n in needs) inner * n / total];
          final lefts = <double>[];
          var x = 0.0;
          for (final w in widths) {
            lefts.add(x);
            x += w;
          }
          final duration = Motion.of(context, slide);

          return DecoratedBox(
            decoration: ShapeDecoration(color: colors.sunken, shape: StadiumBorder(side: BorderSide(color: colors.line))),
            child: Padding(
              padding: const EdgeInsets.all(inset),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: trackHeight - inset * 2),
                child: Stack(
                    children: [
                      // ONE thumb that slides from the old door to the new: a single move, never a second box arriving.
                      TweenAnimationBuilder<Rect?>(
                        tween: RectTween(end: Rect.fromLTWH(lefts[chosen], 0, widths[chosen], 0)),
                        duration: duration,
                        curve: Motion.out,
                        builder: (context, rect, _) => Positioned(
                          left: rect!.left,
                          width: rect.width,
                          top: 0,
                          bottom: 0,
                          child: DecoratedBox(
                            decoration: ShapeDecoration(color: colors.selectedSurface, shape: const StadiumBorder(), shadows: colors.cardShadow),
                            child: CustomPaint(
                              foregroundPainter: EdgeLightPainter(borderRadius: MmRadius.pillAll, top: colors.edgeTop, bottom: colors.edgeBottom),
                            ),
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          for (final (i, d) in doors.indexed)
                            SizedBox(
                              width: widths[i],
                              child: _Door(
                                key: ValueKey('practice-door-${d.name}'),
                                label: labelOf(d),
                                count: d == PracticeDoor.papers ? count : null,
                                chosen: i == chosen,
                                semanticsLabel: d == PracticeDoor.papers ? PracticeCopy.doorPapersSemantics(count ?? 0) : labelOf(d),
                                style: labelStyle,
                                badgeStyle: badgeStyle,
                                onTap: i == chosen ? null : () => onChanged(d),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Door extends StatelessWidget {
  const _Door({
    super.key,
    required this.label,
    required this.count,
    required this.chosen,
    required this.semanticsLabel,
    required this.style,
    required this.badgeStyle,
    required this.onTap,
  });

  final String label;
  final int? count;
  final bool chosen;
  final String semanticsLabel;
  final TextStyle style;
  final TextStyle badgeStyle;

  /// Null on the chosen door: a tap there does nothing, but it stays a focusable, announced button.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final duration = Motion.of(context, PracticeDoorSwitch.slide);
    return MmPressable(
      onTap: onTap ?? () {},
      semanticsLabel: semanticsLabel,
      selected: chosen,
      inMutuallyExclusiveGroup: true,
      lift: false,
      pressedScale: 0.97,
      haptic: onTap == null ? MmPressHaptic.none : MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, focused) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: PracticeDoorSwitch.sidePad - 4, vertical: 6),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: AnimatedDefaultTextStyle(
                    duration: duration,
                    curve: Motion.out,
                    style: style.copyWith(color: chosen ? colors.ink : colors.ink2, fontWeight: chosen ? FontWeight.w700 : FontWeight.w600),
                    child: Text(label, textAlign: TextAlign.center, maxLines: 2, softWrap: true),
                  ),
                ),
                if (count != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: ShapeDecoration(color: colors.ink, shape: const StadiumBorder()),
                    alignment: Alignment.center,
                    child: Text('$count', style: badgeStyle.copyWith(color: colors.ground)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
