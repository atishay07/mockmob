import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Five pips that mark where the student is in the sample, not how well they did (spec 5.1.3).
/// The current pip is taller and outlined; an answered pip is filled; an open pip is a pale
/// dash. Shape carries the state, so colour is never the only signal.
class PositionPips extends StatelessWidget {
  const PositionPips({super.key, required this.current, required this.answered});

  /// 1-based index of the question on screen.
  final int current;

  /// Which questions already have an answer, in order.
  final List<bool> answered;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(
        height: 12,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            for (var i = 0; i < answered.length; i++) ...[
              if (i > 0) const SizedBox(width: MmSpace.s8),
              _Pip(isCurrent: i + 1 == current, isAnswered: answered[i], colors: colors),
            ],
          ],
        ),
      ),
    );
  }
}

class _Pip extends StatelessWidget {
  const _Pip({required this.isCurrent, required this.isAnswered, required this.colors});

  final bool isCurrent;
  final bool isAnswered;
  final MmColors colors;

  @override
  Widget build(BuildContext context) {
    final Color fill = isAnswered ? colors.ink : (isCurrent ? colors.raised : colors.line);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: fill,
        borderRadius: MmRadius.pillAll,
        border: isCurrent ? Border.all(color: colors.ink, width: 2) : null,
      ),
      child: SizedBox(width: 28, height: isCurrent ? 12 : 6),
    );
  }
}
