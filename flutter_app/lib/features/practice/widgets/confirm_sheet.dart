import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/widgets/widgets.dart';
import '../model/practice_selection.dart';
import 'practice_composer.dart';

/// Opens the confirm sheet for [selection]: what you get, what it costs, and Start. Start and
/// Not now ride in the sheet's pinned footer, above the gesture inset, so they never scroll out
/// of reach on a short phone or with large text. The sheet closes before the app moves on, so
/// back from the runner never lands on a stale sheet. [askedCount] is the length a link asked
/// for, said on the sheet when the mode does not offer it.
Future<void> showPracticeConfirm(BuildContext context, {required PracticeSelection selection, int? askedCount}) async {
  final router = GoRouter.of(context);
  final controller = ComposerController(selection, askedCount: askedCount);

  ComposerExits exitsFor(BuildContext sheetContext) {
    void leaveTo(String location, {bool push = false}) {
      Navigator.of(sheetContext).pop();
      push ? router.push(location) : router.go(location);
    }

    return ComposerExits(
      run: (id) => leaveTo(AppRoutes.run(id)),
      concepts: () => leaveTo(AppRoutes.learn, push: true),
      review: () => leaveTo(AppRoutes.review),
      close: () => Navigator.of(sheetContext).maybePop(),
    );
  }

  try {
    await showMmSheet<void>(
      context: context,
      builder: (sheetContext) => PracticeComposer(initial: selection, controller: controller, exits: exitsFor(sheetContext)),
      footer: (sheetContext) => PracticeComposerKeys(controller: controller, exits: exitsFor(sheetContext)),
    );
  } finally {
    controller.close();
  }
}
