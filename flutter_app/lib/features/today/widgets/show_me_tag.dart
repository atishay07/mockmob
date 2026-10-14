// "Show me" (brief 12.1, evidence first) on Today: the shared pill, naming what it opens. Its
// bubbles show what the evidence holds (three wrong answers for a repair of three), never a
// decorative pattern.
import 'package:flutter/material.dart';

import '../../../core/widgets/widgets.dart';

class ShowMeTag extends StatelessWidget {
  const ShowMeTag({super.key, required this.onTap, this.semanticsLabel, this.marks});

  final VoidCallback onTap;
  final String? semanticsLabel;
  final List<BubbleState>? marks;

  @override
  Widget build(BuildContext context) => ShowMePill(
        onTap: onTap,
        semanticsLabel: semanticsLabel ?? 'Show me, the paper behind this',
        marks: marks ?? const [],
      );
}
