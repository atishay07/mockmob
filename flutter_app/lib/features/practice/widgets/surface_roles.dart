import 'package:flutter/painting.dart';

import '../../../core/theme/theme.dart';

/// The selected or active surface (SPACING.md 8.1): one step lighter than a card on Night, and the
/// card itself on Day, where `raised2` is darker than the ground and reads as disabled. Always
/// paired with a 2 dp ink border, so the chosen thing is the strongest on the page in both themes.
/// A thin alias of `MmColors.selectedSurface`, which the theme now carries.
Color selectedSurface(MmColors colors) => colors.selectedSurface;
