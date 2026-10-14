// Where Today shows a celebration (the rhythm module's `CelebrationSlot` for the today scope):
// directly under the week's ending card, on the ground, not in a card. The first repair and the
// first met week land here as one sentence. It takes no room, and adds no gap, until one fires.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../rhythm/rhythm.dart';

class TodayCelebration extends ConsumerWidget {
  const TodayCelebration({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shows = ref.watch(
      celebrationControllerProvider.select((s) => s.byScope[CelebrationScope.today]?.showsMoment ?? false),
    );
    // The slot draws nothing while rhythm is off, so the gap above it goes too.
    if (!shows || !ref.watch(rhythmVisibleProvider)) return const SizedBox.shrink();
    return const Padding(
      padding: EdgeInsets.only(top: MmSpace.s12),
      child: CelebrationSlot(scope: CelebrationScope.today),
    );
  }
}
