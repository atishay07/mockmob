// P2 Start a game (spec 5.3). Owner: SHEETS agent.
// STUB from the foundation commit: the owning agent replaces this file.

import 'package:flutter/material.dart';

import '../data/mob_v3_models.dart';

/// Prefill for a rematch or a picked tile.
class StartGamePrefill {
  const StartGamePrefill({this.format = GameFormat.sprint, this.count = 5, this.chapter, this.rematchOf});
  final GameFormat format;
  final int count;
  final String? chapter;
  final String? rematchOf;
}

/// Opens P2; returns the opened game, or null when the sheet was closed.
Future<MobGame?> showStartGame(BuildContext context, {StartGamePrefill prefill = const StartGamePrefill()}) async => null;
