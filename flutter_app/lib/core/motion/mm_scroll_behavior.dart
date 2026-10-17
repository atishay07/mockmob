import 'package:flutter/material.dart';

/// How every scroll view the app owns behaves (GLASS-1017 section 5.9, the owner's F3: "it
/// stretches instead of bouncing ... we can control the app UI"): the iOS bounce, on every
/// platform, and no Android stretch or glow.
///
/// * A vertical page is always scrollable, so even a page shorter than the screen gives under the
///   finger and springs back (B4), and pull to refresh reads the pull as negative pixels.
/// * Text fields keep a bounce that never scrolls a field that fits, so a single word in a box
///   cannot be dragged around.
/// * A scroll view that sets its own physics still applies them on top of this (a snapping chip
///   rail keeps its snap, a pager keeps its pages); the runner and the recap cards bounce too.
///
/// Set once on `MaterialApp.router` in `lib/app.dart`. Web views and platform views are untouched.
class MmScrollBehavior extends MaterialScrollBehavior {
  const MmScrollBehavior();

  /// The physics for a page: the bounce, always scrollable.
  static const ScrollPhysics page = BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());

  /// The physics inside a text field, or across a horizontal rail: the bounce, only when there
  /// is something to scroll.
  static const ScrollPhysics fitted = BouncingScrollPhysics(parent: RangeMaintainingScrollPhysics());

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    final widget = context.widget;
    final vertical = widget is! Scrollable || axisDirectionToAxis(widget.axisDirection) == Axis.vertical;
    if (!vertical || context.findAncestorWidgetOfExactType<EditableText>() != null) return fitted;
    return page;
  }

  @override
  Widget buildOverscrollIndicator(BuildContext context, Widget child, ScrollableDetails details) => child;
}
