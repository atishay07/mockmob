// SET Mob settings as a page (spec 5.3). In Mob V4 the settings live in one sheet from the den's gear
// (widgets/mob_settings_sheet.dart); this page is the same body on a page, for any route that still pushes it.
// "Show a podium" (the Mob's owner; everyone else reads who decided), the Mob's name (owner), "Resting this
// week", "Share my marks in games", "Show my study time to my Mob" (when Mob hours are on), the members with
// their menu, and the "You" group, all in widgets/mob_settings_sheet.dart.

import 'package:flutter/material.dart';

import '../../../you/widgets/you_page.dart';
import '../copy_v3.dart';
import '../widgets/mob_fx.dart';
import '../widgets/mob_settings_sheet.dart';

class MobSettingsV3Screen extends StatelessWidget {
  const MobSettingsV3Screen({super.key});

  @override
  Widget build(BuildContext context) => MobIdleScope(
        child: YouPage(
          title: MobV3Copy.settingsTitle,
          children: const [Padding(padding: youGutter, child: MobSettingsBody())],
        ),
      );
}
