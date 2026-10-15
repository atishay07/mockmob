import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

// K0 placeholder: F1 (Revise) replaces this screen. Keep the class name and constructor; the
// route `/review/revise` (revise_routes.dart) builds it.

/// `/review/revise`: the student's own wrong answers, brought back on a schedule.
class ReviseScreen extends StatelessWidget {
  const ReviseScreen({super.key});

  static const String _title = 'Revise';
  static const String _emptyTitle = 'Nothing to revise yet';
  static const String _emptyMessage = 'Questions you get wrong come back here to revise.';
  static const String _back = 'Back to Review';

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
              child: MmPageHeader(title: _title, fallbackRoute: AppRoutes.review),
            ),
            Expanded(
              child: StateView(
                kind: StateViewKind.empty,
                pose: MobiPose.read,
                title: _emptyTitle,
                message: _emptyMessage,
                primary: StateAction(_back, () => context.go(AppRoutes.review)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
