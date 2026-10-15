import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

// K0 placeholder: F2 (Your chapters) replaces this screen. Keep the class name and constructor;
// the route `/practice/chapters/:subject` (chapters_routes.dart) builds it. The paper weights
// come from `paperPatternProvider` in lib/core/pattern/paper_pattern_repository.dart.

/// `/practice/chapters/:subject`: every chapter of [subjectId], sized by its usual share of the
/// paper and filled by the student's own record.
class ChaptersScreen extends StatelessWidget {
  const ChaptersScreen({super.key, required this.subjectId});

  /// The public subject id (`accountancy`).
  final String subjectId;

  static const String _title = 'Your chapters';
  static const String _emptyTitle = 'No chapters to show yet';
  static const String _emptyMessage = 'Practise in this subject and your chapters fill in here.';
  static const String _back = 'Go to Practice';

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
              child: MmPageHeader(title: _title, fallbackRoute: AppRoutes.practice),
            ),
            Expanded(
              child: StateView(
                kind: StateViewKind.empty,
                pose: MobiPose.read,
                title: _emptyTitle,
                message: _emptyMessage,
                primary: StateAction(_back, () => context.go(AppRoutes.practice)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
