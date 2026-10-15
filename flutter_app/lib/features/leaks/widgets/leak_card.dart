import 'package:flutter/widgets.dart';

// K0 placeholder: F4 (Why marks leak) replaces this widget.
//
// Slot contract: Your record (`insights_screen.dart`) places `const LeakCard()` in its list,
// directly after `FormatsCard`, with no gap of its own. Keep the class name and the const
// constructor (it may become a ConsumerWidget). When visible, paint your own top gap
// (`MmSpace.group`); with nothing true to show, return `SizedBox.shrink()`.

/// Your record's card for Your reasons and Left blank across mocks.
class LeakCard extends StatelessWidget {
  const LeakCard({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
