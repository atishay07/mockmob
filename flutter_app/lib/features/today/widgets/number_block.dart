// The hero's monumental number with its two-line meaning beside it ("6  mistakes / from
// Mock 7"). The number rolls in once and again whenever the chosen duration reshapes the task;
// after landing it never moves (brief section 7).
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

class NumberBlock extends StatelessWidget {
  const NumberBlock({super.key, required this.number, this.label, this.semanticsLabel});

  final String number;

  /// Up to two short lines, set beside the number on its baseline.
  final String? label;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final labelStyle = type.title.copyWith(fontSize: 21, height: 24 / 21, color: colors.ink, letterSpacing: -0.2);
    return Semantics(
      container: true,
      label: semanticsLabel ?? [number, if (label != null) label!.replaceAll('\n', ' ')].join(' '),
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          MonumentalNumber(value: number, color: colors.ink),
          if (label != null) ...[
            const SizedBox(width: MmSpace.s12),
            Flexible(
              child: Padding(
                // Sits the last line on the number's baseline (the hero cut has a short descent).
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(label!, style: labelStyle, maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
