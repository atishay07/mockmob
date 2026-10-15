import 'package:flutter/widgets.dart';

// K0 placeholder: F2 (Your chapters) replaces this widget.
//
// Slot contract: Practice (`practice_screen.dart`) places `ChaptersLink(subjectId: subject)`
// inside the page gutter, directly under the subject tiles, with no gap of its own; [subjectId]
// is the subject picked on the tiles. Keep the class name and the const constructor (it may
// become a ConsumerWidget). When visible, paint your own top gap (`MmSpace.s12`); with nothing
// true to show, return `SizedBox.shrink()`.

/// Practice's link into Your chapters for the picked subject.
class ChaptersLink extends StatelessWidget {
  const ChaptersLink({super.key, required this.subjectId});

  /// The public subject id picked on the tiles (`accountancy`).
  final String subjectId;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
