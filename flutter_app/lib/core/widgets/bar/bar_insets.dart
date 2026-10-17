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

/// The ground fading in behind the bar (replaces the old `DockScrim`). It runs from 40 dp above
/// the bar's top (or the capsule's, while it shows) to the screen's bottom: clear at the top,
/// [atBarTop] ground at the bar's top, [atBarBottom] at its bottom edge and 80% at the screen's
/// bottom. It only separates the floating row from the page; it never erases what scrolls under
/// the glass, so content shows through the frost as soft colour and shape (L33, NAV-1017 6.7,
/// GLASS-1017 6.1). v14: the v13 walk read the Night bar as an opaque pill, and 25 to 45% ground
/// under a 50% tint left content at about 14% of its light; the scrim is now 12 to 22%.
/// Legibility is the glass's job: its luminosity step keeps the labels at 4.5:1 or better even
/// over a solid volt key under this scrim (`BarGlass`, test/unit/a11y/bar_guidelines_test.dart).
class BarScrim extends StatelessWidget {
  const BarScrim({super.key, required this.bottomInset, this.capsule = false});

  /// The ground's strength at the bar's top and bottom edges (what the label contrast is judged
  /// over).
  static const double atBarTop = 0.12;
  static const double atBarBottom = 0.22;

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
    const surfaceTop = 40.0;
    final top = surfaceTop / height;
    final bottom = ((height - bottomInset - MmBar.lift) / height).clamp(top, 1.0);
    if (capsule) {
      // With the live capsule up, the page fades under it instead of showing half a row in the
      // 8 dp between the capsule and the bar: 50% ground at the capsule's top (v13 clutter fix),
      // easing to 30% at the bar's top so the bar itself stays see-through glass (v14), then the
      // bar's own 22% at its bottom edge.
      final barTop = ((MmBar.capsuleClearance + surfaceTop) / height).clamp(top, bottom);
      return DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0, top, barTop, bottom, 1],
            colors: [
              ground.withValues(alpha: 0),
              ground.withValues(alpha: 0.5),
              ground.withValues(alpha: 0.3),
              ground.withValues(alpha: atBarBottom),
              ground.withValues(alpha: 0.8),
            ],
          ),
        ),
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: [0, top, bottom, 1],
          colors: [ground.withValues(alpha: 0), ground.withValues(alpha: atBarTop), ground.withValues(alpha: atBarBottom), ground.withValues(alpha: 0.8)],
        ),
      ),
    );
  }
}
