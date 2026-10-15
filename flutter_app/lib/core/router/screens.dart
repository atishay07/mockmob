import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../widgets/lab/lab_screen.dart';
import 'splash_screen.dart';

// Route builders. Each feature owns lib/features/<feature>/<feature>_routes.dart and replaces its
// placeholders there; this file only re-exports them, so parallel modules never edit the same file.
export '../../features/auth/auth_routes.dart';
export '../../features/insights/insights_routes.dart' show reviewInsightsScreen, reviewSavedScreen, practiceStreamScreen, askScreen;
export '../../features/learn/learn_routes.dart';
export '../../features/notifications/notifications_routes.dart';
export '../../features/onboarding/onboarding_routes.dart';
export '../../features/practice/practice_routes.dart';
export '../../features/result/result_routes.dart';
export '../../features/review/review_routes.dart';
export '../../features/rhythm/rhythm_routes.dart';
export '../../features/runner/runner_routes.dart';
export '../../features/today/today_routes.dart';
export '../../features/tools/tools_routes.dart'
    show toolsScreen, toolsCompassScreen, toolsProgrammeScreen, toolsComboScreen, toolsGuide2027Screen;
export '../../features/you/you_routes.dart';
// Feature wave 15 Oct (K0): each feature owns its builder file.
export '../../features/chapters/chapters_routes.dart';
export '../../features/revise/revise_routes.dart';
export '../../features/rhythm/week_review/week_review_routes.dart';
export '../../features/rulebook/rulebook_routes.dart';

Widget splashScreen(BuildContext context, GoRouterState state) => const SplashScreen();

/// `/lab` (debug builds only).
Widget labScreen(BuildContext context, GoRouterState state) => const LabScreen();
