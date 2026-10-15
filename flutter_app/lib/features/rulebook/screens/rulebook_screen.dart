import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

// K0 placeholder: F5 (Rule book) replaces this screen. Keep the class name and constructor; the
// route `/review/rules` (rulebook_routes.dart) builds it.

/// `/review/rules`: every repair's rule and memory hook, kept in one list by chapter.
class RuleBookScreen extends StatelessWidget {
  const RuleBookScreen({super.key});

  static const String _title = 'Rule book';
  static const String _emptyTitle = 'No rules yet';
  static const String _emptyMessage = 'Your first repair adds a rule here.';
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
