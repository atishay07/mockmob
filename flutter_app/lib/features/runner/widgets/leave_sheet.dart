import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The leave guard (spec 5.5, 4.4): the clock keeps running and nothing is discarded. Pops
/// true when the student chooses to leave.
class LeaveSheet extends StatelessWidget {
  const LeaveSheet({super.key, required this.isMock, required this.until});

  final bool isMock;
  final DateTime until;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          RunnerCopy.leaveBody(isMock: isMock, until: until),
          style: type.body.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: RunnerCopy.keepGoing, onPressed: () => Navigator.of(context).pop(false), hapticOnCommit: false, autofocus: true),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: RunnerCopy.leaveKey(isMock), onPressed: () => Navigator.of(context).pop(true), hapticOnCommit: false),
      ],
    );
  }
}
