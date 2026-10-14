import 'package:flutter/material.dart';

import '../../core/widgets/widgets.dart';

/// A quiet text key centred under the page's primary key. The tap area is the full 48 dp key.
class QuietAction extends StatelessWidget {
  const QuietAction({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Center(
    child: KeyButton.quiet(label: label, onPressed: onPressed),
  );
}
