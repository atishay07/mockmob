import 'package:flutter/widgets.dart';

// K0 placeholder: F1 (Revise) replaces this widget.
//
// Slot contract: Review (`review_screen.dart`) places `const ReviseSection()` inside the page
// gutter, above Past results, with no gap of its own. Keep the class name and the const
// constructor (it may become a ConsumerWidget). When visible, paint your own top gap
// (`ReviewSpace.section`); when there is nothing true to show (no cards, table unavailable),
// return `SizedBox.shrink()` so the page is exactly as before.

/// Review's Revise section: how many of the student's own wrong answers are due today.
class ReviseSection extends StatelessWidget {
  const ReviseSection({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
