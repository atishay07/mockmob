import 'package:flutter/widgets.dart';

// K0 placeholder: F3 (Paper formats) replaces this widget.
//
// Slot contract: Your record (`insights_screen.dart`) places `const FormatsCard()` in its list,
// after the Chapters section and before `LeakCard`, with no gap of its own. Keep the class name
// and the const constructor (it may become a ConsumerWidget). When visible, paint your own top
// gap (`MmSpace.group`); with nothing true to show (under 6 answered in every format), return
// `SizedBox.shrink()`.

/// Your record's Paper formats card: right of answered per question format, beside the paper's
/// usual count (`PaperPattern.quotaFor`).
class FormatsCard extends StatelessWidget {
  const FormatsCard({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
