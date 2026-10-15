import 'package:flutter/widgets.dart';

// K0 placeholder: F2 (Your chapters) replaces this widget.
//
// Slot contract: Your record (`insights_screen.dart`) places `const ChaptersRecordRow()` in its
// list, directly above the Chapters section, with no gap of its own. Keep the class name and the
// const constructor (it may become a ConsumerWidget). When visible, paint your own top gap
// (`MmSpace.group`); with nothing true to show, return `SizedBox.shrink()`.

/// Your record's entry row into Your chapters ("See every chapter").
class ChaptersRecordRow extends StatelessWidget {
  const ChaptersRecordRow({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
