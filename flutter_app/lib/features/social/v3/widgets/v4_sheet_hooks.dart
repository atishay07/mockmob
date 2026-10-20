// V4 sheet hooks (pass-1020 MOB-V4-BUILD owners): the den (V4-den) opens the sheets other owners build
// through these functions only, so the two owners never edit the same file.
//
// V4-sheets fills [V4Sheets.yourChain], [V4Sheets.thisWeek], [V4Sheets.shelf] and [V4Sheets.mobSettings]
// with its sheets (assign the static fields once, at app start or in its sheet files' library init, or
// replace the default bodies here at merge). Until then each opens today's screen, so nothing is lost.
// The Invite and Your Mobs sheets are V4-den's own and are wired here as well.

import 'package:flutter/widgets.dart';

import '../mob_v3_nav.dart';
import 'invite_sheet.dart';
import 'your_mobs_sheet.dart';

typedef V4SheetOpener = Future<void> Function(BuildContext context);

abstract final class V4Sheets {
  /// "Your chain": the personal daily chain (A5). Default: the chains screen, You tab.
  static V4SheetOpener yourChain = (context) => MobV3Nav.chains(context);

  /// "This week": the Mob's week, quest and Mob hours (A4 sheet). Default: the chains screen, Mob tab.
  static V4SheetOpener thisWeek = (context) => MobV3Nav.chains(context, mobTab: true);

  /// "Shelf" (A6). Default: the shelf screen.
  static V4SheetOpener shelf = (context) => MobV3Nav.shelf(context);

  /// "Mob settings" (A7), with "Show my study time to my Mob". Default: the settings screen.
  static V4SheetOpener mobSettings = (context) => MobV3Nav.settings(context);

  /// "Invite" (A11, V4-den).
  static V4SheetOpener invite = showInviteSheet;

  /// "Your Mobs" (A11, V4-den).
  static V4SheetOpener yourMobs = showYourMobsSheet;
}

/// The name the task brief used for the chain sheet's entry point.
abstract final class YourChainSheet {
  static Future<void> show(BuildContext context) => V4Sheets.yourChain(context);
}
