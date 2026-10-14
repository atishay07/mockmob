import 'package:flutter/widgets.dart';

import '../haptics/haptics.dart';

/// The haptic a pressable surface gives when it activates (brief section 7).
enum MmPressHaptic {
  /// Nothing (the default: many surfaces already fire their own).
  none,

  /// `selectionClick`: a choice, a row, a chip, a tab.
  selection,

  /// `lightImpact`: Start, a primary commit, a flip.
  light,

  /// `mediumImpact`: a sheet opening, a seal.
  medium,
}

/// The app's [Haptics] from the nearest `ProviderScope`, or null outside one (a bare widget in a
/// test), so a surface never needs Riverpod to build.
Haptics? mmHapticsOf(BuildContext context) => hapticsOf(context);

/// Fires [haptic] through the app's [Haptics] (which honours the Touch feedback switch).
void mmFireHaptic(BuildContext context, MmPressHaptic haptic) {
  if (haptic == MmPressHaptic.none) return;
  final haptics = mmHapticsOf(context);
  if (haptics == null) return;
  switch (haptic) {
    case MmPressHaptic.none:
      break;
    case MmPressHaptic.selection:
      haptics.selection();
    case MmPressHaptic.light:
      haptics.light();
    case MmPressHaptic.medium:
      haptics.medium();
  }
}
