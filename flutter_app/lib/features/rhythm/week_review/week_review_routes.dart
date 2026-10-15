// Route builders for Week in review. lib/core/router/screens.dart re-exports them and router.dart
// binds them to `/today/week-review`.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'week_review_screen.dart';

/// `/today/week-review` (`?week=YYYY-MM-DD`, the week's Monday; none means the week just closed).
Widget todayWeekReviewScreen(BuildContext context, GoRouterState state) {
  final week = state.uri.queryParameters['week'];
  final weekStart = week != null && RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(week) ? week : null;
  return WeekReviewScreen(key: ValueKey('week-review-${weekStart ?? 'last'}'), weekStart: weekStart);
}
