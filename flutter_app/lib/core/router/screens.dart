import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/tools/tools_routes.dart' show ToolsShelf;
import '../theme/theme.dart';
import '../widgets/lab/lab_screen.dart';
import '../widgets/tab_root_header.dart';
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

Widget splashScreen(BuildContext context, GoRouterState state) => const SplashScreen();

/// `/lab` (debug builds only).
Widget labScreen(BuildContext context, GoRouterState state) => const LabScreen();

/// `/colleges`, the Colleges tab root (branch 3). A stand-in until the Colleges area exports its
/// own `collegesScreen` from `features/tools/tools_routes.dart` (app-ia-1016.md 5.1); then this
/// builder goes and the export above shows theirs. Until then it is a working tab root: the
/// avatar and the title, and the CUET tools as one flat list (Compass with what the student's
/// subjects open, the Combo planner, the 2027 guide), each opening over the bar.
Widget collegesScreen(BuildContext context, GoRouterState state) => const CollegesTabStandIn();

class CollegesTabStandIn extends StatelessWidget {
  const CollegesTabStandIn({super.key});

  static const String title = 'Colleges';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + MmSpace.s16),
          children: const [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: TabRootHeader(title: title),
            ),
            SizedBox(height: MmSpace.s16),
            ToolsShelf(showAll: false),
          ],
        ),
      ),
    );
  }
}
