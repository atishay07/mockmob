import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/theme.dart';
import 'segmented.dart';

/// The Glass setting for You > Appearance: Full, Lite or Off, saved on the phone and applied at
/// once. Full blurs the dock and sheets; Lite keeps the tint and edge light without blur; Off is
/// solid. The app also steps Full down to Lite by itself if the phone struggles.
///
/// The control shows the glass that is actually drawn. While the app has stepped Full down to
/// Lite, Lite is the selected segment and [autoNote] says why; Full stays one tap away.
/// True while Full was chosen but the app stepped down to Lite by itself.
bool glassAutoLite(WidgetRef ref) {
  ref.watch(glassQualityProvider);
  return ref.read(glassQualityProvider.notifier).autoLite;
}

class GlassQualityPicker extends ConsumerWidget {
  const GlassQualityPicker({super.key});

  static const String title = 'Glass';
  static const String note = 'Lite and Off are easier on older phones.';
  static const String autoNote = 'Running Lite to keep scrolling smooth. Pick Full to try it again.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MmSegmented<GlassQuality>(
      semanticsLabel: title,
      segments: const [
        MmSegment(GlassQuality.full, 'Full'),
        MmSegment(GlassQuality.lite, 'Lite'),
        MmSegment(GlassQuality.off, 'Off'),
      ],
      // What is in effect: the student's choice, or Lite while the automatic step is on.
      value: ref.watch(glassQualityProvider),
      onChanged: (q) => ref.read(glassQualityProvider.notifier).choose(q),
    );
  }
}
