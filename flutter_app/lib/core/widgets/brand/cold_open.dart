import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../storage/storage_providers.dart';
import 'brand_opening.dart';

/// Whether onboarding should play its own opening. Always false now: the one brand opening
/// ([BrandOpening], laid over the app by [BrandOpeningHost]) plays on every cold start, so a
/// second one would repeat it. Kept so onboarding's check still compiles.
final shouldPlayColdOpenProvider = FutureProvider<bool>((ref) async => false);

/// Records that the first-launch opening has played (kept for callers; nothing reads it now).
Future<void> markColdOpenSeen(WidgetRef ref) async {
  try {
    await ref.read(appPrefsProvider).setColdOpenSeen(true);
  } on Object {
    // A convenience.
  }
}

/// The brand opening as a standalone screen, for the lab and goldens: the "mo" grows into
/// "mockmob". [progress] (0 to 1) freezes it; [onDone] fires once when it has handed off.
///
/// It is the same in Day and Night on purpose (design critic 3, decided 16 Oct): it continues the
/// system splash, which is the warm Night ground in both system modes (`splash_ground`,
/// #12110E, so there is no flash), so a pale opening would blink the screen. Day's own first
/// impression is the welcome room, drawn in daylight (`WelcomeHeroLayout.day`), one frame after
/// the opening lifts.
class ColdOpen extends StatelessWidget {
  const ColdOpen({super.key, required this.onDone, this.progress});

  final VoidCallback onDone;
  final double? progress;

  @override
  Widget build(BuildContext context) => BrandOpening(onDone: onDone, progress: progress);
}
