import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The volt primary key with a spinner that reads in both rooms: the sweep is voltInk on the
/// volt face and its track is a faint ink ring, so the key always shows an arc with a gap (the
/// theme's own track is dark brown on Night, which closed the ring into a plain circle).
/// A loading key keeps its label and width and ignores taps.
class VoltKey extends StatelessWidget {
  const VoltKey({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.disabledReason,
  });

  final String label;

  /// Null disables the key.
  final VoidCallback? onPressed;
  final bool loading;
  final String? disabledReason;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final theme = Theme.of(context);
    return Theme(
      data: theme.copyWith(
        progressIndicatorTheme: theme.progressIndicatorTheme.copyWith(
          circularTrackColor: colors.voltInk.withValues(alpha: 0.18),
        ),
      ),
      child: KeyButton(
        label: label,
        loading: loading,
        disabledReason: disabledReason,
        // A loading key keeps the volt face (a loading key ignores taps).
        onPressed: loading ? () {} : onPressed,
      ),
    );
  }
}
