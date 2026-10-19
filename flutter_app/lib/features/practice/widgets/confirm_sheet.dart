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
      concepts: () => leaveTo(AppRoutes.learnDoor),
      review: () => leaveTo(AppRoutes.review),
      close: () => Navigator.of(sheetContext).maybePop(),
    );
  }

  try {
    await showMmSheet<void>(
      context: context,
      builder: (sheetContext) => ComposerLifetime(
        controller: controller,
        child: PracticeComposer(initial: selection, controller: controller, exits: exitsFor(sheetContext)),
      ),
      footer: (sheetContext) => PracticeComposerKeys(controller: controller, exits: exitsFor(sheetContext)),
    );
  } finally {
    // Stops the pending re-quote on every way out; the notifier itself is disposed by
    // [ComposerLifetime] when the sheet's content leaves the tree.
    controller.close();
  }
}

/// Owns [controller] for as long as the sheet's content is mounted and disposes it when the
/// sheet unmounts (the body and the pinned footer both listen to it; both are gone by then).
class ComposerLifetime extends StatefulWidget {
  const ComposerLifetime({super.key, required this.controller, required this.child});

  final ComposerController controller;
  final Widget child;

  @override
  State<ComposerLifetime> createState() => _ComposerLifetimeState();
}

class _ComposerLifetimeState extends State<ComposerLifetime> {
  @override
  Widget build(BuildContext context) => widget.child;

  @override
  void dispose() {
    widget.controller
      ..close()
      ..dispose();
    super.dispose();
  }
}
