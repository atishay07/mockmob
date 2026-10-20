// The ways to play (D167, K9): Sprint, Race, Your own round and Full mock together, in the order the start
// sheet lists them, with each one's icon and name. A format shows when the server offers it or names it
// locked (`StartRight.shows`).

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../copy_v3.dart';
import '../data/mob_v3_models.dart';

/// The four formats a student can start, in the order the tiles show them.
const List<GameFormat> mobStartFormats = [GameFormat.sprint, GameFormat.race, GameFormat.round, GameFormat.mock];

abstract final class FormatLook {
  static IconData icon(GameFormat f) => switch (f) {
        GameFormat.race => LucideIcons.timer,
        GameFormat.round || GameFormat.rematch => LucideIcons.slidersHorizontal,
        GameFormat.mock => LucideIcons.fileText,
        GameFormat.sprint => LucideIcons.send,
      };

  static String title(GameFormat f) => switch (f) {
        GameFormat.race => MobV3Copy.race,
        GameFormat.round || GameFormat.rematch => MobV3Copy.ownRound,
        GameFormat.mock => MobV3Copy.fullMock,
        GameFormat.sprint => MobV3Copy.sprint,
      };

  /// [start]: the start sheet's wording ("10, 15 or 20 questions" rather than "10 to 20").
  static String line(GameFormat f, {bool start = false}) => switch (f) {
        GameFormat.race => MobV3Copy.raceSub,
        GameFormat.round || GameFormat.rematch => start ? MobV3Copy.ownRoundSubStart : MobV3Copy.ownRoundSub,
        GameFormat.mock => MobV3Copy.fullMockSub,
        GameFormat.sprint => MobV3Copy.sprintSub,
      };
}
