import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The one main thing to do next, said as what it does.
class ResultFootAction {
  const ResultFootAction(this.label, this.onPressed);

  final String label;
  final VoidCallback onPressed;
}

/// The pinned foot of the practice result: the next step (repair these, try the blanks, or
/// another chapter) and "Finish for now".
class ResultFoot extends StatelessWidget {
  const ResultFoot({super.key, required this.primary, required this.onFinish, required this.showFinish});

  final ResultFootAction primary;
  final VoidCallback onFinish;

  /// At large text sizes the quiet key moves into the scrolling page so the pinned foot stays small.
  final bool showFinish;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // Solid ground under the keys; the page above dims into it through a 24 dp fade (BarFade on
    // the scroller), so there is no rule and no half row (SPACING.md 4.5).
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyButton(label: primary.label, onPressed: primary.onPressed),
            if (showFinish) ...[
              const SizedBox(height: MmSpace.s4),
              Align(child: KeyButton.quiet(label: PracticeCopy.finishForNow, onPressed: onFinish)),
            ],
          ],
        ),
      ),
    );
  }
}
