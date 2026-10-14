import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';

/// How much of the bottom of the screen the bar holds, for the tab roots under it (DOCK.md
/// section 3.4). The shell adds [clearance] to the `MediaQuery` bottom padding of its tab roots,
/// so lists and `SafeArea`s clear the bar without changes; a screen that needs the number
/// itself (to place something just above the bar) reads it here.
///
/// The value changes only when the capsule appears or goes, never while the bar collapses, so
/// scrolling never relayouts.
class MmBarInsets extends InheritedWidget {
  const MmBarInsets({super.key, required this.showing, required this.capsule, required super.child});

  /// Whether the bar is on screen at all (it is not over a pushed page or the keyboard).
  final bool showing;

  /// Whether the live capsule is up.
  final bool capsule;

  /// What the bar adds above the gesture inset: lift, bar and gap, plus the capsule.
  double get clearance => !showing ? 0 : clearanceFor(capsule: capsule);

  /// The bar's top edge above the gesture inset, expanded.
  static const double barTop = MmBar.lift + MmBar.height;

  static double clearanceFor({required bool capsule}) => MmBar.clearanceAbove + (capsule ? MmBar.capsuleClearance : 0);

  /// The nearest insets, or none outside the shell.
  static MmBarInsets? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<MmBarInsets>();

  /// The clearance under [context], 0 outside the shell.
  static double clearanceOf(BuildContext context) => maybeOf(context)?.clearance ?? 0;

  @override
  bool updateShouldNotify(MmBarInsets oldWidget) => showing != oldWidget.showing || capsule != oldWidget.capsule;
}

/// The ground fading in behind the bar (replaces the old `DockScrim`). It runs from 40 dp above
/// the bar's top (or the capsule's, while it shows) to the screen's bottom: clear at the top,
/// ground at 85% 16 dp below the bar's top, solid at the bar's bottom edge. The bar's upper half,
/// where the icons sit, shows content moving behind the glass; its lower half, where the labels
/// sit, is always over at least 85% ground, so labels keep 4.5:1 over any page.
class BarScrim extends StatelessWidget {
  const BarScrim({super.key, required this.bottomInset, this.capsule = false});

  /// The gesture inset under the bar.
  final double bottomInset;
  final bool capsule;

  /// The scrim's height for a [bottomInset].
  static double heightFor(double bottomInset, {bool capsule = false}) =>
      40 + MmBar.height + MmBar.lift + bottomInset + (capsule ? MmBar.capsuleClearance : 0);

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    final height = heightFor(bottomInset, capsule: capsule);
    // Stops measured from the top of whichever surface is highest (bar or capsule).
    final surfaceTop = 40.0;
    final dense = (surfaceTop + 16) / height;
    final solid = (height - bottomInset - MmBar.lift) / height;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: [0, dense, solid.clamp(dense, 1.0), 1],
          colors: [ground.withValues(alpha: 0), ground.withValues(alpha: 0.85), ground, ground],
        ),
      ),
    );
  }
}
