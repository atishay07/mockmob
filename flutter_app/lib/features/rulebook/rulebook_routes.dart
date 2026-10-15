// Route builders for the Rule book. lib/core/router/screens.dart re-exports them and router.dart
// binds them to `/review/rules`.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/rulebook_screen.dart';

/// `/review/rules`: the Rule book.
Widget reviewRulesScreen(BuildContext context, GoRouterState state) => const RuleBookScreen();
