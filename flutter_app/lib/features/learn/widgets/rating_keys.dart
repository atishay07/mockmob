import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Forgot, Hard, Got it, Easy (ratings 1 to 4) as four equal keys in two rows. None is the
/// volt key: no rating is nudged, so the student answers honestly. While one is being sent it
/// shows the spinner and the others wait.
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
    return Expanded(
      child: KeyButton.secondary(
        label: _labels[rating - 1],
        loading: sending == rating,
        onPressed: inFlight ? null : () => onRate(rating),
        semanticsLabel: _labels[rating - 1],
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
