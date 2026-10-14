import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Section heading on the tab ("Choose your own", "Concepts") with an optional trailing link.
class SectionHeading extends StatelessWidget {
  const SectionHeading({super.key, required this.title, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Row(
      children: [
        Expanded(child: Semantics(header: true, child: Text(title, style: type.title))),
        if (action != null && onAction != null) KeyButton.quiet(label: action!, onPressed: onAction),
      ],
    );
  }
}

