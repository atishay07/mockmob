import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/widgets/widgets.dart';
import '../model/practice_selection.dart';
import 'practice_composer.dart';

/// Opens the confirm sheet for [selection]: what you get, what it costs, and Start. The sheet
/// closes before the app moves on, so back from the runner never lands on a stale sheet.
Future<void> showPracticeConfirm(BuildContext context, {required PracticeSelection selection}) {
  final router = GoRouter.of(context);
  return showMmSheet<void>(
    context: context,
    builder: (sheetContext) {
      void leaveTo(String location, {bool push = false}) {
        Navigator.of(sheetContext).pop();
        push ? router.push(location) : router.go(location);
      }

      return PracticeComposer(
        initial: selection,
        exits: ComposerExits(
          run: (id) => leaveTo(AppRoutes.run(id)),
          concepts: () => leaveTo(AppRoutes.learn, push: true),
          review: () => leaveTo(AppRoutes.review),
          close: () => Navigator.of(sheetContext).maybePop(),
        ),
      );
    },
  );
}
