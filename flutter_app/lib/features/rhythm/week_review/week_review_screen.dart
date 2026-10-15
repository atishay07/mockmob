import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

// K0 placeholder: F6 (Week in review) replaces this screen. Keep the class name and constructor;
// the route `/today/week-review` (week_review_routes.dart) builds it.

/// `/today/week-review`: what moved in one IST week. [weekStart] is that week's Monday
/// (`YYYY-MM-DD`, as `/api/me/rhythm` names weeks); null means the week that just closed.
class WeekReviewScreen extends StatelessWidget {
  const WeekReviewScreen({super.key, this.weekStart});

  final String? weekStart;

  static const String _title = 'Week in review';
  static const String _emptyTitle = 'Nothing to look back on yet';
  static const String _emptyMessage = 'Practise this week and what moved shows here.';
  static const String _back = 'Back to Today';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.mmColors.ground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: MmRhythm.screenTop, bottom: MmSpace.s8),
              child: MmPageHeader(title: _title, fallbackRoute: AppRoutes.today),
            ),
            Expanded(
              child: StateView(
                kind: StateViewKind.empty,
                pose: MobiPose.read,
                title: _emptyTitle,
                message: _emptyMessage,
                primary: StateAction(_back, () => context.go(AppRoutes.today)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
