import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Forgot, Hard, Got it, Easy (ratings 1 to 4) as four equal keys in two rows. None is the
/// volt key at rest: no rating is nudged, so the student answers honestly. The one that is tapped
/// inks volt (a cross-fade from the glass key, with the spinner on it) while its rating is on its
/// way, and the others wait; once the server has acknowledged it, the card flies off.
class RatingKeys extends StatelessWidget {
  const RatingKeys({super.key, required this.onRate, this.sending});

  final ValueChanged<int> onRate;

  /// The rating in flight, or null when nothing is being sent.
  final int? sending;

  static const _labels = [
    LearnCopy.forgot,
    LearnCopy.hard,
    LearnCopy.gotIt,
    LearnCopy.easy,
  ];

  Widget _key(int rating) {
    final inFlight = sending != null;
    final picked = sending == rating;
    final label = _labels[rating - 1];
    return Expanded(
      child: MmOverlapSwitcher(
        fit: StackFit.passthrough,
        child: picked
            // Inked: the volt key, loading, taps ignored. It keeps its label and its width.
            ? KeyButton(
                key: ValueKey('picked-$rating'),
                label: label,
                loading: true,
                // A no-op, not null: a null press reads as a disabled key and would grey the ink out
                // (the key ignores taps while it is loading anyway).
                onPressed: () {},
                semanticsLabel: label,
              )
            : KeyButton.secondary(
                key: ValueKey('rest-$rating'),
                label: label,
                onPressed: inFlight ? null : () => onRate(rating),
                semanticsLabel: label,
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: Semantics(
            header: true,
            child: Text(
              LearnCopy.howWell,
              style: context.mmType.label.copyWith(color: colors.ink2),
              textAlign: TextAlign.center,
            ),
          ),
        ),
        Row(
          children: [
            _key(1),
            const SizedBox(width: MmSpace.s8),
            _key(2),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        Row(
          children: [
            _key(3),
            const SizedBox(width: MmSpace.s8),
            _key(4),
          ],
        ),
      ],
    );
  }
}
