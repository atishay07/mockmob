import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The bottom bar, 72 dp above the gesture inset (spec 5.5): Previous as a glass pill and the
/// one volt key, Next, which becomes Review and submit on the last question. No haptic
/// on these: inside a timed paper only the option tick speaks.
class RunnerBottomBar extends StatelessWidget {
  const RunnerBottomBar({super.key, required this.isFirst, required this.isLast, required this.onPrevious, required this.onNext});

  final bool isFirst;
  final bool isLast;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.5,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.ground,
          border: Border(top: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s8 + inset),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Row(
              children: [
                KeyButton.secondary(label: RunnerCopy.previous, onPressed: isFirst ? null : onPrevious, expanded: false, hapticOnCommit: false),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: KeyButton(label: isLast ? RunnerCopy.reviewAndSubmit : RunnerCopy.next, onPressed: onNext, hapticOnCommit: false),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
