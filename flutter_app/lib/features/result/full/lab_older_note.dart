import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/models.dart' show LabOlder, LabOlderAction;
import '../../../core/router/action_router.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../model/subject_names.dart' show publicSubjectId;

/// The in-app link of an older paper's one action: a `/dashboard` href built from the action's
/// own subject and mode (the website's form, so `ActionRouter` stays the one place that decides
/// what opens). A full mock goes to its setup screen, where the cost is shown: nothing starts, and
/// nothing is charged, before the second tap there.
String labOlderHref(LabOlderAction action) => Uri(
      path: '/dashboard',
      queryParameters: {
        if (action.subject != null) 'subject': publicSubjectId(action.subject!),
        'mode': action.mode,
      },
    ).toString();

/// What an older paper's record cannot show, in the server's one finished line, with the one action
/// that makes the next paper whole (Repair v4: the honest older-paper Lab). It sits under the
/// ledger, set apart by a hairline: no card, no warning colour (nothing here is wrong with the
/// student's work), no cause and no forecast, and no wall of "not recorded" lines. The action is a
/// quiet outlined key, because the page's one filled key is the repair.
class LabOlderNote extends StatelessWidget {
  const LabOlderNote({super.key, required this.older, this.onAction});

  final LabOlder older;

  /// Replaces the route push (tests). Receives the in-app location the action opens.
  final ValueChanged<String>? onAction;

  void _open(BuildContext context, LabOlderAction action) {
    final target = ActionRouter.resolve(labOlderHref(action));
    if (target is! NativeTarget) return;
    if (onAction != null) {
      onAction!(target.location);
      return;
    }
    unawaited(context.push(target.location));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final action = older.action;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s16),
          Semantics(
            container: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: ExcludeSemantics(child: Icon(LucideIcons.clock, size: 16, color: colors.ink3)),
                ),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(older.line, style: type.small.copyWith(color: colors.ink2))),
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(height: MmSpace.s12),
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.secondary(
                // The last two words stay together, so a long label never leaves one word on a line of its own.
                label: action.label.replaceFirstMapped(RegExp(r' (?=\S+$)'), (_) => ' '),
                semanticsLabel: action.label,
                expanded: false,
                onPressed: () => _open(context, action),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
