import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Which tool a tools screen was opened from (`?from=compass`), so Compass and Combo Planner hand
/// over to each other without piling up: from Compass, "Open Combo Planner" pushes Combo; Combo's
/// "See the courses and cutoffs" then goes back to that Compass instead of stacking a second one.
class ToolsOrigin extends InheritedWidget {
  const ToolsOrigin({super.key, required this.from, required super.child});

  static const String compass = 'compass';
  static const String combo = 'combo';

  /// The `from` query parameter of the route, or null.
  final String? from;

  static String? of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ToolsOrigin>()?.from;

  /// Goes to [to]: back to it when this screen was opened from it, otherwise pushed with
  /// `from=[from]` so the next hand-over can come back the same way.
  static Future<void> openOrReturn(BuildContext context, {required String to, required String from}) async {
    final origin = of(context);
    final back = (origin == compass && to.endsWith('/compass')) || (origin == combo && to.endsWith('/combo'));
    if (back && context.canPop()) {
      context.pop();
      return;
    }
    await context.push(Uri(path: to, queryParameters: {'from': from}).toString());
  }

  @override
  bool updateShouldNotify(ToolsOrigin oldWidget) => oldWidget.from != from;
}
