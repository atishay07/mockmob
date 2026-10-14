import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../access_copy.dart';
import 'access_field.dart';
import 'problem_slot.dart';

/// The message place of a form: its problem line, else the words for a wait that has run past
/// 12 seconds, else the quiet [rest] text (when the form has help to give). Messages swap with
/// the shared fade and rise. A form that has [rest] text reserves its room (so nothing moves
/// when a problem comes); one without it takes room only for the message.
class FormMessage extends StatelessWidget {
  const FormMessage({
    super.key,
    required this.problem,
    required this.working,
    this.rest,
    this.stillText = AccessCopy.stillWorking,
  });

  final String? problem;

  /// A call is running: after 12 seconds it says so.
  final bool working;

  /// The resting help, in quiet text. Null for none.
  final String? rest;
  final String stillText;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return StillWorking(
      active: working,
      builder: (context, longWait) {
        final Object key;
        final Widget child;
        if (problem != null) {
          key = problem!;
          child = AccessProblemLine(message: problem!);
        } else if (longWait) {
          key = 'still';
          child = Text(stillText, style: type.small.copyWith(color: colors.ink2));
        } else if (rest != null) {
          key = 'rest';
          child = Text(rest!, style: type.small.copyWith(color: colors.ink3));
        } else {
          key = 'none';
          child = const SizedBox.shrink();
        }
        return ProblemSlot(
          messageKey: key,
          lines: rest == null ? 0 : null,
          child: child,
        );
      },
    );
  }
}
