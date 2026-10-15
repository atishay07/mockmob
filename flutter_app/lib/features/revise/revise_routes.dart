// Route builders for Revise. lib/core/router/screens.dart re-exports them and router.dart binds
// them to `/review/revise`.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/revise_screen.dart';

/// `/review/revise`: today's Revise deck.
Widget reviewReviseScreen(BuildContext context, GoRouterState state) => const ReviseScreen();
