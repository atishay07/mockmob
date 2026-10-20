// V4 sheet hooks (pass-1020 MOB-V4-BUILD): the den (V4-den) opens the sheets other owners build through these
// functions only, so the two owners never edit the same file. The four V4-sheets sheets and the den's own
// Invite and Your Mobs sheets are wired here.
//
// [V4Sheets.yourChain] and the others are `Future<void> Function(BuildContext)`; [YourChainSheet.show] is the
// chain sheet's entry point.

import 'package:flutter/widgets.dart';

import 'invite_sheet.dart';
import 'mob_settings_sheet.dart';
import 'shelf_sheet.dart';
import 'this_week_sheet.dart';
import 'your_chain_sheet.dart';
import 'your_mobs_sheet.dart';

typedef V4SheetOpener = Future<void> Function(BuildContext context);

abstract final class V4Sheets {
  /// "Your chain": the personal daily chain (A5).
  static V4SheetOpener yourChain = showYourChainSheet;

  /// "This week": the Mob's week, quest and Mob hours (A4). The hours block links on to Mob settings.
  static V4SheetOpener thisWeek = (context) => showThisWeekSheet(context, onSettings: (c) => leaveToSettings(c));

  /// "Shelf" (A6).
  static V4SheetOpener shelf = openShelfSheet;

  /// "Mob settings" (A7), with "Show my study time to my Mob".
  static V4SheetOpener mobSettings = openMobSettingsSheet;

  /// "Invite" (A11, V4-den).
  static V4SheetOpener invite = showInviteSheet;

  /// "Your Mobs" (A11, V4-den).
  static V4SheetOpener yourMobs = showYourMobsSheet;

  /// Takes the sheet [context] belongs to off the stack, then opens Mob settings over the den.
  static void leaveToSettings(BuildContext context) {
    final nav = Navigator.of(context, rootNavigator: true);
    final route = ModalRoute.of(context);
    if (route != null && route.isActive) nav.removeRoute(route);
    openMobSettingsSheet(nav.context);
  }
}

/// The name the task brief used for the chain sheet's entry point.
abstract final class YourChainSheet {
  static Future<void> show(BuildContext context) => V4Sheets.yourChain(context);
}
