import 'package:flutter/widgets.dart';

// K0 placeholder: F3 (Paper formats) replaces this widget.
//
// Slot contract: Practice (`practice_screen.dart`) places `FormatsRow(subjectId: subject)` in
// Choose your own, inside the page gutter, directly after the modes deck, with no gap of its own;
// [subjectId] is the subject picked on the tiles. Keep the class name and the const constructor
// (it may become a ConsumerWidget). When visible, paint your own top gap (`MmRhythm.item`); with
// nothing to offer for the subject, return `SizedBox.shrink()`. A drill opens the practice setup
// with `format` (`PaperFormat.id`), which the action router already passes through.

/// Practice's row of format drills ("Drill 5 sequence questions") for the picked subject.
class FormatsRow extends StatelessWidget {
  const FormatsRow({super.key, required this.subjectId});

  /// The public subject id picked on the tiles (`accountancy`).
  final String subjectId;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
