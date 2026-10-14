import 'package:flutter/material.dart';

import '../widgets/controls/mm_switch.dart';

/// The switch every You and notification row draws: the shared [MmSwitch] as a picture inside a
/// row that is itself the target. The row (48 dp or more, one TalkBack node with its toggled state)
/// handles the tap, so this wrapper ignores touches and stays out of semantics; the switch springs,
/// inks its track and draws its tick as its [value] changes.
///
/// [enabled] false shows the disabled look (a choice that cannot change right now). [held] is
/// kept for call sites that mean "on but not changeable here"; it shows as disabled.
class SettingsSwitch extends StatelessWidget {
  const SettingsSwitch({super.key, required this.value, this.held = false, this.enabled = true});

  final bool value;
  final bool held;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    // Out of semantics, touches and keyboard focus: the row around it is the one target.
    return ExcludeSemantics(
      child: ExcludeFocus(
        child: IgnorePointer(
          child: MmSwitch(value: value, onChanged: enabled && !held ? (_) {} : null),
        ),
      ),
    );
  }
}
