import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';

/// "Idea 1" beside one objective of a lesson. The number is the order the lesson covers it in,
/// so the label says something a bullet would not.
class IdeaLine extends StatelessWidget {
  const IdeaLine({super.key, required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '${LearnCopy.objectiveNumber(number)}. $text',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 60,
              child: Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(LearnCopy.objectiveNumber(number), style: type.label.copyWith(color: colors.ink2)),
              ),
            ),
            Expanded(child: Text(text, style: type.body)),
          ],
        ),
      ),
    );
  }
}
