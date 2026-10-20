// The ways to play (D167, K9): Sprint, Race, Your own round and Full mock together, drawn the same in
// the play picker and the start sheet, two to a row. Each tile says in one line what the game is, so a
// first-time student sees every way the Mob plays before choosing. A format shows when the server offers
// it or names it locked (`StartRight.shows`); a locked one is drawn with its lock and, while billing is on,
// its Pro tag. No price anywhere.

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'sheet_parts.dart';

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

/// The tiles, two to a row with equal heights. [selected] marks one (the start sheet); [onTap] gets the
/// format of an open tile, [onLockedTap] that of a locked one (the sheet says why).
class FormatTiles extends StatelessWidget {
  const FormatTiles({super.key, required this.starts, this.selected, this.onTap, this.onLockedTap, this.start = false, this.usedLine});

  final StartRight starts;
  final GameFormat? selected;
  final ValueChanged<GameFormat>? onTap;
  final ValueChanged<GameFormat>? onLockedTap;
  final bool start;

  /// Every tile's line while the week's start is used ("Used this week").
  final String? usedLine;

  List<GameFormat> get shown => [for (final f in mobStartFormats) if (starts.shows(f)) f];

  @override
  Widget build(BuildContext context) {
    final tiles = <Widget>[
      for (final f in shown)
        () {
          final ok = starts.allows(f);
          // The Pro tag only while billing is on, and only where Pro is the reason (not a used start).
          final tag = !ok && starts.billingOn && starts.can ? MobV3Copy.proTag : null;
          return MobTile(
            key: ValueKey('format-${f.name}'),
            icon: FormatLook.icon(f),
            title: FormatLook.title(f),
            line: usedLine ?? FormatLook.line(f, start: start),
            selected: ok && selected == f,
            locked: !ok,
            tag: tag,
            onTap: ok ? (onTap == null ? null : () => onTap!(f)) : (onLockedTap == null ? null : () => onLockedTap!(f)),
          );
        }(),
    ];
    final rows = <Widget>[];
    for (var i = 0; i < tiles.length; i += 2) {
      if (rows.isNotEmpty) rows.add(const SizedBox(height: MmSpace.s12));
      rows.add(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: tiles[i]),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: i + 1 < tiles.length ? tiles[i + 1] : const SizedBox.shrink()),
          ],
        ),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}
