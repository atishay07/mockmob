import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';
import 'bar_live.dart';

/// How much of the bottom of the screen the bar holds, for the tab roots under it (DOCK.md
/// section 3.4). The shell adds [clearance] to the `MediaQuery` bottom padding of its tab roots,
/// so lists and `SafeArea`s clear the bar without changes; a screen that needs the number
/// itself (to place something just above the bar) reads it here.
///
/// The value changes only when the capsule appears or goes, never while the bar collapses, so
/// scrolling never relayouts.
class MmBarInsets extends InheritedWidget {
  const MmBarInsets({super.key, required this.showing, required this.capsule, this.tonightMove, required super.child});

  /// Whether the bar is on screen at all (it is not over a pushed page or the keyboard).
  final bool showing;

  /// Whether the live capsule is up.
  final bool capsule;

  /// Where Today publishes tonight's move while its hero key is off-screen (null when it is in
  /// view). The capsule shows it as its lowest-priority state, on Today only. Null outside the
  /// shell.
  final ValueNotifier<BarMove?>? tonightMove;

  /// The bar's top edge above the screen's bottom, for a page under the shell whose bottom
  /// padding is [paddingBottom] (the gesture inset plus [clearance]).
  double barTopAbove(double paddingBottom) => paddingBottom - clearance + barTop;

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
  bool updateShouldNotify(MmBarInsets oldWidget) =>
      showing != oldWidget.showing || capsule != oldWidget.capsule || tonightMove != oldWidget.tonightMove;
}

/// The ground fading in behind the bar (replaces the old `DockScrim`), from 40 dp above the bar's
/// top (or the capsule's, while it shows) to the screen's bottom. It follows the glass tier
/// ([quality], else the inherited `GlassScope`):
///
/// * Full: the bar is frosted glass, so the scrim stays out of its way (L33, "content must blur
///   through it"). Clear down to the bar's top, so the icon half shows the page moving behind the
///   blur; it thickens through the label half (ground at 55% at mid-bar, 85% at the bar's foot,
///   under a tint that is already 60 to 68% ground), so the labels keep their contrast; solid in
///   the gap under the floating bar.
/// * Lite and Off: no live blur, so the old fade holds: ground at 85% 16 dp below the surface's
///   top and solid at the bar's bottom edge, so labels keep 4.5:1 over any page.
class BarScrim extends StatelessWidget {
  const BarScrim({super.key, required this.bottomInset, this.capsule = false, this.quality});

  /// The gesture inset under the bar.
  final double bottomInset;
  final bool capsule;

  /// Overrides the inherited `GlassScope` (goldens draw every tier).
  final GlassQuality? quality;

  /// The scrim's height for a [bottomInset].
  static double heightFor(double bottomInset, {bool capsule = false}) =>
      40 + MmBar.height + MmBar.lift + bottomInset + (capsule ? MmBar.capsuleClearance : 0);

  /// The scrim's stops and ground alphas, top to bottom, for a scrim [height] tall.
  static ({List<double> stops, List<double> alphas}) rampFor(GlassQuality quality, {required double height, required double bottomInset}) {
    final barBottom = height - bottomInset - MmBar.lift;
    if (quality == GlassQuality.full) {
      final barTop = barBottom - MmBar.height;
      final mid = barTop + MmBar.height / 2;
      return (
        stops: [0, barTop / height, mid / height, barBottom / height, 1],
        alphas: const [0, 0, 0.55, 0.85, 1],
      );
    }
    // Stops measured from the top of whichever surface is highest (bar or capsule).
    const surfaceTop = 40.0;
    final dense = (surfaceTop + 16) / height;
    final solid = (barBottom / height).clamp(dense, 1.0);
    return (stops: [0, dense, solid, 1], alphas: const [0, 0.85, 1, 1]);
  }

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    final height = heightFor(bottomInset, capsule: capsule);
    final ramp = rampFor(quality ?? GlassScope.of(context), height: height, bottomInset: bottomInset);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: ramp.stops,
          colors: [for (final a in ramp.alphas) ground.withValues(alpha: a)],
        ),
      ),
    );
  }
}
