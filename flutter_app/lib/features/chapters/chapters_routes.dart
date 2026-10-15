// Route builders for Your chapters. lib/core/router/screens.dart re-exports them and router.dart
// binds them to `/practice/chapters/:subject`.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/chapters_screen.dart';

/// `/practice/chapters/:subject`: the chapter map of one subject.
Widget practiceChaptersScreen(BuildContext context, GoRouterState state) {
  final subject = state.pathParameters['subject'] ?? '';
  return ChaptersScreen(key: ValueKey('chapters-$subject'), subjectId: subject);
}
